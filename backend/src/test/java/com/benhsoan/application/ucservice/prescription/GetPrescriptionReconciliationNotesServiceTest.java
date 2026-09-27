package com.benhsoan.application.ucservice.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
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
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.PrescriptionReconciliationNote;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.port.dto.result.PrescriptionReconciliationNoteResult;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionReconciliationNoteRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;

@DisplayName("GetPrescriptionReconciliationNotesService - NCL-12-CN-007")
class GetPrescriptionReconciliationNotesServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-25T03:00:00Z");

    private PrescriptionReconciliationNoteRepository noteRepository;

    private PrescriptionRepository prescriptionRepository;

    private PrescriptionReconciliationAccessValidator accessValidator;

    private GetPrescriptionReconciliationNotesService service;

    @BeforeEach
    void setUp() {
        noteRepository = mock(PrescriptionReconciliationNoteRepository.class);
        prescriptionRepository = mock(PrescriptionRepository.class);
        accessValidator = mock(PrescriptionReconciliationAccessValidator.class);
        service = new GetPrescriptionReconciliationNotesService(
                noteRepository, prescriptionRepository, accessValidator);
    }

    private static Prescription prescription(UUID id) {
        PrescriptionItem item = PrescriptionItem.restore(UUID.randomUUID(), id, UUID.randomUUID(),
                "Paracetamol", "Paracetamol", "500 mg", "vien", "1 vien", 2,
                AdministrationRoute.ORAL, 5, 10, null, NOW.minusSeconds(600), null);
        return Prescription.restore(id, "RX000001", UUID.randomUUID(), PrescriptionStatus.CANCELLED,
                null, UUID.randomUUID(), NOW.minusSeconds(600), null, null,
                InterconnectionStatus.NOT_SENT, null, null, null, List.of(item));
    }

    @Test
    void notesAreReturnedOldestFirstWithAllFieldsMapped() {
        UUID prescriptionId = UUID.randomUUID();
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(prescription(prescriptionId)));
        when(noteRepository.findByPrescriptionId(prescriptionId)).thenReturn(List.of(
                PrescriptionReconciliationNote.restore(firstId, prescriptionId,
                        PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED, "ly do 1", actorId,
                        NOW.minusSeconds(60), NOW.minusSeconds(60)),
                PrescriptionReconciliationNote.restore(secondId, prescriptionId,
                        PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED, "ly do 2", actorId,
                        NOW, NOW)));

        List<PrescriptionReconciliationNoteResult> results = service.getNotes(prescriptionId);

        verify(accessValidator).requireCanView();
        assertEquals(2, results.size());
        assertEquals(firstId, results.get(0).id());
        assertEquals(secondId, results.get(1).id());
        assertEquals("ly do 1", results.get(0).reason());
        assertEquals(actorId, results.get(0).notedBy());
        assertEquals(NOW.minusSeconds(60), results.get(0).notedAt());
        assertEquals(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                results.get(0).reconciliationOutcome());
        assertEquals(prescriptionId, results.get(0).prescriptionId());
    }

    @Test
    void noNotesReturnsEmptyListForExistingPrescription() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(prescription(prescriptionId)));
        when(noteRepository.findByPrescriptionId(prescriptionId)).thenReturn(List.of());

        assertEquals(0, service.getNotes(prescriptionId).size());
    }

    @Test
    void unknownPrescriptionIsRejected() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.empty());

        assertThrows(PrescriptionNotFoundException.class, () -> service.getNotes(prescriptionId));
        verifyNoInteractions(noteRepository);
    }

    @Test
    void deniedViewerIsRejected() {
        org.mockito.Mockito.doThrow(new AccessDeniedException("denied"))
                .when(accessValidator).requireCanView();

        assertThrows(AccessDeniedException.class, () -> service.getNotes(UUID.randomUUID()));
        verifyNoInteractions(noteRepository);
        verifyNoInteractions(prescriptionRepository);
    }
}
