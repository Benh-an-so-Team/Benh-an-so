package com.benhsoan.application.ucservice.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.PrescriptionReconciliationNote;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.prescription.RecordPrescriptionReconciliationNoteCommand;
import com.benhsoan.port.dto.result.PrescriptionReconciliationNoteResult;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionReconciliationNoteRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

@DisplayName("RecordPrescriptionReconciliationNoteService - NCL-12-CN-007")
class RecordPrescriptionReconciliationNoteServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-25T03:00:00Z");

    private PrescriptionRepository prescriptionRepository;

    private PrescriptionReconciliationNoteRepository noteRepository;

    private PrescriptionReconciliationAccessValidator accessValidator;

    private CurrentUserPort currentUserPort;

    private ClockPort clockPort;

    private AuditLogRepository auditLogRepository;

    private RecordPrescriptionReconciliationNoteService service;

    @BeforeEach
    void setUp() {
        prescriptionRepository = mock(PrescriptionRepository.class);
        noteRepository = mock(PrescriptionReconciliationNoteRepository.class);
        accessValidator = mock(PrescriptionReconciliationAccessValidator.class);
        currentUserPort = mock(CurrentUserPort.class);
        clockPort = mock(ClockPort.class);
        auditLogRepository = mock(AuditLogRepository.class);
        service = new RecordPrescriptionReconciliationNoteService(
                prescriptionRepository, noteRepository, accessValidator, currentUserPort,
                clockPort, auditLogRepository, new ObjectMapper());
    }

    private static Prescription prescription(
            UUID id,
            PrescriptionStatus dispensingStatus,
            InterconnectionStatus interconnectionStatus
    ) {
        Instant interconnectedAt = interconnectionStatus == InterconnectionStatus.NOT_SENT ? null : NOW;
        String error = interconnectionStatus == InterconnectionStatus.FAILED ? "gateway timeout" : null;
        String receipt = interconnectionStatus == InterconnectionStatus.SUCCESS ? "LT-1" : null;
        PrescriptionItem item = PrescriptionItem.restore(UUID.randomUUID(), id, UUID.randomUUID(),
                "Paracetamol", "Paracetamol", "500 mg", "vien", "1 vien", 2,
                AdministrationRoute.ORAL, 5, 10, null, NOW.minusSeconds(600), null);
        return Prescription.restore(id, "RX000001", UUID.randomUUID(), dispensingStatus, null,
                UUID.randomUUID(), NOW.minusSeconds(600), null, null, interconnectionStatus,
                interconnectedAt, error, receipt, List.of(item));
    }

    @Test
    void discrepancyTypeIsDerivedServerSideFromPersistedState() {
        UUID prescriptionId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.DISPENSED, InterconnectionStatus.FAILED)));
        when(currentUserPort.getCurrentUserId()).thenReturn(actorId);
        when(clockPort.now()).thenReturn(NOW);
        when(noteRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        PrescriptionReconciliationNoteResult result = service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "Da xu ly thu cong"));

        assertEquals(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                result.reconciliationOutcome());
        assertEquals(actorId, result.notedBy());
        assertEquals(NOW, result.notedAt());
        assertEquals("Da xu ly thu cong", result.reason());
    }

    @Test
    void transmittedNotDispensedOutcomeIsAllowed() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.SUCCESS)));
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());
        when(clockPort.now()).thenReturn(NOW);
        when(noteRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        PrescriptionReconciliationNoteResult result = service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "Cho cap phat"));

        assertEquals(PrescriptionReconciliationOutcome.TRANSMITTED_NOT_DISPENSED,
                result.reconciliationOutcome());
    }

    @Test
    void dispensedNotTransmittedOutcomeIsAllowed() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.PARTIALLY_DISPENSED, InterconnectionStatus.NOT_SENT)));
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());
        when(clockPort.now()).thenReturn(NOW);
        when(noteRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        PrescriptionReconciliationNoteResult result = service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "Da xu ly thu cong"));

        assertEquals(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                result.reconciliationOutcome());
    }

    @Test
    void consistentOutcomeIsRejectedWithoutPersistingOrAuditing() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.DISPENSED, InterconnectionStatus.SUCCESS)));
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        assertThrows(ValidationException.class, () -> service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "Don khop")));

        verify(noteRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void cancelledOutcomeIsRejectedWithoutPersistingOrAuditing() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.CANCELLED, InterconnectionStatus.NOT_SENT)));
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        assertThrows(ValidationException.class, () -> service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "Don da huy")));

        verify(noteRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void notTransmittedAndNotDispensedOutcomeIsRejected() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.FAILED)));
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        assertThrows(ValidationException.class, () -> service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "Chua lien thong")));

        verify(noteRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void auditRecordIsWrittenForTheRecordedNote() {
        UUID prescriptionId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.SUCCESS)));
        when(currentUserPort.getCurrentUserId()).thenReturn(actorId);
        when(clockPort.now()).thenReturn(NOW);
        when(noteRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.record(new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "Theo doi them"));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        AuditLog auditLog = captor.getValue();
        assertEquals(actorId, auditLog.getUserId());
        assertEquals(ActionType.UPDATE, auditLog.getActionType());
        assertEquals(ResourceType.PRESCRIPTION, auditLog.getResourceType());
        assertEquals(prescriptionId, auditLog.getResourceId());
        assertEquals(NOW, auditLog.getCreatedAt());
        assertTrue(auditLog.getDetail().contains("RECONCILIATION_NOTE"));
        assertTrue(auditLog.getDetail().contains("TRANSMITTED_NOT_DISPENSED"));
        assertTrue(auditLog.getDetail().contains("Theo doi them"));
    }

    @Test
    void blankReasonIsRejectedWithoutPersistingOrAuditing() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.DISPENSED, InterconnectionStatus.FAILED)));
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());
        when(clockPort.now()).thenReturn(NOW);

        assertThrows(ValidationException.class, () -> service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "   ")));

        verify(noteRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void reasonLongerThan500CharactersIsRejected() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.DISPENSED, InterconnectionStatus.FAILED)));
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());
        when(clockPort.now()).thenReturn(NOW);

        String tooLong = "x".repeat(PrescriptionReconciliationNote.MAX_REASON_LENGTH + 1);

        assertThrows(ValidationException.class, () -> service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, tooLong)));
        verify(noteRepository, never()).save(any());
    }

    @Test
    void reasonIsTrimmedBeforePersisting() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(
                prescription(prescriptionId, PrescriptionStatus.DISPENSED, InterconnectionStatus.FAILED)));
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());
        when(clockPort.now()).thenReturn(NOW);
        when(noteRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        PrescriptionReconciliationNoteResult result = service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "  ghi chu  "));

        assertEquals("ghi chu", result.reason());
    }

    @Test
    void unknownPrescriptionIsRejected() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.empty());
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        assertThrows(PrescriptionNotFoundException.class, () -> service.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, "ly do")));
        verify(noteRepository, never()).save(any());
        verify(auditLogRepository, never()).save(any());
    }

    @Test
    void missingPrescriptionIdIsRejected() {
        assertThrows(ValidationException.class, () -> service.record(
                new RecordPrescriptionReconciliationNoteCommand(null, "ly do")));
        assertThrows(ValidationException.class, () -> service.record(null));
        verifyNoInteractions(prescriptionRepository);
    }

    @Test
    void deniedActorCannotRecordANote() {
        org.mockito.Mockito.doThrow(new AccessDeniedException("denied"))
                .when(accessValidator).requireCanRecordNote();

        assertThrows(AccessDeniedException.class, () -> service.record(
                new RecordPrescriptionReconciliationNoteCommand(UUID.randomUUID(), "ly do")));
        verifyNoInteractions(prescriptionRepository);
        verifyNoInteractions(noteRepository);
    }

    @Test
    void noteAggregateExposesNoMutators() {
        List<String> mutators = java.util.Arrays
                .stream(PrescriptionReconciliationNote.class.getMethods())
                .filter(method -> method.getDeclaringClass() == PrescriptionReconciliationNote.class)
                .map(java.lang.reflect.Method::getName)
                .filter(name -> name.startsWith("set")
                        || name.startsWith("update")
                        || name.startsWith("delete"))
                .toList();

        assertTrue(mutators.isEmpty(),
                "reconciliation notes must stay append only but exposed: " + mutators);
    }
}
