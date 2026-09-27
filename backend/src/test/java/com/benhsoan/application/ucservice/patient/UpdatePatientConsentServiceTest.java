package com.benhsoan.application.ucservice.patient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.patient.enums.Gender;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.PatientConsentRecord;
import com.benhsoan.domain.patient.enums.BloodType;
import com.benhsoan.domain.patient.enums.ConsentHistoryStatus;
import com.benhsoan.domain.patient.enums.ConsentScope;
import com.benhsoan.domain.patient.exception.PatientConsentAccessDeniedException;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.patient.UpdatePatientConsentCommand;
import com.benhsoan.port.dto.result.PatientResult;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.patient.PatientChangeLogRepository;
import com.benhsoan.port.outbound.repository.patient.PatientConsentHistoryRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("UpdatePatientConsentService Unit Tests (NCL-15-CN-005 / AC-01, QTN-24)")
class UpdatePatientConsentServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-23T10:00:00Z");

    @Mock
    private PatientRepository patientRepository;
    @Mock
    private PatientConsentHistoryRepository patientConsentHistoryRepository;
    @Mock
    private CurrentUserPort currentUserPort;
    @Mock
    private ClockPort clockPort;
    @Mock
    private AuditLogRepository auditLogRepository;
    @Mock
    private PatientChangeLogRepository patientChangeLogRepository;
    @Mock
    private PatientAccessGuard patientAccessGuard;

    private UpdatePatientConsentService service;
    private final UUID currentUserId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        PatientResultMapper patientResultMapper = new PatientResultMapper();
        PatientChangeDetailBuilder changeDetailBuilder = new PatientChangeDetailBuilder(new ObjectMapper());

        service = new UpdatePatientConsentService(
                patientRepository,
                patientConsentHistoryRepository,
                currentUserPort,
                clockPort,
                auditLogRepository,
                patientChangeLogRepository,
                changeDetailBuilder,
                patientResultMapper,
                patientAccessGuard,
                new ObjectMapper());
    }

    private Patient createTestPatient(UUID patientId) {
        return Patient.restore(
                patientId,
                "PAT-2026-0001",
                "Nguyễn Văn An",
                LocalDate.of(1990, 5, 20),
                Gender.MALE,
                "0901234567",
                "an@example.com",
                "123 Hoàng Hoa Thám, Ba Đình, Hà Nội",
                "001090000001",
                "DN4010123456789",
                BloodType.O_POSITIVE,
                "Nguyễn Văn Bình",
                "Bố",
                "0901234568",
                null, null, null, null, null,
                "Nguyễn Văn An",
                true,
                NOW.minusSeconds(86400),
                NOW.minusSeconds(86400),
                null,
                currentUserId,
                true,
                NOW.minusSeconds(86400),
                "v1.0",
                false,
                null,
                null,
                false);
    }

    @Test
    @DisplayName("AC-01: Thu hẹp phạm vi đồng ý - chỉ giữ lại TREATMENT, hạn chế ngoài y tế")
    void narrowScopeToTreatmentOnly_success() {
        UUID patientId = UUID.randomUUID();
        Patient patient = createTestPatient(patientId);

        when(currentUserPort.getCurrentUserId()).thenReturn(currentUserId);
        when(currentUserPort.hasPermission("PATIENT_CONSENT_UPDATE")).thenReturn(true);
        when(clockPort.now()).thenReturn(NOW);
        when(patientRepository.findByIdForUpdate(patientId)).thenReturn(Optional.of(patient));
        when(patientRepository.save(any(Patient.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(patientConsentHistoryRepository.getNextVersionNumber(patientId)).thenReturn(2);

        UpdatePatientConsentCommand command = UpdatePatientConsentCommand.builder()
                .scopes(EnumSet.of(ConsentScope.TREATMENT))
                .build();

        PatientResult result = service.updateConsent(patientId, command);

        assertNotNull(result);
        assertTrue(result.nonMedicalUseRestricted());
        assertFalse(result.consentWithdrawn());

        // Kiểm tra lưu lịch sử
        ArgumentCaptor<PatientConsentRecord> historyCaptor = ArgumentCaptor.forClass(PatientConsentRecord.class);
        verify(patientConsentHistoryRepository).save(historyCaptor.capture());
        PatientConsentRecord savedRecord = historyCaptor.getValue();
        assertEquals(2, savedRecord.getVersionNumber());
        assertEquals(ConsentHistoryStatus.PARTIALLY_WITHDRAWN, savedRecord.getStatus());
        assertEquals(Set.of(ConsentScope.TREATMENT), savedRecord.getScopes());
        assertTrue(savedRecord.isNonMedicalUseRestricted());

        // Kiểm tra ghi AuditLog
        ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        AuditLog savedAudit = auditCaptor.getValue();
        assertEquals(ActionType.UPDATE, savedAudit.getActionType());
        assertEquals(ResourceType.PATIENT, savedAudit.getResourceType());
        assertTrue(savedAudit.getDetail().contains("PARTIALLY_WITHDRAWN"));
    }

    @Test
    @DisplayName("AC-01: Rút lại toàn bộ sự đồng ý (consentWithdrawn = true)")
    void withdrawAllConsent_success() {
        UUID patientId = UUID.randomUUID();
        Patient patient = createTestPatient(patientId);

        when(currentUserPort.getCurrentUserId()).thenReturn(currentUserId);
        when(currentUserPort.hasPermission("PATIENT_CONSENT_UPDATE")).thenReturn(true);
        when(clockPort.now()).thenReturn(NOW);
        when(patientRepository.findByIdForUpdate(patientId)).thenReturn(Optional.of(patient));
        when(patientRepository.save(any(Patient.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(patientConsentHistoryRepository.getNextVersionNumber(patientId)).thenReturn(2);

        UpdatePatientConsentCommand command = UpdatePatientConsentCommand.builder()
                .consentWithdrawn(true)
                .consentWithdrawnReason("Người bệnh yêu cầu rút toàn bộ sự đồng ý")
                .build();

        PatientResult result = service.updateConsent(patientId, command);

        assertNotNull(result);
        assertTrue(result.consentWithdrawn());
        assertEquals("Người bệnh yêu cầu rút toàn bộ sự đồng ý", result.consentWithdrawnReason());

        // Kiểm tra lưu lịch sử
        ArgumentCaptor<PatientConsentRecord> historyCaptor = ArgumentCaptor.forClass(PatientConsentRecord.class);
        verify(patientConsentHistoryRepository).save(historyCaptor.capture());
        PatientConsentRecord savedRecord = historyCaptor.getValue();
        assertEquals(ConsentHistoryStatus.WITHDRAWN, savedRecord.getStatus());
        assertTrue(savedRecord.getScopes().isEmpty());
    }

    @Test
    @DisplayName("P2 Validation: Từ chối nếu phạm vi không chứa TREATMENT khi consent vẫn hiệu lực")
    void missingTreatmentScopeWhenActive_throwsValidationException() {
        UUID patientId = UUID.randomUUID();
        Patient patient = createTestPatient(patientId);

        when(currentUserPort.getCurrentUserId()).thenReturn(currentUserId);
        when(currentUserPort.hasPermission("PATIENT_CONSENT_UPDATE")).thenReturn(true);
        when(clockPort.now()).thenReturn(NOW);
        when(patientRepository.findByIdForUpdate(patientId)).thenReturn(Optional.of(patient));

        UpdatePatientConsentCommand command = UpdatePatientConsentCommand.builder()
                .scopes(EnumSet.of(ConsentScope.RESEARCH)) // Không có TREATMENT
                .build();

        ValidationException ex = assertThrows(ValidationException.class,
                () -> service.updateConsent(patientId, command));
        assertTrue(ex.getMessage().contains("TREATMENT"));
    }

    @Test
    @DisplayName("QTN-24: Gia hạn / kích hoạt lại consent sau khi đã rút lại")
    void renewConsentAfterWithdrawal_success() {
        UUID patientId = UUID.randomUUID();
        Patient patient = createTestPatient(patientId);
        // Đặt trạng thái ban đầu là đã rút lại
        patient.withdrawConsent("Lý do cũ", NOW.minusSeconds(3600));

        when(currentUserPort.getCurrentUserId()).thenReturn(currentUserId);
        when(currentUserPort.hasPermission("PATIENT_CONSENT_UPDATE")).thenReturn(true);
        when(clockPort.now()).thenReturn(NOW);
        when(patientRepository.findByIdForUpdate(patientId)).thenReturn(Optional.of(patient));
        when(patientRepository.save(any(Patient.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(patientConsentHistoryRepository.getNextVersionNumber(patientId)).thenReturn(3);

        UpdatePatientConsentCommand command = UpdatePatientConsentCommand.builder()
                .consentAgreed(true)
                .consentWithdrawn(false)
                .consentVersion("v1.0")
                .scopes(EnumSet.of(ConsentScope.TREATMENT, ConsentScope.COMMUNICATION))
                .build();

        PatientResult result = service.updateConsent(patientId, command);

        assertNotNull(result);
        assertFalse(result.consentWithdrawn());
        assertTrue(result.consentAgreed());

        ArgumentCaptor<PatientConsentRecord> historyCaptor = ArgumentCaptor.forClass(PatientConsentRecord.class);
        verify(patientConsentHistoryRepository).save(historyCaptor.capture());
        PatientConsentRecord savedRecord = historyCaptor.getValue();
        assertEquals(ConsentHistoryStatus.AGREED, savedRecord.getStatus());
        assertFalse(savedRecord.isNonMedicalUseRestricted());
        assertTrue(savedRecord.getScopes().contains(ConsentScope.TREATMENT));
    }

    @Test
    @DisplayName("Security: Người dùng không có quyền và không phải chủ sở hữu thì ném PatientConsentAccessDeniedException")
    void unauthorizedUser_throwsAccessDeniedException() {
        UUID patientId = UUID.randomUUID();

        when(currentUserPort.hasPermission("PATIENT_CONSENT_UPDATE")).thenReturn(false);
        doThrow(new AccessDeniedException("Forbidden")).when(patientAccessGuard).requirePatientOwnership(patientId);

        UpdatePatientConsentCommand command = UpdatePatientConsentCommand.builder()
                .consentWithdrawn(true)
                .build();

        assertThrows(PatientConsentAccessDeniedException.class, () -> service.updateConsent(patientId, command));
    }

    @Test
    @DisplayName("Edge Case: Bệnh nhân không tồn tại ném PatientNotFoundException")
    void patientNotFound_throwsException() {
        UUID patientId = UUID.randomUUID();

        when(currentUserPort.hasPermission("PATIENT_CONSENT_UPDATE")).thenReturn(true);
        when(patientRepository.findByIdForUpdate(patientId)).thenReturn(Optional.empty());

        UpdatePatientConsentCommand command = UpdatePatientConsentCommand.builder()
                .consentWithdrawn(true)
                .build();

        assertThrows(PatientNotFoundException.class, () -> service.updateConsent(patientId, command));
    }
}
