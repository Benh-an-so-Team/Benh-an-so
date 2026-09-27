package com.benhsoan.application.ucservice.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyCancelledException;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyDispensedException;
import com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.prescription.exception.UnauthorizedPrescriptionReplacementException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionItemCommand;
import com.benhsoan.port.dto.command.prescription.ReplacePrescriptionCommand;
import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;
import com.benhsoan.port.dto.result.PrescriptionReplacementResult;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.inbound.prescription.CreatePrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.SendPrescriptionInterconnectionUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionWarningLogRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

@DisplayName("ReplaceInterconnectedPrescriptionService")
class ReplaceInterconnectedPrescriptionServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-25T03:00:00Z");
    private static final UUID DOCTOR_ID = UUID.randomUUID();
    private static final UUID OTHER_DOCTOR_ID = UUID.randomUUID();
    private static final UUID MEDICAL_RECORD_ID = UUID.randomUUID();
    private static final UUID REPLACEMENT_ID = UUID.randomUUID();
    private static final String REASON = "Sai liều lượng so với chẩn đoán đã cập nhật";
    private static final String ORIGINAL_CODE = "RX000001";
    private static final String REPLACEMENT_CODE = "RX000002";

    /** Marks the row the repository returns after the interconnection send. */
    private static final String SENT_RELOAD_MARKER = "reloaded-after-send";

    private final PrescriptionRepository prescriptionRepository = mock(PrescriptionRepository.class);
    private final PrescriptionWarningLogRepository warningLogRepository =
            mock(PrescriptionWarningLogRepository.class);
    private final CreatePrescriptionUseCase createPrescriptionUseCase = mock(CreatePrescriptionUseCase.class);
    private final SendPrescriptionInterconnectionUseCase sendPrescriptionInterconnectionUseCase =
            mock(SendPrescriptionInterconnectionUseCase.class);
    private final PrescriptionClinicalContextValidator clinicalContextValidator =
            mock(PrescriptionClinicalContextValidator.class);
    private final PrescriptionAccessDeniedAuditWriter accessDeniedAuditWriter =
            mock(PrescriptionAccessDeniedAuditWriter.class);
    private final PrescriptionResultMapper resultMapper = mock(PrescriptionResultMapper.class);
    private final CurrentUserPort currentUserPort = mock(CurrentUserPort.class);
    private final ClockPort clockPort = mock(ClockPort.class);
    private final AuditLogRepository auditLogRepository = mock(AuditLogRepository.class);

    private final AtomicReference<Prescription> replacementState = new AtomicReference<>();

    private ReplaceInterconnectedPrescriptionService service;
    private Prescription original;

    @BeforeEach
    void setUp() {
        service = new ReplaceInterconnectedPrescriptionService(
                prescriptionRepository,
                warningLogRepository,
                createPrescriptionUseCase,
                sendPrescriptionInterconnectionUseCase,
                clinicalContextValidator,
                accessDeniedAuditWriter,
                resultMapper,
                currentUserPort,
                clockPort,
                auditLogRepository,
                new ObjectMapper().findAndRegisterModules()
        );

        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(DOCTOR_ID);
        when(clockPort.now()).thenReturn(NOW);
        when(warningLogRepository.findByPrescriptionId(any())).thenReturn(List.of());
        when(resultMapper.toResult(any(Prescription.class), any())).thenAnswer(invocation -> {
            Prescription prescription = invocation.getArgument(0);
            return new PrescriptionResult(
                    prescription.getId(), prescription.getPrescriptionCode(), prescription.getMedicalRecordId(),
                    null, null, null, null, null, prescription.getStatus(), prescription.getNote(),
                    prescription.getCancelReason(), prescription.getPrescribedBy(), null,
                    prescription.getPrescribedAt(), prescription.getUpdatedBy(), prescription.getUpdatedAt(),
                    List.of(), List.of());
        });
        when(prescriptionRepository.save(any(Prescription.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        original = interconnectedPendingPrescription(DOCTOR_ID);
        when(prescriptionRepository.findByIdForUpdate(original.getId()))
                .thenAnswer(invocation -> Optional.of(original));

        replacementState.set(pendingReplacement());
        when(prescriptionRepository.findById(REPLACEMENT_ID))
                .thenAnswer(invocation -> Optional.of(replacementState.get()));
        when(createPrescriptionUseCase.create(any(CreatePrescriptionCommand.class)))
                .thenAnswer(invocation -> new PrescriptionResult(
                        REPLACEMENT_ID, REPLACEMENT_CODE, MEDICAL_RECORD_ID,
                        null, null, null, null, null, PrescriptionStatus.PENDING_DISPENSE, null,
                        null, DOCTOR_ID, null, NOW, null, null, List.of(), List.of()));
    }

    @Test
    @DisplayName("TC-01: replacement is created, linked and the original becomes replaced")
    void replacesInterconnectedPrescription() {
        stubSend(new PrescriptionInterconnectionResult(
                REPLACEMENT_ID, REPLACEMENT_CODE, InterconnectionStatus.SUCCESS,
                "LT-20260925-000123", null, NOW));

        PrescriptionReplacementResult result = service.replace(command());

        assertEquals(PrescriptionStatus.REPLACED, result.originalPrescription().status());
        assertEquals(PrescriptionStatus.PENDING_DISPENSE, result.replacementPrescription().status());
        assertEquals(REPLACEMENT_ID, result.replacementPrescription().id());
        assertEquals(InterconnectionStatus.SUCCESS, result.interconnection().status());
        assertEquals("LT-20260925-000123", result.interconnection().receiptCode());

        assertEquals(PrescriptionStatus.REPLACED, original.getStatus());
        assertEquals(DOCTOR_ID, original.getUpdatedBy());
        assertEquals(NOW, original.getUpdatedAt());
        // The original keeps its interconnection history.
        assertEquals(InterconnectionStatus.SUCCESS, original.getInterconnectionStatus());
        assertEquals("LT-20260925-000001", original.getInterconnectionReceiptCode());
    }

    @Test
    @DisplayName("The replacement is linked to the original with a fresh code and its own items")
    void linksReplacementWithFreshIdentity() {
        stubSend(successInterconnection());

        service.replace(command());
        Prescription saved = captureSavedReplacement();

        assertEquals(original.getId(), saved.getReplacesPrescriptionId());
        assertEquals(ORIGINAL_CODE, saved.getReplacesPrescriptionCode());
        assertEquals(REASON, saved.getReplacementReason());
        assertEquals(REPLACEMENT_CODE, saved.getPrescriptionCode());
        assertEquals(InterconnectionStatus.NOT_SENT, saved.getInterconnectionStatus());
    }

    @Test
    @DisplayName("The replacement is created for the medical record of the original")
    void createsReplacementForOriginalMedicalRecord() {
        stubSend(successInterconnection());

        service.replace(command());

        ArgumentCaptor<CreatePrescriptionCommand> captor =
                ArgumentCaptor.forClass(CreatePrescriptionCommand.class);
        verify(createPrescriptionUseCase).create(captor.capture());
        assertEquals(original.getMedicalRecordId(), captor.getValue().medicalRecordId());
    }

    @Test
    @DisplayName("QTN-42: a prescription that was not interconnected is rejected before any work")
    void rejectsNotInterconnectedPrescription() {
        original = pendingPrescription(DOCTOR_ID);
        when(prescriptionRepository.findByIdForUpdate(original.getId()))
                .thenAnswer(invocation -> Optional.of(original));

        PrescriptionInvalidStatusException exception = assertThrows(
                PrescriptionInvalidStatusException.class, () -> service.replace(command()));

        assertTrue(exception.getMessage().contains("interconnected"));
        verify(createPrescriptionUseCase, never()).create(any());
        verify(sendPrescriptionInterconnectionUseCase, never()).send(any());
        verify(prescriptionRepository, never()).save(any(Prescription.class));
    }

    @Test
    @DisplayName("TC-02: a dispensed prescription is rejected and no replacement is created")
    void rejectsDispensedPrescription() {
        original.markDispensed(DOCTOR_ID, NOW.minusSeconds(60));

        PrescriptionAlreadyDispensedException exception = assertThrows(
                PrescriptionAlreadyDispensedException.class, () -> service.replace(command()));

        assertTrue(exception.getMessage().contains("prescribe a new prescription"));
        verify(createPrescriptionUseCase, never()).create(any());
        verify(sendPrescriptionInterconnectionUseCase, never()).send(any());
        verify(prescriptionRepository, never()).save(any(Prescription.class));
    }

    @Test
    @DisplayName("A cancelled prescription is rejected")
    void rejectsCancelledPrescription() {
        original.cancel("Patient changed treatment", DOCTOR_ID, NOW.minusSeconds(60));

        assertThrows(PrescriptionAlreadyCancelledException.class, () -> service.replace(command()));
        verify(createPrescriptionUseCase, never()).create(any());
    }

    @Test
    @DisplayName("An already replaced prescription is rejected, so no second replacement exists")
    void rejectsAlreadyReplacedPrescription() {
        original.markReplaced(DOCTOR_ID, NOW.minusSeconds(60));

        assertThrows(PrescriptionInvalidStatusException.class, () -> service.replace(command()));
        verify(createPrescriptionUseCase, never()).create(any());
    }

    @Test
    @DisplayName("An unknown prescription is reported as not found")
    void rejectsUnknownPrescription() {
        UUID unknownId = UUID.randomUUID();
        when(prescriptionRepository.findByIdForUpdate(unknownId)).thenReturn(Optional.empty());

        PrescriptionNotFoundException exception = assertThrows(
                PrescriptionNotFoundException.class,
                () -> service.replace(commandFor(unknownId)));
        assertNotNull(exception.getMessage());
    }

    @Test
    @DisplayName("A missing or blank replacement reason is rejected before any lookup")
    void rejectsInvalidReason() {
        assertThrows(ValidationException.class, () -> service.replace(
                new ReplacePrescriptionCommand(original.getId(), null, createCommand())));
        assertThrows(ValidationException.class, () -> service.replace(
                new ReplacePrescriptionCommand(original.getId(), "   ", createCommand())));
        assertThrows(ValidationException.class, () -> service.replace(null));

        verify(prescriptionRepository, never()).findByIdForUpdate(any());
        verify(createPrescriptionUseCase, never()).create(any());
    }

    @Test
    @DisplayName("A non-doctor cannot replace a prescription")
    void rejectsNonDoctor() {
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.replace(command()));

        verify(prescriptionRepository, never()).findByIdForUpdate(any());
        verify(createPrescriptionUseCase, never()).create(any());
    }

    @Test
    @DisplayName("A doctor cannot replace another doctor's prescription, and the attempt is audited")
    void rejectsAnotherDoctorsPrescription() {
        original = interconnectedPendingPrescription(OTHER_DOCTOR_ID);
        when(prescriptionRepository.findByIdForUpdate(original.getId()))
                .thenAnswer(invocation -> Optional.of(original));

        assertThrows(UnauthorizedPrescriptionReplacementException.class, () -> service.replace(command()));

        verify(accessDeniedAuditWriter).writeReplacementDenied(
                eq(DOCTOR_ID), eq(original.getId()), eq(OTHER_DOCTOR_ID), eq(NOW), any());
        verify(createPrescriptionUseCase, never()).create(any());
        assertEquals(PrescriptionStatus.PENDING_DISPENSE, original.getStatus());
    }

    @Test
    @DisplayName("CV-04: a gateway failure is recorded without claiming the original was cancelled")
    void recordsGatewayFailureWithoutClaimingCancellation() {
        String failureReason = "Mock gateway failed while processing the prescription.";
        stubSend(new PrescriptionInterconnectionResult(
                REPLACEMENT_ID, REPLACEMENT_CODE, InterconnectionStatus.FAILED,
                null, failureReason, NOW));

        PrescriptionReplacementResult result = service.replace(command());

        // The failure is reported as FAILED with its reason, never as a cancellation.
        assertEquals(InterconnectionStatus.FAILED, result.interconnection().status());
        assertEquals(failureReason, result.interconnection().failureReason());
        assertNull(result.interconnection().receiptCode());

        // The response is reloaded after sending, so it reflects the persisted
        // replacement (the reload marker comes from the stored row, not the request).
        assertEquals(SENT_RELOAD_MARKER, result.replacementPrescription().note());
        assertEquals(REPLACEMENT_ID, result.interconnection().prescriptionId());

        // The original is superseded locally and keeps its successful history.
        assertEquals(PrescriptionStatus.REPLACED, result.originalPrescription().status());
        assertEquals(InterconnectionStatus.SUCCESS, original.getInterconnectionStatus());
    }

    @Test
    @DisplayName("CV-04: after a failure the relationship survives so a retry can complete the flow")
    void keepsRelationshipAfterFailure() {
        stubSend(new PrescriptionInterconnectionResult(
                REPLACEMENT_ID, REPLACEMENT_CODE, InterconnectionStatus.FAILED,
                null, "timeout", NOW));

        service.replace(command());

        Prescription saved = captureSavedReplacement();
        assertEquals(original.getId(), saved.getReplacesPrescriptionId());
        assertEquals(ORIGINAL_CODE, saved.getReplacesPrescriptionCode());
        assertEquals(REASON, saved.getReplacementReason());
    }

    @Test
    @DisplayName("The superseded original is audited with the replacement reference and reason")
    void writesAuditForReplacedOriginal() {
        stubSend(successInterconnection());

        service.replace(command());

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository, times(2)).save(captor.capture());

        AuditLog originalAudit = captor.getAllValues().stream()
                .filter(log -> original.getId().equals(log.getResourceId()))
                .findFirst()
                .orElseThrow();
        assertEquals(ActionType.UPDATE, originalAudit.getActionType());
        assertEquals(original.getId(), originalAudit.getResourceId());
        assertEquals(DOCTOR_ID, originalAudit.getUserId());
        assertEquals(NOW, originalAudit.getCreatedAt());
        assertTrue(originalAudit.getDetail().contains(REPLACEMENT_ID.toString()));
        assertTrue(originalAudit.getDetail().contains(REPLACEMENT_CODE));
        assertTrue(originalAudit.getDetail().contains(REASON));
        assertTrue(originalAudit.getDetail().contains("REPLACED"));
    }

    @Test
    @DisplayName("The new replacement prescription is audited with the original it replaces")
    void writesAuditForReplacementPrescription() {
        stubSend(successInterconnection());

        service.replace(command());

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository, times(2)).save(captor.capture());

        AuditLog replacementAudit = captor.getAllValues().stream()
                .filter(log -> REPLACEMENT_ID.equals(log.getResourceId()))
                .findFirst()
                .orElseThrow();
        assertEquals(ActionType.UPDATE, replacementAudit.getActionType());
        assertEquals(REPLACEMENT_ID, replacementAudit.getResourceId());
        assertEquals(DOCTOR_ID, replacementAudit.getUserId());
        assertEquals(NOW, replacementAudit.getCreatedAt());
        assertTrue(replacementAudit.getDetail().contains(original.getId().toString()));
        assertTrue(replacementAudit.getDetail().contains(ORIGINAL_CODE));
        assertTrue(replacementAudit.getDetail().contains(REASON));
    }

    @Test
    @DisplayName("A creation failure leaves the original untouched, so it is never left replaced")
    void propagatesCreationFailureWithoutReplacingOriginal() {
        when(createPrescriptionUseCase.create(any(CreatePrescriptionCommand.class)))
                .thenThrow(new ValidationException("A diagnosis is required before creating a prescription."));

        assertThrows(ValidationException.class, () -> service.replace(command()));

        assertEquals(PrescriptionStatus.PENDING_DISPENSE, original.getStatus());
        verify(prescriptionRepository, never()).save(any(Prescription.class));
        verify(sendPrescriptionInterconnectionUseCase, never()).send(any());
        verify(auditLogRepository, never()).save(any(AuditLog.class));
    }

    private ReplacePrescriptionCommand command() {
        return commandFor(original.getId());
    }

    private ReplacePrescriptionCommand commandFor(UUID originalPrescriptionId) {
        return new ReplacePrescriptionCommand(originalPrescriptionId, REASON, createCommand());
    }

    private CreatePrescriptionCommand createCommand() {
        return CreatePrescriptionCommand.builder()
                .medicalRecordId(MEDICAL_RECORD_ID)
                .note("Đơn thay thế")
                .items(List.of(CreatePrescriptionItemCommand.builder()
                        .medicineId(UUID.randomUUID())
                        .dosage("1 viên")
                        .frequency(2)
                        .route(AdministrationRoute.ORAL)
                        .durationDays(5)
                        .quantity(10)
                        .build()))
                .build();
    }

    private void stubSend(PrescriptionInterconnectionResult result) {
        when(sendPrescriptionInterconnectionUseCase.send(REPLACEMENT_ID)).thenAnswer(invocation -> {
            // The send flow persists the interconnection outcome, so the stored row
            // handed back by the repository reflects it.
            replacementState.set(sentReplacement(
                    result.status(), result.failureReason()));
            return result;
        });
    }

    private PrescriptionInterconnectionResult successInterconnection() {
        return new PrescriptionInterconnectionResult(
                REPLACEMENT_ID, REPLACEMENT_CODE, InterconnectionStatus.SUCCESS,
                "LT-20260925-000123", null, NOW);
    }

    private Prescription captureSavedReplacement() {
        ArgumentCaptor<Prescription> captor = ArgumentCaptor.forClass(Prescription.class);
        verify(prescriptionRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        return captor.getAllValues().stream()
                .filter(saved -> REPLACEMENT_ID.equals(saved.getId()))
                .findFirst()
                .orElseThrow();
    }

    private Prescription interconnectedPendingPrescription(UUID prescribedBy) {
        Prescription prescription = pendingPrescription(prescribedBy);
        prescription.markInterconnectionSucceeded("LT-20260925-000001", NOW.minusSeconds(300));
        return prescription;
    }

    private Prescription pendingPrescription(UUID prescribedBy) {
        UUID prescriptionId = UUID.randomUUID();
        return Prescription.restore(
                prescriptionId, ORIGINAL_CODE, MEDICAL_RECORD_ID, PrescriptionStatus.PENDING_DISPENSE,
                null, null, prescribedBy, NOW.minusSeconds(600), null, null,
                InterconnectionStatus.NOT_SENT, null, null, null,
                List.of(item(prescriptionId)));
    }

    private Prescription pendingReplacement() {
        return Prescription.restore(
                REPLACEMENT_ID, REPLACEMENT_CODE, MEDICAL_RECORD_ID, PrescriptionStatus.PENDING_DISPENSE,
                null, null, DOCTOR_ID, NOW, null, null,
                InterconnectionStatus.NOT_SENT, null, null, null,
                List.of(item(REPLACEMENT_ID)));
    }

    private Prescription sentReplacement(InterconnectionStatus status, String failureReason) {
        boolean successful = status == InterconnectionStatus.SUCCESS;
        return Prescription.restore(
                REPLACEMENT_ID, REPLACEMENT_CODE, MEDICAL_RECORD_ID, PrescriptionStatus.PENDING_DISPENSE,
                SENT_RELOAD_MARKER, null, DOCTOR_ID, NOW.minusSeconds(600), DOCTOR_ID, NOW,
                status, NOW,
                successful ? null : failureReason,
                successful ? "LT-20260925-000123" : null,
                original.getId(), ORIGINAL_CODE, REASON,
                List.of(item(REPLACEMENT_ID)));
    }

    private PrescriptionItem item(UUID prescriptionId) {
        return PrescriptionItem.restore(
                UUID.randomUUID(), prescriptionId, UUID.randomUUID(),
                "Paracetamol", "Paracetamol", "500 mg", "vien", "1 vien", 2,
                AdministrationRoute.ORAL, 5, 10, null, NOW.minusSeconds(600), null);
    }
}
