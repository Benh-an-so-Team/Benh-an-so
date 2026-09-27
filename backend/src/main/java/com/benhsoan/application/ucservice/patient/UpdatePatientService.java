package com.benhsoan.application.ucservice.patient;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.Role;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.PatientAnonymizer;
import com.benhsoan.domain.patient.PatientChangeLog;
import com.benhsoan.domain.patient.PatientConsentVersion;
import com.benhsoan.domain.patient.enums.PatientChangeAction;
import com.benhsoan.domain.patient.exception.PatientAlreadyExistsException;
import com.benhsoan.domain.patient.exception.PatientConsentAccessDeniedException;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.patient.UpdatePatientCommand;
import com.benhsoan.port.dto.result.PatientResult;
import com.benhsoan.port.inbound.patient.UpdatePatientUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.patient.PatientChangeLogRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;

import org.springframework.beans.factory.annotation.Autowired;

@Service
@Transactional
public class UpdatePatientService
        implements UpdatePatientUseCase {

    private static final String PATIENT_ROLE = "PATIENT";

    private static final java.util.regex.Pattern PHONE_PATTERN = java.util.regex.Pattern
            .compile("^(0|\\+84)(3|5|7|8|9)[0-9]{8}$");

    private final PatientRepository patientRepository;

    private final PatientChangeLogRepository patientChangeLogRepository;

    private final CurrentUserPort currentUserPort;

    private final PatientResultMapper patientResultMapper;

    private final PatientChangeDetailBuilder changeDetailBuilder;

    private final AuditLogRepository auditLogRepository;

    private final com.benhsoan.port.outbound.repository.patient.PatientConsentHistoryRepository patientConsentHistoryRepository;

    private final com.benhsoan.port.outbound.time.ClockPort clockPort;

    private final UserRepository userRepository;

    private final RoleRepository roleRepository;

    @Autowired
    public UpdatePatientService(
            PatientRepository patientRepository,
            PatientChangeLogRepository patientChangeLogRepository,
            CurrentUserPort currentUserPort,
            PatientResultMapper patientResultMapper,
            PatientChangeDetailBuilder changeDetailBuilder,
            AuditLogRepository auditLogRepository,
            com.benhsoan.port.outbound.repository.patient.PatientConsentHistoryRepository patientConsentHistoryRepository,
            com.benhsoan.port.outbound.time.ClockPort clockPort,
            UserRepository userRepository,
            RoleRepository roleRepository) {
        this.patientRepository = patientRepository;
        this.patientChangeLogRepository = patientChangeLogRepository;
        this.currentUserPort = currentUserPort;
        this.patientResultMapper = patientResultMapper;
        this.changeDetailBuilder = changeDetailBuilder;
        this.auditLogRepository = auditLogRepository;
        this.patientConsentHistoryRepository = patientConsentHistoryRepository;
        this.clockPort = clockPort;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
    }

    @Override
    public PatientResult update(UUID patientId, UpdatePatientCommand command) {

        Patient patient = patientRepository.findByIdForUpdate(patientId)
                .orElseThrow(() -> new PatientNotFoundException(patientId));

        patient.validateCanBeUpdated();

        validate(
                patientId,
                command);

        Patient oldPatient = Patient.restore(
                patient.getId(),
                patient.getPatientCode(),
                patient.getFullName(),
                patient.getDateOfBirth(),
                patient.getGender(),
                patient.getPhone(),
                patient.getEmail(),
                patient.getAddress(),
                patient.getIdentityNumber(),
                patient.getInsuranceNumber(),
                patient.getBloodType(),
                patient.getEmergencyContact(),
                patient.getEmergencyRelationship(),
                patient.getEmergencyPhone(),
                patient.getGuardianName(),
                patient.getGuardianRelationship(),
                patient.getGuardianPhone(),
                patient.getGuardianIdentityNumber(),
                patient.getGuardianUserId(),
                patient.getConsentSignerName(),
                patient.isActive(),
                patient.getCreatedAt(),
                patient.getUpdatedAt(),
                patient.getUserId(),
                patient.getCreatedBy(),
                patient.isConsentAgreed(),
                patient.getConsentAgreedAt(),
                patient.getConsentVersion(),
                patient.isConsentWithdrawn(),
                patient.getConsentWithdrawnAt(),
                patient.getConsentWithdrawnReason(),
                patient.isNonMedicalUseRestricted());

        UUID currentUserId = currentUserPort.getCurrentUserId();
        Instant now = clockPort != null ? clockPort.now() : Instant.now();

        // NCL-15-CN-003: never persist anonymized identity values back as real
        // patient data. If a client round-trips a masked value (only possible
        // when anonymization mode was ON at read time), keep the existing value.
        String fullName = command.fullName();
        String phone = command.phone();
        String address = command.address();
        String emergencyContact = command.emergencyContact();
        String emergencyRelationship = command.emergencyRelationship();
        String emergencyPhone = command.emergencyPhone();
        String guardianName = command.guardianName();
        String guardianRelationship = command.guardianRelationship();
        String guardianPhone = command.guardianPhone();
        String guardianIdentityNumber = command.guardianIdentityNumber();
        String consentSignerName = command.consentSignerName();

        if (PatientAnonymizer.isMaskedFullName(fullName)) {
            fullName = patient.getFullName();
        }
        if (PatientAnonymizer.isMaskedPhone(phone)) {
            phone = patient.getPhone();
        }
        if (PatientAnonymizer.isMaskedAddress(address)) {
            address = patient.getAddress();
        }
        if (PatientAnonymizer.isMaskedFullName(emergencyContact)) {
            emergencyContact = patient.getEmergencyContact();
        }
        if (PatientAnonymizer.isMaskedPhone(emergencyPhone)) {
            emergencyPhone = patient.getEmergencyPhone();
        }
        if (PatientAnonymizer.isMaskedFullName(guardianName) || PatientAnonymizer.isMaskedGuardianName(guardianName)) {
            guardianName = patient.getGuardianName();
        }
        if (PatientAnonymizer.isMaskedPhone(guardianPhone)) {
            guardianPhone = patient.getGuardianPhone();
        }
        if (PatientAnonymizer.isMaskedFullName(consentSignerName)
                || PatientAnonymizer.isMaskedGuardianName(consentSignerName)) {
            consentSignerName = patient.getConsentSignerName();
        }

        boolean transitionToAdult = Boolean.TRUE.equals(command.transitionToAdult());

        if (fullName != null) {
            emergencyContact = normalizeString(emergencyContact);
            emergencyRelationship = normalizeString(emergencyRelationship);
            emergencyPhone = normalizePhone(emergencyPhone);

            guardianName = normalizeString(guardianName);
            guardianRelationship = normalizeString(guardianRelationship);
            guardianPhone = normalizePhone(guardianPhone);
            guardianIdentityNumber = normalizeIdentityNumber(guardianIdentityNumber);
            consentSignerName = normalizeString(consentSignerName);

            validateEmergencyContact(emergencyContact, emergencyRelationship, emergencyPhone);

            LocalDate targetDob = command.dateOfBirth() != null ? command.dateOfBirth() : patient.getDateOfBirth();
            boolean isMinor = com.benhsoan.domain.patient.PatientMinorPolicy.isMinor(targetDob);

            if (transitionToAdult) {
                if (isMinor) {
                    throw new ValidationException(
                            "transitionToAdult",
                            "Bệnh nhân chưa đủ 18 tuổi, không thể chuyển sang tự chịu trách nhiệm.");
                }
                guardianName = null;
                guardianRelationship = null;
                guardianPhone = null;
                guardianIdentityNumber = null;
                consentSignerName = fullName;
            } else if (isMinor) {
                if (guardianName == null || guardianName.isBlank()) {
                    throw new ValidationException(
                            "guardianName",
                            "Hồ sơ bệnh nhân dưới 18 tuổi bắt buộc phải khai báo người giám hộ (QTN-44).");
                }
                if (guardianRelationship == null || guardianRelationship.isBlank()) {
                    throw new ValidationException(
                            "guardianRelationship",
                            "Mối quan hệ với người giám hộ không được để trống.");
                }
                if (guardianPhone == null || guardianPhone.isBlank()) {
                    throw new ValidationException(
                            "guardianPhone",
                            "Số điện thoại người giám hộ không được để trống.");
                }
                if (!PHONE_PATTERN.matcher(guardianPhone).matches()) {
                    throw new ValidationException(
                            "guardianPhone",
                            "Số điện thoại người giám hộ không đúng định dạng.");
                }
                if (consentSignerName != null && !consentSignerName.isBlank()
                        && !consentSignerName.trim().equalsIgnoreCase(guardianName.trim())) {
                    throw new ValidationException(
                            "consentSignerName",
                            "Đối với bệnh nhân chưa thành niên, người ký phiếu đồng ý bắt buộc phải là người giám hộ (QTN-44).");
                }
                if (consentSignerName == null || consentSignerName.isBlank()) {
                    consentSignerName = guardianName;
                }
            } else {
                boolean hadGuardian = patient.getGuardianName() != null && !patient.getGuardianName().isBlank();
                if (hadGuardian && (guardianName == null || guardianName.isBlank()) && !transitionToAdult) {
                    throw new ValidationException(
                            "transitionToAdult",
                            "Bệnh nhân đã đủ 18 tuổi. Việc gỡ bỏ người giám hộ yêu cầu kích hoạt quy trình chuyển tiếp thành niên (transitionToAdult = true) để ký gia hạn phiếu đồng ý mới (TC-04).");
                }
                if (guardianPhone != null && !guardianPhone.isBlank()
                        && !PHONE_PATTERN.matcher(guardianPhone).matches()) {
                    throw new ValidationException(
                            "guardianPhone",
                            "Số điện thoại người giám hộ không đúng định dạng.");
                }
                if (consentSignerName == null || consentSignerName.isBlank()) {
                    consentSignerName = guardianName != null && !guardianName.isBlank() ? guardianName : fullName;
                }
            }

            UUID guardianUserId = transitionToAdult
                    ? null
                    : resolveGuardianUserId(patient, command.guardianUserId());

            patient.updateProfile(
                    fullName,
                    command.dateOfBirth(),
                    command.gender(),
                    phone,
                    command.email(),
                    address,
                    normalizeIdentityNumber(command.identityNumber()),
                    command.insuranceNumber(),
                    command.bloodType(),
                    emergencyContact,
                    emergencyRelationship,
                    emergencyPhone,
                    guardianName,
                    guardianRelationship,
                    guardianPhone,
                    guardianIdentityNumber,
                    guardianUserId,
                    consentSignerName);

            if (transitionToAdult) {
                patient.transitionToAdult();
            }

            if (command.active() && !patient.isActive()) {
                patient.activate();
            }

            if (!command.active() && patient.isActive()) {
                patient.deactivate();
            }
        }

        // Handle consent withdrawal (NCL-15-CN-001-TC-03) or renewal
        boolean isChangingWithdrawal = command.consentWithdrawn() != null
                && command.consentWithdrawn() != patient.isConsentWithdrawn();
        boolean isChangingAgreement = command.consentAgreed() != null
                && command.consentAgreed() != patient.isConsentAgreed();
        boolean isChangingVersion = command.consentVersion() != null
                && !Objects.equals(command.consentVersion(), patient.getConsentVersion());
        boolean isChangingWithdrawReason = command.consentWithdrawnReason() != null
                && !Objects.equals(command.consentWithdrawnReason(), patient.getConsentWithdrawnReason());
        boolean isChangingScopes = command.scopes() != null;

        boolean isModifyingConsent = isChangingWithdrawal
                || isChangingAgreement
                || isChangingVersion
                || isChangingWithdrawReason
                || isChangingScopes;

        if (isModifyingConsent) {
            if (!currentUserPort.hasPermission("PATIENT_CONSENT_UPDATE")) {
                throw new PatientConsentAccessDeniedException();
            }
        }

        if (Boolean.FALSE.equals(command.consentAgreed())
                && !Boolean.TRUE.equals(command.consentWithdrawn())) {
            throw new ValidationException(
                    "consentAgreed=false requires consentWithdrawn=true to withdraw consent.");
        }

        if (Boolean.TRUE.equals(command.consentWithdrawn())) {
            if (!patient.isConsentWithdrawn()) {
                patient.withdrawConsent(command.consentWithdrawnReason(), now);
            } else if (command.consentWithdrawnReason() != null
                    && !Objects.equals(command.consentWithdrawnReason(), patient.getConsentWithdrawnReason())) {
                patient.withdrawConsent(command.consentWithdrawnReason(), patient.getConsentWithdrawnAt());
            }
        } else if (Boolean.FALSE.equals(command.consentWithdrawn()) && patient.isConsentWithdrawn()) {
            if (!Boolean.TRUE.equals(command.consentAgreed())) {
                throw new ValidationException(
                        "Phải ghi nhận sự đồng ý mới trước khi gia hạn xử lý dữ liệu cá nhân (QTN-24).");
            }
            patient.renewConsent(PatientConsentVersion.requireSupported(command.consentVersion()), now);
            if (command.scopes() != null) {
                boolean nonMedicalRestricted = !command.scopes()
                        .contains(com.benhsoan.domain.patient.enums.ConsentScope.COMMUNICATION)
                        && !command.scopes().contains(com.benhsoan.domain.patient.enums.ConsentScope.RESEARCH);
                patient.updateConsentScope(nonMedicalRestricted, now);
            }
        } else if (Boolean.TRUE.equals(command.consentAgreed()) && !patient.isConsentAgreed()) {
            patient.renewConsent(PatientConsentVersion.requireSupported(command.consentVersion()), now);
            if (command.scopes() != null) {
                boolean nonMedicalRestricted = !command.scopes()
                        .contains(com.benhsoan.domain.patient.enums.ConsentScope.COMMUNICATION)
                        && !command.scopes().contains(com.benhsoan.domain.patient.enums.ConsentScope.RESEARCH);
                patient.updateConsentScope(nonMedicalRestricted, now);
            }
        } else if (command.scopes() != null) {
            boolean nonMedicalRestricted = !command.scopes()
                    .contains(com.benhsoan.domain.patient.enums.ConsentScope.COMMUNICATION)
                    && !command.scopes().contains(com.benhsoan.domain.patient.enums.ConsentScope.RESEARCH);
            patient.updateConsentScope(nonMedicalRestricted, now);
        }

        if (isModifyingConsent) {
            int nextVersion = patientConsentHistoryRepository.getNextVersionNumber(patient.getId());
            com.benhsoan.domain.patient.enums.ConsentHistoryStatus status = patient.isConsentWithdrawn()
                    ? com.benhsoan.domain.patient.enums.ConsentHistoryStatus.WITHDRAWN
                    : (patient.isNonMedicalUseRestricted()
                            ? com.benhsoan.domain.patient.enums.ConsentHistoryStatus.PARTIALLY_WITHDRAWN
                            : com.benhsoan.domain.patient.enums.ConsentHistoryStatus.AGREED);
            java.util.Set<com.benhsoan.domain.patient.enums.ConsentScope> scopes = command.scopes() != null
                    ? command.scopes()
                    : (patient.isConsentWithdrawn() ? java.util.Collections.emptySet()
                            : (patient.isNonMedicalUseRestricted()
                                    ? java.util.EnumSet.of(com.benhsoan.domain.patient.enums.ConsentScope.TREATMENT)
                                    : com.benhsoan.domain.patient.enums.ConsentScope.defaultAll()));

            com.benhsoan.domain.patient.PatientConsentRecord historyRecord = com.benhsoan.domain.patient.PatientConsentRecord
                    .create(
                            patient.getId(),
                            nextVersion,
                            patient.getConsentVersion() != null ? patient.getConsentVersion()
                                    : PatientConsentVersion.current(),
                            status,
                            scopes,
                            patient.isConsentAgreed(),
                            patient.getConsentAgreedAt(),
                            patient.isConsentWithdrawn(),
                            patient.getConsentWithdrawnAt(),
                            patient.getConsentWithdrawnReason(),
                            patient.isNonMedicalUseRestricted(),
                            patient.getConsentSignerName(),
                            currentUserId,
                            now);
            patientConsentHistoryRepository.save(historyRecord);
        }

        String detail = changeDetailBuilder.forUpdate(oldPatient, patient);

        Patient updatedPatient = patientRepository.save(patient);

        PatientChangeLog log = PatientChangeLog.create(
                updatedPatient.getId(),
                currentUserId,
                PatientChangeAction.UPDATE,
                detail);
        patientChangeLogRepository.save(log);

        auditLogRepository.save(
                AuditLog.create(
                        currentUserId,
                        ActionType.UPDATE,
                        ResourceType.PATIENT,
                        updatedPatient.getId(),
                        """
                                {
                                "patientCode":"%s",
                                "fullName":"%s",
                                "guardianName":"%s",
                                "consentSignerName":"%s",
                                "consentAgreed":%s,
                                "consentVersion":"%s",
                                "consentWithdrawn":%s,
                                "nonMedicalUseRestricted":%s
                                }
                                """
                                .formatted(
                                        patient.getPatientCode(),
                                        patient.getFullName(),
                                        patient.getGuardianName(),
                                        patient.getConsentSignerName(),
                                        patient.isConsentAgreed(),
                                        patient.getConsentVersion(),
                                        patient.isConsentWithdrawn(),
                                        patient.isNonMedicalUseRestricted()),
                        null,
                        now));

        return patientResultMapper.toResult(updatedPatient);
    }

    /**
     * NCL-14-CN-010: a guardian link is only ever written by a staff actor holding
     * PATIENT_UPDATE (enforced by {@code @RequirePermission} on the controller).
     * Omitting the
     * field preserves the stored value, so a client can never silently clear a
     * guardian, and
     * a patient-portal account cannot reach this code path at all.
     */
    private UUID resolveGuardianUserId(Patient patient, UUID requestedGuardianUserId) {
        if (requestedGuardianUserId == null) {
            return patient.getGuardianUserId();
        }

        return validateGuardianUser(patient, requestedGuardianUserId);
    }

    private UUID validateGuardianUser(Patient patient, UUID guardianUserId) {
        // QTN-44: a guardian link is only meaningful for a minor. Reject an adult
        // target before
        // any other check, and reuse the canonical patient lifecycle/age policy.
        if (!patient.isMinor()) {
            throw new ValidationException(
                    "guardianUserId",
                    "Chỉ hồ sơ bệnh nhân chưa thành niên mới được gán người giám hộ (QTN-44).");
        }

        if (guardianUserId.equals(patient.getUserId())) {
            throw new ValidationException(
                    "guardianUserId",
                    "Người giám hộ không thể là chính tài khoản của bệnh nhân.");
        }

        User guardian = userRepository.findById(guardianUserId)
                .orElseThrow(() -> new ValidationException(
                        "guardianUserId",
                        "Không tìm thấy tài khoản người giám hộ."));

        if (!guardian.isActive()) {
            throw new ValidationException(
                    "guardianUserId",
                    "Tài khoản người giám hộ đã bị vô hiệu hóa.");
        }

        Role patientRole = roleRepository.findByName(PATIENT_ROLE)
                .orElseThrow(() -> new IllegalStateException("PATIENT role is not configured."));

        if (!patientRole.getId().equals(guardian.getRoleId())) {
            throw new ValidationException(
                    "guardianUserId",
                    "Tài khoản người giám hộ phải thuộc vai trò bệnh nhân (PATIENT).");
        }

        // Cycle guard (1 level, BR-06): the prospective guardian's portal account must
        // not
        // already be guarded by THIS patient's portal account. Both sides of the
        // comparison are
        // users.id values -- guardianUserId references users(id), and the patient's
        // account is
        // patient.getUserId(), never patient.getId(). Comparing the guardian's userId
        // against
        // the patient's patientId could never match and silently disabled this guard.
        Patient guardianProfile = patientRepository.findByUserId(guardianUserId).orElse(null);

        if (guardianProfile != null
                && guardianProfile.getGuardianUserId() != null
                && guardianProfile.getGuardianUserId().equals(patient.getUserId())) {
            throw new ValidationException(
                    "guardianUserId",
                    "Không thể tạo liên kết giám hộ vòng giữa hai hồ sơ.");
        }

        return guardianUserId;
    }

    private void validate(
            UUID patientId,
            UpdatePatientCommand command) {

        String identityNumber = normalizeIdentityNumber(command.identityNumber());

        if (identityNumber != null
                && patientRepository.existsByIdentityNumberAndIdNot(
                        identityNumber,
                        patientId)) {

            throw new PatientAlreadyExistsException(
                    "Identity number");
        }
    }

    private String normalizeIdentityNumber(String identityNumber) {
        if (identityNumber == null || identityNumber.isBlank()) {
            return null;
        }
        return identityNumber.trim();
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
