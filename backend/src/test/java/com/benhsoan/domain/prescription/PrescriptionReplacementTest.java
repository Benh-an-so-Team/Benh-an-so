package com.benhsoan.domain.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyCancelledException;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyDispensedException;
import com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException;
import com.benhsoan.domain.shared.exception.ValidationException;

@DisplayName("Prescription replacement domain rules")
class PrescriptionReplacementTest {

    private static final Instant NOW = Instant.parse("2026-09-25T03:00:00Z");
    private static final UUID DOCTOR_ID = UUID.randomUUID();
    private static final String REASON = "Sai liều lượng so với chẩn đoán đã cập nhật";

    @Test
    @DisplayName("Interconnected pending prescription can be replaced")
    void replacesInterconnectedPendingPrescription() {
        Prescription original = interconnectedPendingPrescription();

        original.markReplaced(DOCTOR_ID, NOW);

        assertEquals(PrescriptionStatus.REPLACED, original.getStatus());
        assertEquals(DOCTOR_ID, original.getUpdatedBy());
        assertEquals(NOW, original.getUpdatedAt());
    }

    @Test
    @DisplayName("Replacing preserves the interconnection history of the original")
    void replacingPreservesInterconnectionHistory() {
        Prescription original = interconnectedPendingPrescription();

        original.markReplaced(DOCTOR_ID, NOW);

        assertEquals(InterconnectionStatus.SUCCESS, original.getInterconnectionStatus());
        assertEquals("LT-20260925-000001", original.getInterconnectionReceiptCode());
        assertEquals(NOW.minusSeconds(300), original.getLastInterconnectionAt());
        assertNull(original.getLastInterconnectionError());
    }

    @Test
    @DisplayName("A prescription that was never interconnected cannot be replaced (QTN-42)")
    void rejectsNotInterconnectedPrescription() {
        Prescription original = pendingPrescription();

        PrescriptionInvalidStatusException exception = assertThrows(
                PrescriptionInvalidStatusException.class,
                () -> original.markReplaced(DOCTOR_ID, NOW)
        );

        assertTrue(exception.getMessage().contains("interconnected"));
        assertEquals(PrescriptionStatus.PENDING_DISPENSE, original.getStatus());
    }

    @Test
    @DisplayName("A failed interconnection cannot be replaced (QTN-42)")
    void rejectsFailedInterconnection() {
        Prescription original = pendingPrescription();
        original.markInterconnectionFailed("Gateway unavailable", NOW.minusSeconds(300));

        assertThrows(PrescriptionInvalidStatusException.class,
                () -> original.markReplaced(DOCTOR_ID, NOW));
    }

    @Test
    @DisplayName("TC-02: dispensed prescription is rejected with guidance to prescribe anew")
    void rejectsDispensedPrescriptionWithGuidance() {
        Prescription original = interconnectedPendingPrescription();
        original.markDispensed(DOCTOR_ID, NOW.minusSeconds(120));

        PrescriptionAlreadyDispensedException exception = assertThrows(
                PrescriptionAlreadyDispensedException.class,
                () -> original.markReplaced(DOCTOR_ID, NOW)
        );

        assertTrue(exception.getMessage().contains("prescribe a new prescription"));
        assertEquals(PrescriptionStatus.DISPENSED, original.getStatus());
    }

    @Test
    @DisplayName("Partially dispensed prescription is rejected (QTN-12, inventory already deducted)")
    void rejectsPartiallyDispensedPrescription() {
        Prescription original = interconnectedPendingPrescription();
        original.markPartiallyDispensed(DOCTOR_ID, NOW.minusSeconds(120));

        assertThrows(PrescriptionAlreadyDispensedException.class,
                () -> original.markReplaced(DOCTOR_ID, NOW));
    }

    @Test
    @DisplayName("Cancelled prescription is rejected")
    void rejectsCancelledPrescription() {
        Prescription original = interconnectedPendingPrescription();
        original.cancel("Patient changed treatment", DOCTOR_ID, NOW.minusSeconds(120));

        assertThrows(PrescriptionAlreadyCancelledException.class,
                () -> original.markReplaced(DOCTOR_ID, NOW));
    }

