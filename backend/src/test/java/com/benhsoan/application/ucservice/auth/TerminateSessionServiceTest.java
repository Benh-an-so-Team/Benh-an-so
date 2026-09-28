package com.benhsoan.application.ucservice.auth;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.domain.auth.UserSession;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.auth.TerminateSessionCommand;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
@DisplayName("TerminateSessionService Tests")
class TerminateSessionServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-24T08:00:00Z");

    @Mock
    private UserSessionRepository userSessionRepository;
    @Mock
    private SessionAuditWriter sessionAuditWriter;
    @Mock
    private CurrentUserPort currentUserPort;
    @Mock
    private ClockPort clockPort;

    private TerminateSessionService service;

    @BeforeEach
    void setUp() {
        service = new TerminateSessionService(
                userSessionRepository,
                sessionAuditWriter,
                currentUserPort,
                clockPort);
    }

    @Test
    @DisplayName("Admin ngắt phiên từ xa thành công và ghi nhật ký kiểm toán")
    void terminateSessionSuccess() {
        UUID sessionId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();

        UserSession session = UserSession.restore(
                sessionId, userId, "hash", null,
                NOW.plus(Duration.ofDays(7)), NOW, NOW, null);

        when(clockPort.now()).thenReturn(NOW);
        when(currentUserPort.getCurrentUserId()).thenReturn(adminId);
        when(userSessionRepository.findById(sessionId)).thenReturn(Optional.of(session));

        TerminateSessionCommand command = new TerminateSessionCommand(sessionId, "Suspicious workstation");
        service.terminateSession(command);

        assertTrue(session.isRevoked());
        verify(userSessionRepository).save(session);
        verify(sessionAuditWriter).writeTerminationAudit(
                eq(adminId),
                eq(sessionId),
                eq(userId),
                eq("Suspicious workstation"),
                eq(NOW));
    }

    @Test
    @DisplayName("Ném ValidationException khi không tìm thấy phiên")
    void terminateSessionNotFoundThrowsValidationException() {
        UUID sessionId = UUID.randomUUID();
        when(userSessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        TerminateSessionCommand command = new TerminateSessionCommand(sessionId);
        assertThrows(ValidationException.class, () -> service.terminateSession(command));
    }
}
