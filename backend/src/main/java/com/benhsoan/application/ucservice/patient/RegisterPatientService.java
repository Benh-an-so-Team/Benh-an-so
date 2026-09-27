package com.benhsoan.application.ucservice.patient;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.PatientChangeLog;
import com.benhsoan.domain.patient.enums.PatientChangeAction;
import com.benhsoan.domain.patient.exception.PatientAlreadyExistsException;
import com.benhsoan.domain.patient.exception.PatientConsentRequiredException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.patient.RegisterPatientCommand;
import com.benhsoan.port.dto.result.PatientResult;
import com.benhsoan.port.inbound.patient.RegisterPatientUseCase;
import com.benhsoan.port.outbound.generator.PatientCodeGenerator;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.patient.PatientChangeLogRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;

@Service
@Transactional
public class RegisterPatientService
        implements RegisterPatientUseCase {

    private static final Pattern PHONE_PATTERN = Pattern.compile("^(0|\\+84)(3|5|7|8|9)[0-9]{8}$");

    private final PatientRepository patientRepository;

    private final PatientChangeLogRepository patientChangeLogRepository;

    private final PatientCodeGenerator patientCodeGenerator;

    private final CurrentUserPort currentUserPort;

    private final PatientChangeDetailBuilder changeDetailBuilder;

    private final PatientResultMapper patientResultMapper;

    private final AuditLogRepository auditLogRepository;

    private final com.benhsoan.port.outbound.repository.patient.PatientConsentHistoryRepository patientConsentHistoryRepository;

    private final ObjectMapper objectMapper;

    @Autowired
    public RegisterPatientService(
            PatientRepository patientRepository,
            PatientChangeLogRepository patientChangeLogRepository,
            PatientCodeGenerator patientCodeGenerator,
            CurrentUserPort currentUserPort,
            PatientChangeDetailBuilder changeDetailBuilder,
            PatientResultMapper patientResultMapper,
            AuditLogRepository auditLogRepository,
            com.benhsoan.port.outbound.repository.patient.PatientConsentHistoryRepository patientConsentHistoryRepository,
            ObjectMapper objectMapper) {
        this.patientRepository = patientRepository;
        this.patientChangeLogRepository = patientChangeLogRepository;
        this.patientCodeGenerator = patientCodeGenerator;
        this.currentUserPort = currentUserPort;
        this.changeDetailBuilder = changeDetailBuilder;
        this.patientResultMapper = patientResultMapper;
        this.auditLogRepository = auditLogRepository;
        this.patientConsentHistoryRepository = patientConsentHistoryRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public PatientResult register(RegisterPatientCommand command) {

        validate(command);

        UUID currentUserId = currentUserPort.getCurrentUserId();

        String patientCode = patientCodeGenerator.generate();

        boolean consentAgreed = Boolean.TRUE.equals(command.consentAgreed());

        String identityNumber = normalizeIdentityNumber(command.identityNumber());

        String emergencyContact = normalizeString(command.emergencyContact());
        String emergencyRelationship = normalizeString(command.emergencyRelationship());
        String emergencyPhone = normalizePhone(command.emergencyPhone());

        String guardianName = normalizeString(command.guardianName());
        String guardianRelationship = normalizeString(command.guardianRelationship());
        String guardianPhone = normalizePhone(command.guardianPhone());
        String guardianIdentityNumber = normalizeIdentityNumber(command.guardianIdentityNumber());
        String consentSignerName = normalizeString(command.consentSignerName());

        Patient patient = Patient.create(
                patientCode,
                command.fullName(),
                command.dateOfBirth(),
                command.gender(),
                normalizePhone(command.phone()),
                command.email(),
                command.address(),
                identityNumber,
                command.insuranceNumber(),
                command.bloodType(),
                emergencyContact,
                emergencyRelationship,
                emergencyPhone,
                guardianName,
                guardianRelationship,
                guardianPhone,
                guardianIdentityNumber,
                null,
                consentSignerName,
                consentAgreed,
                command.consentVersion(),
                currentUserId);

        Patient saved = patientRepository.save(patient);

        String changeDetail = changeDetailBuilder.forCreate(saved);

        PatientChangeLog log = PatientChangeLog.create(
                saved.getId(),
                currentUserId,
                PatientChangeAction.CREATE,
                changeDetail);

        patientChangeLogRepository.save(log);

        Map<String, Object> auditDetail = new LinkedHashMap<>();
        auditDetail.put("patientCode", saved.getPatientCode());
        auditDetail.put("fullName", saved.getFullName());
        auditDetail.put("guardianName", saved.getGuardianName());
        auditDetail.put("consentSignerName", saved.getConsentSignerName());
        auditDetail.put("consentAgreed", saved.isConsentAgreed());
        auditDetail.put("consentVersion", saved.getConsentVersion());

        auditLogRepository.save(
                AuditLog.create(
                        currentUserId,
                        ActionType.CREATE,
                        ResourceType.PATIENT,
                        saved.getId(),
                        toJson(auditDetail),
                        null,
                        saved.getCreatedAt() != null ? saved.getCreatedAt() : java.time.Instant.now()));

        if (saved.isConsentAgreed()) {
            com.benhsoan.domain.patient.PatientConsentRecord initialRecord = com.benhsoan.domain.patient.PatientConsentRecord
                    .create(
                            saved.getId(),
                            1,
                            saved.getConsentVersion() != null ? saved.getConsentVersion()
                                    : com.benhsoan.domain.patient.PatientConsentVersion.current(),
                            com.benhsoan.domain.patient.enums.ConsentHistoryStatus.AGREED,
                            com.benhsoan.domain.patient.enums.ConsentScope.defaultAll(),
                            saved.isConsentAgreed(),
                            saved.getConsentAgreedAt(),
                            false,
                            null,
                            null,
                            false,
                            saved.getConsentSignerName(),
                            currentUserId,
                            saved.getConsentAgreedAt() != null ? saved.getConsentAgreedAt() : java.time.Instant.now());
            patientConsentHistoryRepository.save(initialRecord);
        }

        return patientResultMapper.toResult(saved);
    }

    private String toJson(Map<String, Object> detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể serialize chi tiết kiểm toán đăng ký bệnh nhân.", exception);
        }
    }

    private void validate(RegisterPatientCommand command) {

        // QTN-24: Phải có phiếu đồng ý trước khi xử lý dữ liệu cá nhân
        if (command.consentAgreed() == null || !command.consentAgreed()) {
            throw new PatientConsentRequiredException("Phải có phiếu đồng ý trước khi xử lý dữ liệu cá nhân (QTN-24).");
        }

        String identityNumber = normalizeIdentityNumber(command.identityNumber());

        if (identityNumber != null
                && patientRepository.existsByIdentityNumber(identityNumber)) {

            throw new PatientAlreadyExistsException(
                    "identity number");
        }

        validateEmergencyContact(
                command.emergencyContact(),
                command.emergencyRelationship(),
                command.emergencyPhone());

        validateGuardian(command);
    }

    private void validateGuardian(RegisterPatientCommand command) {
        boolean isMinor = com.benhsoan.domain.patient.PatientMinorPolicy.isMinor(command.dateOfBirth());
        String guardianName = normalizeString(command.guardianName());
        String guardianRelationship = normalizeString(command.guardianRelationship());
        String guardianPhone = normalizePhone(command.guardianPhone());

        if (isMinor) {
            if (guardianName == null || guardianName.isBlank()) {
                throw new ValidationException("guardianName",
                        "Hồ sơ bệnh nhân dưới 18 tuổi bắt buộc phải khai báo người giám hộ (QTN-44).");
            }
            if (guardianRelationship == null || guardianRelationship.isBlank()) {
                throw new ValidationException("guardianRelationship",
                        "Mối quan hệ với người giám hộ không được để trống.");
            }
            if (guardianPhone == null || guardianPhone.isBlank()) {
                throw new ValidationException("guardianPhone", "Số điện thoại người giám hộ không được để trống.");
            }
            if (!PHONE_PATTERN.matcher(guardianPhone).matches()) {
                throw new ValidationException("guardianPhone", "Số điện thoại người giám hộ không đúng định dạng.");
            }
            String consentSignerName = normalizeString(command.consentSignerName());
            if (consentSignerName != null && !consentSignerName.isBlank()
                    && !consentSignerName.trim().equalsIgnoreCase(guardianName.trim())) {
                throw new ValidationException(
                        "consentSignerName",
                        "Đối với bệnh nhân chưa thành niên, người ký phiếu đồng ý bắt buộc phải là người giám hộ (QTN-44).");
            }
        } else {
            if (guardianPhone != null && !PHONE_PATTERN.matcher(guardianPhone).matches()) {
                throw new ValidationException("guardianPhone", "Số điện thoại người giám hộ không đúng định dạng.");
            }
        }
    }

    private void validateEmergencyContact(String contact, String relationship, String phone) {
        boolean hasContact = contact != null && !contact.isBlank();
        boolean hasRelationship = relationship != null && !relationship.isBlank();
        boolean hasPhone = phone != null && !phone.isBlank();

        if (hasContact || hasRelationship || hasPhone) {
            if (!hasContact) {
                throw new ValidationException("emergencyContact", "Họ tên người liên hệ khẩn cấp không được để trống.");
            }
            if (!hasRelationship) {
                throw new ValidationException("emergencyRelationship",
                        "Mối quan hệ với người liên hệ khẩn cấp không được để trống.");
            }
            if (!hasPhone) {
                throw new ValidationException("emergencyPhone",
                        "Số điện thoại người liên hệ khẩn cấp không được để trống.");
            }
            if (!PHONE_PATTERN.matcher(phone.trim()).matches()) {
                throw new ValidationException("emergencyPhone",
                        "Số điện thoại người liên hệ khẩn cấp không đúng định dạng.");
            }
        }
    }

    private String normalizeString(String val) {
        if (val == null || val.isBlank()) {
            return null;
        }
        return val.trim();
    }

    private String normalizeIdentityNumber(String identityNumber) {
        if (identityNumber == null || identityNumber.isBlank()) {
            return null;
        }
        return identityNumber.trim();
    }

    private String normalizePhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }

        String trimmed = phone.trim();

        return trimmed.startsWith("+84")
                ? "0" + trimmed.substring(3)
                : trimmed;
    }
}