    @Test
    @DisplayName("An already replaced prescription cannot be replaced twice")
    void rejectsAlreadyReplacedPrescription() {
        Prescription original = interconnectedPendingPrescription();
        original.markReplaced(DOCTOR_ID, NOW);

        PrescriptionInvalidStatusException exception = assertThrows(
                PrescriptionInvalidStatusException.class,
                () -> original.markReplaced(DOCTOR_ID, NOW.plusSeconds(60))
        );

        assertTrue(exception.getMessage().contains("already been replaced"));
    }

    @Test
    @DisplayName("A replaced prescription can no longer be dispensed")
    void replacedPrescriptionCannotBeDispensed() {
        Prescription original = interconnectedPendingPrescription();
        original.markReplaced(DOCTOR_ID, NOW);

        assertThrows(PrescriptionInvalidStatusException.class,
                () -> original.markDispensed(DOCTOR_ID, NOW.plusSeconds(60)));
        assertThrows(PrescriptionInvalidStatusException.class,
                () -> original.markPartiallyDispensed(DOCTOR_ID, NOW.plusSeconds(60)));
    }

    @Test
    @DisplayName("A replaced prescription cannot be cancelled")
    void replacedPrescriptionCannotBeCancelled() {
        Prescription original = interconnectedPendingPrescription();
        original.markReplaced(DOCTOR_ID, NOW);

        PrescriptionInvalidStatusException exception = assertThrows(
                PrescriptionInvalidStatusException.class,
                () -> original.cancel("Hủy nhầm", DOCTOR_ID, NOW.plusSeconds(60))
        );

        assertTrue(exception.getMessage().contains("cannot be cancelled"));
        assertEquals(PrescriptionStatus.REPLACED, original.getStatus());
    }

    @Test
    @DisplayName("A replacement is linked to the original and stores the reason")
    void linksReplacementToOriginal() {
        Prescription original = interconnectedPendingPrescription();
        Prescription replacement = pendingPrescription("RX000002");

        replacement.markAsReplacementOf(
                original.getId(), original.getPrescriptionCode(), REASON, DOCTOR_ID, NOW);

        assertEquals(original.getId(), replacement.getReplacesPrescriptionId());
        assertEquals("RX000001", replacement.getReplacesPrescriptionCode());
        assertEquals(REASON, replacement.getReplacementReason());
        assertEquals(PrescriptionStatus.PENDING_DISPENSE, replacement.getStatus());
        assertEquals(InterconnectionStatus.NOT_SENT, replacement.getInterconnectionStatus());
    }

    @Test
    @DisplayName("The replacement keeps its own code and its own item ids")
    void replacementKeepsItsOwnIdentity() {
        Prescription original = interconnectedPendingPrescription();
        Prescription replacement = pendingPrescription("RX000002");

        replacement.markAsReplacementOf(
                original.getId(), original.getPrescriptionCode(), REASON, DOCTOR_ID, NOW);

        assertEquals("RX000002", replacement.getPrescriptionCode());
        assertTrue(replacement.getItems().stream().noneMatch(replacementItem ->
                original.getItems().stream().anyMatch(
                        originalItem -> originalItem.getId().equals(replacementItem.getId()))));
    }

    @Test
    @DisplayName("A prescription cannot replace itself")
    void rejectsSelfReference() {
        Prescription replacement = pendingPrescription();

        assertThrows(ValidationException.class, () -> replacement.markAsReplacementOf(
                replacement.getId(), replacement.getPrescriptionCode(), REASON, DOCTOR_ID, NOW));
    }

    @Test
    @DisplayName("A replacement must not inherit the interconnection state of the original")
    void rejectsInheritedInterconnectionState() {
        Prescription alreadyInterconnected = interconnectedPendingPrescription();

        assertThrows(ValidationException.class, () -> alreadyInterconnected.markAsReplacementOf(
                UUID.randomUUID(), "RX000001", REASON, DOCTOR_ID, NOW));
    }

