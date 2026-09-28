package com.benhsoan.application.ucservice.personaldata;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.exception.PatientAlreadyMergedException;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.port.dto.command.personaldata.RecordPersonalDataRequestCommand;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class RecordPersonalDataRequestServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-26T08:00:00Z");

    @Mock private PersonalDataRequestRepository requestRepository;
    @Mock private PatientRepository patientRepository;
    @Mock private PersonalDataRequestAuthorizer authorizer;
    @Mock private PersonalDataRequestResultMapper resultMapper;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private CurrentUserPort currentUserPort;
    @Mock private ClockPort clockPort;

    @InjectMocks
    private RecordPersonalDataRequestService service;

    @Test
    @DisplayName("TC-01: ghi nhận yêu cầu, gắn đúng bệnh nhân, trạng thái RECEIVED và ghi audit")
    void recordStoresRequestWithPatientAndAudit() {
        UUID patientId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        when(clockPort.now()).thenReturn(NOW);
        when(currentUserPort.getCurrentUserId()).thenReturn(actorId);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(mock(Patient.class)));
        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RecordPersonalDataRequestCommand command = new RecordPersonalDataRequestCommand(
                patientId, PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, "Xin bản sao", NOW.plusSeconds(86400));

        service.record(command);

        verify(authorizer).requireUpdatePermission();
        verify(requestRepository).save(argThat(r ->
                r.getPatientId().equals(patientId)
                        && r.getStatus() == PersonalDataRequestStatus.RECEIVED
                        && r.getReceivedAt().equals(NOW)
                        && r.getDueAt().equals(NOW.plusSeconds(86400))));
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    @DisplayName("bệnh nhân không tồn tại bị từ chối")
    void recordRejectsUnknownPatient() {
        UUID patientId = UUID.randomUUID();
        when(patientRepository.findById(patientId)).thenReturn(Optional.empty());

        RecordPersonalDataRequestCommand command = new RecordPersonalDataRequestCommand(
                patientId, PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW.plusSeconds(86400));

        assertThrows(PatientNotFoundException.class, () -> service.record(command));
    }

    @Test
    @DisplayName("bệnh nhân đã gộp bị từ chối, không tạo yêu cầu")
    void recordRejectsMergedPatient() {
        UUID patientId = UUID.randomUUID();
        UUID mergedInto = UUID.randomUUID();
        Patient merged = mock(Patient.class);
        when(merged.isMerged()).thenReturn(true);
        when(merged.getId()).thenReturn(patientId);
        when(merged.getMergedIntoPatientId()).thenReturn(mergedInto);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(merged));

        RecordPersonalDataRequestCommand command = new RecordPersonalDataRequestCommand(
                patientId, PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW.plusSeconds(86400));

        assertThrows(PatientAlreadyMergedException.class, () -> service.record(command));
        verify(requestRepository, never()).save(any());
    }
}
