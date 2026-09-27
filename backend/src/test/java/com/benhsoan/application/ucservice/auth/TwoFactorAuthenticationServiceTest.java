package com.benhsoan.application.ucservice.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.domain.auth.Role;
import com.benhsoan.domain.auth.TwoFactorChallenge;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.auth.exception.InvalidVerificationCodeException;
import com.benhsoan.domain.auth.exception.TwoFactorChallengeInvalidException;
import com.benhsoan.domain.auth.exception.VerificationCodeCooldownException;
import com.benhsoan.domain.auth.exception.VerificationCodeExpiredException;
import com.benhsoan.port.dto.command.auth.ResendTwoFactorCommand;
import com.benhsoan.port.dto.command.auth.VerifyTwoFactorCommand;
import com.benhsoan.port.dto.result.LoginResult;
import com.benhsoan.port.dto.result.TwoFactorResendResult;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.authSecurity.PasswordEncoderPort;
import com.benhsoan.port.outbound.authSecurity.PatientRecoveryCooldownPort;
import com.benhsoan.port.outbound.authSecurity.RefreshTokenGeneratorPort;
import com.benhsoan.port.outbound.authSecurity.TokenHashPort;
import com.benhsoan.port.outbound.authSecurity.VerificationCodeGeneratorPort;
import com.benhsoan.port.outbound.notification.TwoFactorCodeDeliveryPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.TwoFactorChallengeRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class TwoFactorAuthenticationServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-22T10:00:00Z");
    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID ROLE_ID = UUID.randomUUID();

    @Mock
    private TwoFactorChallengeRepository challengeRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private UserSessionRepository userSessionRepository;
    @Mock
    private PasswordEncoderPort passwordEncoderPort;
    @Mock
    private JwtTokenPort jwtTokenPort;
    @Mock
    private TokenHashPort tokenHashPort;
    @Mock
    private RefreshTokenGeneratorPort refreshTokenGeneratorPort;
    @Mock
    private VerificationCodeGeneratorPort codeGeneratorPort;
    @Mock
    private TwoFactorCodeDeliveryPort codeDeliveryPort;
    @Mock
    private AuditLogRepository auditLogRepository;
    @Mock
    private TwoFactorSecurityAuditWriter auditWriter;
    @Mock
    private PatientRecoveryCooldownPort cooldownPort;
    @Mock
    private ClockPort clockPort;

    private TwoFactorAuthenticationService service;

    @BeforeEach
    void setUp() {
        service = new TwoFactorAuthenticationService(
                challengeRepository, userRepository, roleRepository, userSessionRepository,
                passwordEncoderPort, jwtTokenPort, tokenHashPort, refreshTokenGeneratorPort,
                codeGeneratorPort, codeDeliveryPort, auditLogRepository, auditWriter, cooldownPort, clockPort);
    }

    private TwoFactorChallenge activeChallenge(String codeHash) {
        return TwoFactorChallenge.create(USER_ID, codeHash, NOW.plusSeconds(300), NOW);
    }

    @Test
    void verifyCorrectCode_completesLoginAndConsumesChallenge() {
        TwoFactorChallenge challenge = activeChallenge("hashed_code");
        User user = User.restore(USER_ID, "doctor1", "pw", "Doctor", "d@c.com", null, ROLE_ID, true, null, NOW);
        Role role = Role.restore(ROLE_ID, "DOCTOR", null, true, NOW, NOW, Set.of());

        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(passwordEncoderPort.matches("123456", "hashed_code")).thenReturn(true);
        when(challengeRepository.markConsumed(challenge.getId(), NOW)).thenReturn(1);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(roleRepository.findById(ROLE_ID)).thenReturn(Optional.of(role));
        when(refreshTokenGeneratorPort.generate()).thenReturn("refresh");
        when(tokenHashPort.hash("refresh")).thenReturn("refresh_hash");
        when(userSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(jwtTokenPort.generateToken(any(), any(), any(), any(), any())).thenReturn("access");
        when(jwtTokenPort.getExpiredAt("access")).thenReturn(NOW.plusSeconds(3600));

        LoginResult result = service
                .verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "123456", "1.2.3.4"));

        assertEquals("access", result.accessToken());
        assertEquals("refresh", result.refreshToken());
        verify(challengeRepository).markConsumed(challenge.getId(), NOW);
        org.mockito.ArgumentCaptor<com.benhsoan.domain.auditlog.AuditLog> captor = org.mockito.ArgumentCaptor
                .forClass(com.benhsoan.domain.auditlog.AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        assertEquals("1.2.3.4", captor.getValue().getIpAddress());
    }

    @Test
    void verifyWrongCode_throwsAndAuditsWithoutSession() {
        TwoFactorChallenge challenge = activeChallenge("hashed_code");
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(passwordEncoderPort.matches("000000", "hashed_code")).thenReturn(false);

        assertThrows(InvalidVerificationCodeException.class,
                () -> service.verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "000000")));

        verify(auditWriter).recordInvalidCode(challenge.getId(), USER_ID, null, NOW);
        verify(userSessionRepository, never()).save(any());
        verify(jwtTokenPort, never()).generateToken(any(), any(), any(), any(), any());
    }

    @Test
    void verifyPropagatesIpToAuditWriter() {
        TwoFactorChallenge challenge = activeChallenge("hashed_code");
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(passwordEncoderPort.matches("000000", "hashed_code")).thenReturn(false);

        assertThrows(InvalidVerificationCodeException.class,
                () -> service
                        .verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "000000", "203.0.113.7")));

        verify(auditWriter).recordInvalidCode(challenge.getId(), USER_ID, "203.0.113.7", NOW);
    }

    @Test
    void verifyExpiredCode_throwsAndAudits() {
        TwoFactorChallenge challenge = TwoFactorChallenge.create(USER_ID, "hashed_code", NOW.minusSeconds(1),
                NOW.minusSeconds(301));
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));

        assertThrows(VerificationCodeExpiredException.class,
                () -> service.verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "123456")));

        verify(auditWriter).recordFailure(challenge.getId(), USER_ID, "CHALLENGE_EXPIRED", null, NOW);
        verify(jwtTokenPort, never()).generateToken(any(), any(), any(), any(), any());
    }

    @Test
    void verifyConsumedChallenge_throwsAndAudits() {
        TwoFactorChallenge challenge = activeChallenge("hashed_code");
        challenge.markConsumed(NOW.minusSeconds(60));
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));

        assertThrows(TwoFactorChallengeInvalidException.class,
                () -> service.verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "123456")));

        verify(auditWriter).recordFailure(challenge.getId(), USER_ID, "CHALLENGE_CONSUMED", null, NOW);
    }

    @Test
    void verifyUnknownChallenge_throwsAndAudits() {
        UUID unknown = UUID.randomUUID();
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThrows(TwoFactorChallengeInvalidException.class,
                () -> service.verify(new VerifyTwoFactorCommand(unknown.toString(), "123456")));

        verify(auditWriter).recordFailure(unknown, null, "CHALLENGE_NOT_FOUND", null, NOW);
    }

    @Test
    void verifyMalformedToken_throwsAndAudits() {
        when(clockPort.now()).thenReturn(NOW);

        assertThrows(TwoFactorChallengeInvalidException.class,
                () -> service.verify(new VerifyTwoFactorCommand("not-a-uuid", "123456")));

        verify(auditWriter).recordFailure(null, null, "INVALID_CHALLENGE_TOKEN", null, NOW);
        verify(passwordEncoderPort, never()).matches(any(), any());
    }

    @Test
    void verifyMaxAttemptsExceeded_rejectsWithoutPasswordCheck() {
        TwoFactorChallenge challenge = activeChallenge("hashed_code");
        for (int i = 0; i < TwoFactorChallenge.MAX_ATTEMPTS; i++) {
            challenge.incrementAttempts();
        }
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));

        assertThrows(InvalidVerificationCodeException.class,
                () -> service.verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "123456")));

        verify(auditWriter).recordFailure(challenge.getId(), USER_ID, "MAX_ATTEMPTS_EXCEEDED", null, NOW);
        verify(passwordEncoderPort, never()).matches(any(), any());
        verify(jwtTokenPort, never()).generateToken(any(), any(), any(), any(), any());
    }

    @Test
    void verifyCorrectCodeAfterExhaustion_stillRejected() {
        TwoFactorChallenge challenge = activeChallenge("hashed_code");
        for (int i = 0; i < TwoFactorChallenge.MAX_ATTEMPTS; i++) {
            challenge.incrementAttempts();
        }
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));

        assertThrows(InvalidVerificationCodeException.class,
                () -> service.verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "123456")));

        verify(passwordEncoderPort, never()).matches(any(), any());
        verify(jwtTokenPort, never()).generateToken(any(), any(), any(), any(), any());
        verify(challengeRepository, never()).markConsumed(any(), any());
    }

    @Test
    void verifyDisabledAccount_rejectsAndAudits() {
        TwoFactorChallenge challenge = activeChallenge("hashed_code");
        User disabled = User.restore(USER_ID, "doctor1", "pw", "Doctor", "d@c.com", null, ROLE_ID, false, null, NOW);
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(passwordEncoderPort.matches("123456", "hashed_code")).thenReturn(true);
        when(challengeRepository.markConsumed(challenge.getId(), NOW)).thenReturn(1);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(disabled));

        assertThrows(com.benhsoan.domain.auth.exception.AccountDisabledException.class,
                () -> service.verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "123456")));

        verify(auditWriter).recordFailure(challenge.getId(), USER_ID, "ACCOUNT_DISABLED", null, NOW);
        verify(jwtTokenPort, never()).generateToken(any(), any(), any(), any(), any());
        verify(userSessionRepository, never()).save(any());
    }

    @Test
    void verifyConcurrentConsumptionConflict_audits() {
        TwoFactorChallenge challenge = activeChallenge("hashed_code");
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(passwordEncoderPort.matches("123456", "hashed_code")).thenReturn(true);
        when(challengeRepository.markConsumed(challenge.getId(), NOW)).thenReturn(0);

        assertThrows(TwoFactorChallengeInvalidException.class,
                () -> service.verify(new VerifyTwoFactorCommand(challenge.getId().toString(), "123456")));

        verify(auditWriter).recordFailure(challenge.getId(), USER_ID, "CONCURRENT_CONSUMPTION_CONFLICT", null, NOW);
        verify(jwtTokenPort, never()).generateToken(any(), any(), any(), any(), any());
    }

    @Test
    void issueChallenge_invalidatesPreviousChallenges() {
        User user = User.restore(USER_ID, "doctor1", "pw", "Doctor", "d@c.com", null, ROLE_ID, true, null, NOW);
        when(codeGeneratorPort.generate()).thenReturn("123456");
        when(passwordEncoderPort.encode("123456")).thenReturn("hashed_code");
        when(challengeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.issueChallenge(user, NOW);

        verify(challengeRepository).invalidatePendingChallengesByUserId(USER_ID, NOW);
        verify(codeDeliveryPort).sendVerificationCode("doctor1", "123456", 300L);
    }

    @Test
    void resend_firstResendAllowed() {
        TwoFactorChallenge challenge = activeChallenge("old_hash");
        User user = User.restore(USER_ID, "doctor1", "pw", "Doctor", "d@c.com", null, ROLE_ID, true, null, NOW);

        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(cooldownPort.isInCooldown(challenge.getId().toString(), NOW)).thenReturn(false);
        when(codeGeneratorPort.generate()).thenReturn("654321");
        when(passwordEncoderPort.encode("654321")).thenReturn("new_hash");
        when(challengeRepository.save(challenge)).thenReturn(challenge);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        TwoFactorResendResult result = service.resend(new ResendTwoFactorCommand(challenge.getId().toString()));

        assertEquals(challenge.getId(), result.twoFactorToken());
        assertEquals(NOW.plusSeconds(300), result.expiresAt());
        assertEquals("new_hash", challenge.getCodeHash());
        verify(cooldownPort).recordRequest(challenge.getId().toString(), NOW, 60L);
        verify(codeDeliveryPort).sendVerificationCode("doctor1", "654321", 300L);
    }

    @Test
    void resend_immediateSecondResendRejectedWithoutHashing() {
        TwoFactorChallenge challenge = activeChallenge("old_hash");
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(cooldownPort.isInCooldown(challenge.getId().toString(), NOW)).thenReturn(true);
        when(cooldownPort.getRemainingCooldownSeconds(challenge.getId().toString(), NOW)).thenReturn(45L);

        assertThrows(VerificationCodeCooldownException.class,
                () -> service.resend(new ResendTwoFactorCommand(challenge.getId().toString())));

        verify(codeGeneratorPort, never()).generate();
        verify(passwordEncoderPort, never()).encode(any());
        verify(challengeRepository, never()).save(any());
    }

    @Test
    void resend_afterCooldownAllowed() {
        TwoFactorChallenge challenge = activeChallenge("old_hash");
        Instant later = NOW.plusSeconds(61);
        User user = User.restore(USER_ID, "doctor1", "pw", "Doctor", "d@c.com", null, ROLE_ID, true, null, NOW);

        when(clockPort.now()).thenReturn(later);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(cooldownPort.isInCooldown(challenge.getId().toString(), later)).thenReturn(false);
        when(codeGeneratorPort.generate()).thenReturn("654321");
        when(passwordEncoderPort.encode("654321")).thenReturn("new_hash");
        when(challengeRepository.save(challenge)).thenReturn(challenge);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        TwoFactorResendResult result = service.resend(new ResendTwoFactorCommand(challenge.getId().toString()));

        assertEquals(challenge.getId(), result.twoFactorToken());
        assertEquals("new_hash", challenge.getCodeHash());
        verify(cooldownPort).recordRequest(challenge.getId().toString(), later, 60L);
    }

    @Test
    void resend_afterMaximumLifetimeRejected() {
        TwoFactorChallenge challenge = TwoFactorChallenge.create(USER_ID, "old_hash", NOW.plusSeconds(300),
                NOW.minusSeconds(TwoFactorChallenge.MAX_LIFETIME_SECONDS + 1));
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));

        assertThrows(TwoFactorChallengeInvalidException.class,
                () -> service.resend(new ResendTwoFactorCommand(challenge.getId().toString())));

        verify(codeGeneratorPort, never()).generate();
        verify(passwordEncoderPort, never()).encode(any());
    }

    @Test
    void resend_nearMaximumLifetimeCapsExpiry() {
        TwoFactorChallenge challenge = TwoFactorChallenge.create(USER_ID, "old_hash", NOW.plusSeconds(300),
                NOW.minusSeconds(TwoFactorChallenge.MAX_LIFETIME_SECONDS - 60));
        User user = User.restore(USER_ID, "doctor1", "pw", "Doctor", "d@c.com", null, ROLE_ID, true, null, NOW);

        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(cooldownPort.isInCooldown(challenge.getId().toString(), NOW)).thenReturn(false);
        when(codeGeneratorPort.generate()).thenReturn("654321");
        when(passwordEncoderPort.encode("654321")).thenReturn("new_hash");
        when(challengeRepository.save(challenge)).thenReturn(challenge);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        TwoFactorResendResult result = service.resend(new ResendTwoFactorCommand(challenge.getId().toString()));

        assertEquals(challenge.getCreatedAt().plusSeconds(TwoFactorChallenge.MAX_LIFETIME_SECONDS), result.expiresAt());
    }

    @Test
    void resendDoesNotResetCumulativeAttempts() {
        TwoFactorChallenge challenge = activeChallenge("old_hash");
        challenge.incrementAttempts();
        challenge.incrementAttempts();
        User user = User.restore(USER_ID, "doctor1", "pw", "Doctor", "d@c.com", null, ROLE_ID, true, null, NOW);

        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));
        when(cooldownPort.isInCooldown(challenge.getId().toString(), NOW)).thenReturn(false);
        when(codeGeneratorPort.generate()).thenReturn("654321");
        when(passwordEncoderPort.encode("654321")).thenReturn("new_hash");
        when(challengeRepository.save(challenge)).thenReturn(challenge);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.resend(new ResendTwoFactorCommand(challenge.getId().toString()));

        assertEquals(2, challenge.getAttempts(), "Resend must not reset the attempt counter");
    }

    @Test
    void resendConsumedChallenge_throws() {
        TwoFactorChallenge challenge = activeChallenge("old_hash");
        challenge.markConsumed(NOW.minusSeconds(60));
        when(clockPort.now()).thenReturn(NOW);
        when(challengeRepository.findById(challenge.getId())).thenReturn(Optional.of(challenge));

        assertThrows(TwoFactorChallengeInvalidException.class,
                () -> service.resend(new ResendTwoFactorCommand(challenge.getId().toString())));
    }
}
