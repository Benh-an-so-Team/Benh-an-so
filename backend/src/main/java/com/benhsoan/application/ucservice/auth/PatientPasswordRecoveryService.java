package com.benhsoan.application.ucservice.auth;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.PasswordPolicyValidator;
import com.benhsoan.domain.auth.PatientPasswordRecoveryToken;
import com.benhsoan.domain.auth.Role;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.auth.exception.AccountDisabledException;
import com.benhsoan.domain.auth.exception.InvalidVerificationCodeException;
import com.benhsoan.domain.auth.exception.SamePasswordException;
import com.benhsoan.domain.auth.exception.VerificationCodeCooldownException;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.auth.PatientForgotPasswordCommand;
import com.benhsoan.port.dto.command.auth.PatientResetPasswordCommand;
import com.benhsoan.port.dto.command.auth.PatientVerifyRecoveryCodeCommand;
import com.benhsoan.port.dto.result.PatientForgotPasswordResult;
import com.benhsoan.port.dto.result.PatientResetPasswordResult;
import com.benhsoan.port.inbound.auth.PatientForgotPasswordUseCase;
import com.benhsoan.port.inbound.auth.PatientResetPasswordUseCase;
import com.benhsoan.port.inbound.auth.PatientVerifyRecoveryCodeUseCase;
import com.benhsoan.port.outbound.authSecurity.PasswordEncoderPort;
import com.benhsoan.port.outbound.authSecurity.VerificationCodeGeneratorPort;
import com.benhsoan.port.outbound.notification.PatientVerificationCodePort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.PatientPasswordRecoveryTokenRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service implementing patient portal password recovery (NCL-14-CN-006 / QTN-28, QTN-23, QTN-45, QTN-31).
 * Supports simulated OTP delivery, anti-enumeration (TC-03), expiration checks (TC-02),
 * brute-force attempt limits, password policy validation, session revocation, and audit logging (TC-04).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class PatientPasswordRecoveryService
        implements PatientForgotPasswordUseCase, PatientVerifyRecoveryCodeUseCase, PatientResetPasswordUseCase {

    public static final long TTL_SECONDS = 300; // 5 minutes
    public static final long COOLDOWN_SECONDS = 60; // 1 minute
    private static final String PATIENT_ROLE = "PATIENT";
    public static final String GENERIC_SUCCESS_MESSAGE =
            "Nếu số điện thoại đã được đăng ký tài khoản bệnh nhân, mã xác thực sẽ được gửi tới số điện thoại của bạn.";
    public static final String RESET_SUCCESS_MESSAGE =
            "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.";
    private static final Pattern VIETNAMESE_MOBILE =
            Pattern.compile("^(0|\\+84)(3|5|7|8|9)[0-9]{8}$");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PatientRepository patientRepository;
    private final UserSessionRepository userSessionRepository;
    private final PatientPasswordRecoveryTokenRepository tokenRepository;
    private final VerificationCodeGeneratorPort codeGeneratorPort;
    private final PatientVerificationCodePort verificationCodePort;
    private final PasswordEncoderPort passwordEncoderPort;
    private final AuditLogRepository auditLogRepository;
    private final ClockPort clockPort;
    private final ObjectMapper objectMapper;
    private final com.benhsoan.port.outbound.authSecurity.PatientRecoveryCooldownPort cooldownPort;
    private final PatientRecoverySecurityAuditWriter auditWriter;

    @org.springframework.beans.factory.annotation.Value("${app.sms.gateway.allow-unregistered-phone:false}")
    private boolean allowUnregisteredPhone;

    @Override
    public PatientForgotPasswordResult forgotPassword(PatientForgotPasswordCommand command) {
        String phone = normalizePhone(command.phone());
        Instant now = clockPort.now();

        // Cooldown check independent of phone existence (Finding 4 / TC-03)
        if (cooldownPort.isInCooldown(phone, now)) {
            long remainingSeconds = cooldownPort.getRemainingCooldownSeconds(phone, now);
            log.warn("[FORGOT PASSWORD] SĐT '{}' đang trong thời gian chờ gửi lại mã (cooldown). Còn lại: {} giây.", phone, remainingSeconds);
            throw new VerificationCodeCooldownException(remainingSeconds);
        }

        // Record cooldown immediately for this phone
        cooldownPort.recordRequest(phone, now, COOLDOWN_SECONDS);

        Optional<User> userOpt = userRepository.findByPhone(phone);
        User user;

        if (userOpt.isEmpty()) {
            java.util.List<Patient> candidates = patientRepository.findAllByPhone(phone);
            Role patientRole = roleRepository.findByName(PATIENT_ROLE).orElse(null);

            if (candidates != null && !candidates.isEmpty() && patientRole != null) {
                Patient candidate = candidates.stream()
                        .filter(p -> p.getUserId() == null)
                        .findFirst()
                        .orElse(candidates.get(0));

                User newUser = User.create(
                        phone,
                        passwordEncoderPort.encode(UUID.randomUUID().toString()),
                        candidate.getFullName() != null && !candidate.getFullName().isBlank() ? candidate.getFullName() : "Bệnh nhân",
                        candidate.getEmail() != null && !candidate.getEmail().isBlank() ? candidate.getEmail() : phone + "@benhsoan.vn",
                        phone,
                        patientRole.getId()
                );
                user = userRepository.save(newUser);
                if (candidate.getUserId() == null) {
                    candidate.linkUser(user.getId());
                    patientRepository.save(candidate);
                }
                log.info("[FORGOT PASSWORD] SĐT '{}' đã có hồ sơ y tế (Mã BN: {}). Tự động kích hoạt tài khoản cổng bệnh nhân và gửi mã OTP...",
                        phone, candidate.getPatientCode());
            } else if (allowUnregisteredPhone && patientRole != null) {
                User newUser = User.create(
                        phone,
                        passwordEncoderPort.encode(UUID.randomUUID().toString()),
                        "Bệnh nhân " + phone,
                        phone + "@benhsoan.vn",
                        phone,
                        patientRole.getId()
                );
                user = userRepository.save(newUser);
                log.info("[FORGOT PASSWORD] [TEST MODE] SĐT '{}' chưa đăng ký nhưng allowUnregisteredPhone=true. Tự động tạo tài khoản test và gửi mã OTP...", phone);
            } else {
                // Anti-enumeration protection (TC-03): balance timing with dummy password hash
                passwordEncoderPort.encode("DUMMY_CODE_" + phone);
                log.warn("[FORGOT PASSWORD] SĐT '{}' KHÔNG TỒN TẠI trong bảng tài khoản (users) -> Bỏ qua gửi SMS OTP (Chính sách Anti-enumeration).", phone);
                return new PatientForgotPasswordResult(GENERIC_SUCCESS_MESSAGE, TTL_SECONDS);
            }
        } else {
            user = userOpt.get();
        }

        // Enforce patient-only recovery: staff accounts cannot be reset via patient portal endpoint
        Role role = roleRepository.findById(user.getRoleId()).orElse(null);
        if (role == null || !PATIENT_ROLE.equalsIgnoreCase(role.getName())) {
            passwordEncoderPort.encode("DUMMY_CODE_" + phone);
            log.warn("[FORGOT PASSWORD] SĐT '{}' thuộc tài khoản (id={}, username={}) có vai trò '{}' (KHÔNG PHẢI PATIENT) -> Bỏ qua gửi SMS OTP.",
                    phone, user.getId(), user.getUsername(), role != null ? role.getName() : "NULL");
            return new PatientForgotPasswordResult(GENERIC_SUCCESS_MESSAGE, TTL_SECONDS);
        }

        if (!user.isActive()) {
            passwordEncoderPort.encode("DUMMY_CODE_" + phone);
            log.warn("[FORGOT PASSWORD] SĐT '{}' thuộc tài khoản bệnh nhân (id={}, username={}) đang BỊ VÔ HIỆU HÓA (active=false) -> Bỏ qua gửi SMS OTP.",
                    phone, user.getId(), user.getUsername());
            return new PatientForgotPasswordResult(GENERIC_SUCCESS_MESSAGE, TTL_SECONDS);
        }

        // Finding 4 (Replay Protection): Invalidate existing active tokens for this phone
        tokenRepository.invalidateActiveTokensByPhone(phone, now);

        String plainCode = codeGeneratorPort.generate();
        String codeHash = passwordEncoderPort.encode(plainCode);
        Instant expiresAt = now.plusSeconds(TTL_SECONDS);

        PatientPasswordRecoveryToken token = PatientPasswordRecoveryToken.create(
                user.getId(),
                phone,
                codeHash,
                expiresAt,
                now
        );
        tokenRepository.save(token);

        log.info("[FORGOT PASSWORD] Xác thực tài khoản bệnh nhân hợp lệ (id={}, username={}, phone={}). Đã tạo mã OTP (hiệu lực đến {}). Đang chuyển tới SMS Gateway để gửi tin nhắn...",
                user.getId(), user.getUsername(), phone, expiresAt);

        verificationCodePort.sendVerificationCode(phone, plainCode, TTL_SECONDS);

        return new PatientForgotPasswordResult(GENERIC_SUCCESS_MESSAGE, TTL_SECONDS);
    }

    @Override
    public void verifyCode(PatientVerifyRecoveryCodeCommand command) {
        String phone = normalizePhone(command.phone());
        Instant now = clockPort.now();

        PatientPasswordRecoveryToken token = tokenRepository.findLatestActiveByPhone(phone)
                .orElseThrow(InvalidVerificationCodeException::new);

        if (token.isExpired(now)) {
            // Finding 5: Prevent enumeration by returning unified invalid code error
            throw new InvalidVerificationCodeException("Mã xác thực không chính xác hoặc đã hết hạn.");
        }

        if (token.isAttemptsExceeded()) {
            throw new InvalidVerificationCodeException(
                    "Mã xác thực đã bị vô hiệu hóa do nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới.");
        }

        if (!passwordEncoderPort.matches(command.code(), token.getCodeHash())) {
            // Finding 1 & 3 & 6: Increment attempts and audit in REQUIRES_NEW transaction
            auditWriter.recordFailedAttemptAndAudit(token, token.getUserId(), phone, null, now);
            throw new InvalidVerificationCodeException();
        }
    }

    @Override
    public PatientResetPasswordResult resetPassword(PatientResetPasswordCommand command) {
        String phone = normalizePhone(command.phone());
        Instant now = clockPort.now();

        PatientPasswordRecoveryToken token = tokenRepository.findLatestActiveByPhone(phone)
                .orElseThrow(InvalidVerificationCodeException::new);

        if (token.isExpired(now)) {
            // Finding 5: Prevent enumeration by returning unified invalid code error
            throw new InvalidVerificationCodeException("Mã xác thực không chính xác hoặc đã hết hạn.");
        }

        if (token.isAttemptsExceeded()) {
            throw new InvalidVerificationCodeException(
                    "Mã xác thực đã bị vô hiệu hóa do nhập sai quá số lần cho phép. Vui lòng yêu cầu mã mới.");
        }

        // Finding 5: Validate OTP BEFORE inspecting user to prevent enumeration of disabled accounts
        if (!passwordEncoderPort.matches(command.code(), token.getCodeHash())) {
            // Finding 1 & 6: Increment attempts and audit in REQUIRES_NEW transaction
            auditWriter.recordFailedAttemptAndAudit(token, token.getUserId(), phone, command.ipAddress(), now);
            throw new InvalidVerificationCodeException();
        }

        User user = userRepository.findByPhone(phone)
                .orElseThrow(InvalidVerificationCodeException::new);

        // Finding 7: Enforce PATIENT role validation (Defense in Depth)
        Role role = roleRepository.findById(user.getRoleId()).orElse(null);
        if (role == null || !PATIENT_ROLE.equalsIgnoreCase(role.getName())) {
            log.warn("Password reset attempted via patient portal for non-patient role user: {}", user.getId());
            throw new InvalidVerificationCodeException();
        }

        if (!user.isActive()) {
            throw new AccountDisabledException();
        }

        // QTN-28 password strength policy
        PasswordPolicyValidator.validateOrThrow(command.newPassword());

        if (passwordEncoderPort.matches(command.newPassword(), user.getPasswordHash())) {
            throw new SamePasswordException();
        }

        // Mark token as used to prevent replay
        token.markUsed(now);
        tokenRepository.save(token);

        // Finding 4: Invalidate all active tokens for this phone
        tokenRepository.invalidateActiveTokensByPhone(phone, now);

        // Clear cooldown once successfully reset
        cooldownPort.clearCooldown(phone);

        // Update password (mustChangePassword is set to false because user self-chose new password)
        user.changePassword(passwordEncoderPort.encode(command.newPassword()));
        userRepository.save(user);

        // QTN-45: revoke all existing sessions
        userSessionRepository.revokeByUserId(user.getId(), now);

        // QTN-31: audit logging
        UUID patientId = patientRepository.findByUserId(user.getId())
                .map(Patient::getId)
                .orElse(null);

        auditLogRepository.save(AuditLog.create(
                user.getId(),
                ActionType.RESET_PASSWORD,
                ResourceType.PATIENT_PORTAL,
                patientId != null ? patientId : user.getId(),
                auditDetail(user, patientId, phone, command, now),
                command.ipAddress(),
                now
        ));

        return new PatientResetPasswordResult(RESET_SUCCESS_MESSAGE);
    }

    private String normalizePhone(String phone) {
        if (phone == null || phone.isBlank()) {
            throw new ValidationException("Phone number is required.");
        }

        String trimmed = phone.trim();

        if (!VIETNAMESE_MOBILE.matcher(trimmed).matches()) {
            throw new ValidationException("Số điện thoại không hợp lệ.");
        }

        return trimmed.startsWith("+84")
                ? "0" + trimmed.substring(3)
                : trimmed;
    }

    private String auditDetail(
            User user,
            UUID patientId,
            String phone,
            PatientResetPasswordCommand command,
            Instant now
    ) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("userId", user.getId().toString());
        detail.put("username", user.getUsername());
        detail.put("phone", phone);
        detail.put("patientId", patientId != null ? patientId.toString() : null);
        detail.put("action", "PATIENT_PASSWORD_RECOVERY_SUCCESS");
        detail.put("ipAddress", command.ipAddress());
        detail.put("userAgent", command.userAgent());
        detail.put("resetAt", now.toString());
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize patient password recovery audit detail.", exception);
        }
    }
}