    @Test
    @DisplayName("A replacement reason is mandatory and bounded")
    void validatesReplacementReason() {
        Prescription replacement = pendingPrescription();

        assertThrows(ValidationException.class, () -> replacement.markAsReplacementOf(
                UUID.randomUUID(), "RX000001", "  ", DOCTOR_ID, NOW));
        assertThrows(ValidationException.class, () -> replacement.markAsReplacementOf(
                UUID.randomUUID(), "RX000001", "x".repeat(501), DOCTOR_ID, NOW));
        assertNull(replacement.getReplacesPrescriptionId());
    }

    @Test
    @DisplayName("A link always carries the replaced code and the reason")
    void rejectsIncompleteRestoredReplacement() {
        UUID replacementId = UUID.randomUUID();

        assertThrows(ValidationException.class, () -> Prescription.restore(
                replacementId, "RX000002", UUID.randomUUID(), PrescriptionStatus.PENDING_DISPENSE,
                null, null, DOCTOR_ID, NOW, null, null,
                InterconnectionStatus.NOT_SENT, null, null, null,
                UUID.randomUUID(), null, null,
                List.of(item(replacementId, "Paracetamol"))));
    }

    @Test
    @DisplayName("Replacement metadata is rejected on an ordinary prescription")
    void rejectsReplacementMetadataWithoutLink() {
        UUID prescriptionId = UUID.randomUUID();

        assertThrows(ValidationException.class, () -> Prescription.restore(
                prescriptionId, "RX000002", UUID.randomUUID(), PrescriptionStatus.PENDING_DISPENSE,
                null, null, DOCTOR_ID, NOW, null, null,
                InterconnectionStatus.NOT_SENT, null, null, null,
                null, "RX000001", REASON,
                List.of(item(prescriptionId, "Paracetamol"))));
    }

    @Test
    @DisplayName("A restored replacement exposes the whole chain")
    void restoresReplacementChain() {
        Prescription original = interconnectedPendingPrescription();
        Prescription replacement = pendingPrescription("RX000002");
        replacement.markAsReplacementOf(
                original.getId(), original.getPrescriptionCode(), REASON, DOCTOR_ID, NOW);

        Prescription restored = Prescription.restore(
                replacement.getId(), replacement.getPrescriptionCode(), replacement.getMedicalRecordId(),
                replacement.getStatus(), replacement.getNote(), replacement.getCancelReason(),
                replacement.getPrescribedBy(), replacement.getPrescribedAt(),
                replacement.getUpdatedBy(), replacement.getUpdatedAt(),
                replacement.getInterconnectionStatus(), replacement.getLastInterconnectionAt(),
                replacement.getLastInterconnectionError(), replacement.getInterconnectionReceiptCode(),
                replacement.getReplacesPrescriptionId(), replacement.getReplacesPrescriptionCode(),
                replacement.getReplacementReason(),
                replacement.getItems());

        assertEquals(original.getId(), restored.getReplacesPrescriptionId());
        assertEquals("RX000001", restored.getReplacesPrescriptionCode());
        assertEquals(REASON, restored.getReplacementReason());
    }

    private Prescription interconnectedPendingPrescription() {
        Prescription prescription = pendingPrescription();
        prescription.markInterconnectionSucceeded("LT-20260925-000001", NOW.minusSeconds(300));
        return prescription;
    }

    private Prescription pendingPrescription() {
        return pendingPrescription("RX000001");
    }

    private Prescription pendingPrescription(String prescriptionCode) {
        UUID prescriptionId = UUID.randomUUID();
        return Prescription.restore(
                prescriptionId, prescriptionCode, UUID.randomUUID(), PrescriptionStatus.PENDING_DISPENSE,
                null, null, DOCTOR_ID, NOW.minusSeconds(600), null, null,
                InterconnectionStatus.NOT_SENT, null, null, null,
                List.of(item(prescriptionId, "Paracetamol"))
        );
    }

    private PrescriptionItem item(UUID prescriptionId, String medicineName) {
        return PrescriptionItem.restore(
                UUID.randomUUID(), prescriptionId, UUID.randomUUID(),
                medicineName, "Paracetamol", "500 mg", "vien", "1 vien", 2,
                AdministrationRoute.ORAL, 5, 10, null, NOW.minusSeconds(600), null);
    }
}
