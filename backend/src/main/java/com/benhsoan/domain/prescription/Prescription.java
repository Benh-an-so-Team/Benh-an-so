package com.benhsoan.domain.prescription;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyCancelledException;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyDispensedException;
import com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException;
import com.benhsoan.domain.shared.exception.ValidationException;

import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Getter
@ToString
@EqualsAndHashCode(of = "id")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Prescription {

    private static final int MAX_REPLACEMENT_REASON_LENGTH = 500;

    private static final String REPLACEMENT_REJECTED_WHEN_DISPENSED_MESSAGE =
            "Dispensed prescriptions cannot be replaced. Please prescribe a new prescription for the visit instead.";

    private UUID id;

    private String prescriptionCode;

    private UUID medicalRecordId;

    private PrescriptionStatus status;

    private String note;

    private String cancelReason;

    private UUID prescribedBy;

    private Instant prescribedAt;

    private UUID updatedBy;

    private Instant updatedAt;

    private InterconnectionStatus interconnectionStatus;

    private Instant lastInterconnectionAt;

    private String lastInterconnectionError;

    private String interconnectionReceiptCode;

    private UUID replacesPrescriptionId;

    private String replacesPrescriptionCode;

    private String replacementReason;

    private List<PrescriptionItem> items;

    private Prescription(
            UUID id,
            String prescriptionCode,
            UUID medicalRecordId,
            PrescriptionStatus status,
            String note,
            String cancelReason,
            UUID prescribedBy,
            Instant prescribedAt,
            UUID updatedBy,
            Instant updatedAt,
            InterconnectionStatus interconnectionStatus,
            Instant lastInterconnectionAt,
            String lastInterconnectionError,
            String interconnectionReceiptCode,
            UUID replacesPrescriptionId,
            String replacesPrescriptionCode,
            String replacementReason,
            List<PrescriptionItem> items
    ) {
        this.id = requireNonNull(id, "Prescription id is required.");
        this.prescriptionCode = requireText(prescriptionCode, "Prescription code is required.");
        this.medicalRecordId = requireNonNull(medicalRecordId, "Medical record id is required.");
        this.status = requireNonNull(status, "Prescription status is required.");
        this.note = normalizeOptionalText(note);
        this.cancelReason = normalizeOptionalText(cancelReason);
        this.prescribedBy = requireNonNull(prescribedBy, "Prescribing doctor id is required.");
        this.prescribedAt = requireNonNull(prescribedAt, "Prescription time is required.");
        this.updatedBy = updatedBy;
        this.updatedAt = updatedAt;
        this.interconnectionStatus = requireNonNull(interconnectionStatus, "Interconnection status is required.");
        this.lastInterconnectionAt = lastInterconnectionAt;
        this.lastInterconnectionError = normalizeOptionalText(lastInterconnectionError);
        this.interconnectionReceiptCode = normalizeOptionalText(interconnectionReceiptCode);
        this.replacesPrescriptionId = replacesPrescriptionId;
        this.replacesPrescriptionCode = normalizeOptionalText(replacesPrescriptionCode);
        this.replacementReason = normalizeOptionalText(replacementReason);
        validateReplacementState();
        validateInterconnectionState();
        this.items = validateAndCopyItems(items, id);
    }

    public static Prescription create(
            UUID id,
            String prescriptionCode,
            UUID medicalRecordId,
            String note,
            UUID prescribedBy,
            Instant prescribedAt,
            List<PrescriptionItem> items
    ) {
        return new Prescription(
                id,
                prescriptionCode,
                medicalRecordId,
                PrescriptionStatus.PENDING_DISPENSE,
                note,
                null,
                prescribedBy,
                prescribedAt,
                null,
                null,
                InterconnectionStatus.NOT_SENT,
                null,
                null,
                null,
                null,
                null,
                null,
                items
        );
    }

    public static Prescription restore(
            UUID id,
            String prescriptionCode,
            UUID medicalRecordId,
            PrescriptionStatus status,
            String note,
            UUID prescribedBy,
            Instant prescribedAt,
            UUID updatedBy,
            Instant updatedAt,
            List<PrescriptionItem> items
    ) {
        return restore(
                id, prescriptionCode, medicalRecordId, status, note, null, prescribedBy, prescribedAt,
                updatedBy, updatedAt, InterconnectionStatus.NOT_SENT, null, null, null, null, null, null, items
        );
    }

    public static Prescription restore(
            UUID id,
            String prescriptionCode,
            UUID medicalRecordId,
            PrescriptionStatus status,
            String note,
            UUID prescribedBy,
            Instant prescribedAt,
            UUID updatedBy,
            Instant updatedAt,
            InterconnectionStatus interconnectionStatus,
            Instant lastInterconnectionAt,
            String lastInterconnectionError,
            String interconnectionReceiptCode,
            List<PrescriptionItem> items
    ) {
        return restore(
                id, prescriptionCode, medicalRecordId, status, note, null, prescribedBy, prescribedAt,
                updatedBy, updatedAt, interconnectionStatus, lastInterconnectionAt, lastInterconnectionError,
                interconnectionReceiptCode, null, null, null, items
        );
    }

    public static Prescription restore(
            UUID id,
            String prescriptionCode,
            UUID medicalRecordId,
            PrescriptionStatus status,
            String note,
            String cancelReason,
            UUID prescribedBy,
            Instant prescribedAt,
            UUID updatedBy,
            Instant updatedAt,
            InterconnectionStatus interconnectionStatus,
            Instant lastInterconnectionAt,
            String lastInterconnectionError,
            String interconnectionReceiptCode,
            List<PrescriptionItem> items
    ) {
        return restore(
                id, prescriptionCode, medicalRecordId, status, note, cancelReason, prescribedBy, prescribedAt,
                updatedBy, updatedAt, interconnectionStatus, lastInterconnectionAt, lastInterconnectionError,
                interconnectionReceiptCode, null, null, null, items
        );
    }

    public static Prescription restore(
            UUID id,
            String prescriptionCode,
            UUID medicalRecordId,
            PrescriptionStatus status,
            String note,
            String cancelReason,
            UUID prescribedBy,
            Instant prescribedAt,
            UUID updatedBy,
            Instant updatedAt,
            InterconnectionStatus interconnectionStatus,
            Instant lastInterconnectionAt,
            String lastInterconnectionError,
            String interconnectionReceiptCode,
            UUID replacesPrescriptionId,
            String replacesPrescriptionCode,
            String replacementReason,
            List<PrescriptionItem> items
    ) {
        return new Prescription(
                id,
                prescriptionCode,
                medicalRecordId,
                status,
                note,
                cancelReason,
                prescribedBy,
                prescribedAt,
                updatedBy,
                updatedAt,
                interconnectionStatus,
                lastInterconnectionAt,
                lastInterconnectionError,
                interconnectionReceiptCode,
                replacesPrescriptionId,
                replacesPrescriptionCode,
                replacementReason,
                items
        );
    }

    public void markInterconnectionSucceeded(String receiptCode, Instant completedAt) {
        ensureNotInterconnected();
        this.interconnectionStatus = InterconnectionStatus.SUCCESS;
        this.lastInterconnectionAt = requireNonNull(completedAt, "Interconnection completion time is required.");
        this.lastInterconnectionError = null;
        this.interconnectionReceiptCode = requireText(receiptCode, "Interconnection receipt code is required.");
    }

    public void markInterconnectionFailed(String failureReason, Instant completedAt) {
        ensureNotInterconnected();
        this.interconnectionStatus = InterconnectionStatus.FAILED;
        this.lastInterconnectionAt = requireNonNull(completedAt, "Interconnection completion time is required.");
        this.lastInterconnectionError = requireText(failureReason, "Interconnection failure reason is required.");
        this.interconnectionReceiptCode = null;
    }

    public void markAsReplacementOf(
            UUID originalPrescriptionId,
            String originalPrescriptionCode,
            String reason,
            UUID updatedBy,
            Instant updatedAt
    ) {
        if (replacesPrescriptionId != null) {
            throw new PrescriptionInvalidStatusException(
                    "Prescription is already linked to the prescription it replaces."
            );
        }
        if (id.equals(originalPrescriptionId)) {
            throw new ValidationException("A prescription cannot replace itself.");
        }
        ensurePendingDispense("Only pending prescriptions can be issued as a replacement.");
        if (interconnectionStatus != InterconnectionStatus.NOT_SENT) {
            throw new ValidationException(
                    "A replacement prescription must not inherit the interconnection state of the original prescription."
            );
        }
        UUID validatedOriginalId = requireNonNull(
                originalPrescriptionId, "Replaced prescription id is required.");
        String validatedOriginalCode = requireText(
                originalPrescriptionCode, "Replaced prescription code is required.");
        String validatedReason = validateReplacementReason(reason);

        this.replacesPrescriptionId = validatedOriginalId;
        this.replacesPrescriptionCode = validatedOriginalCode;
        this.replacementReason = validatedReason;
        this.updatedBy = requireNonNull(updatedBy, "Prescription updater id is required.");
        this.updatedAt = requireNonNull(updatedAt, "Prescription update time is required.");
    }

    public void ensureReplaceable() {
        if (interconnectionStatus != InterconnectionStatus.SUCCESS) {
            throw new PrescriptionInvalidStatusException(
                    "Only successfully interconnected prescriptions can be replaced."
            );
        }
        if (status == PrescriptionStatus.DISPENSED || status == PrescriptionStatus.PARTIALLY_DISPENSED) {
            throw new PrescriptionAlreadyDispensedException(REPLACEMENT_REJECTED_WHEN_DISPENSED_MESSAGE);
        }
        if (status == PrescriptionStatus.CANCELLED) {
            throw new PrescriptionAlreadyCancelledException();
        }
        if (status == PrescriptionStatus.REPLACED) {
            throw new PrescriptionInvalidStatusException("Prescription has already been replaced.");
        }
    }

    public void markReplaced(UUID replacedBy, Instant replacedAt) {
        ensureReplaceable();
        this.status = PrescriptionStatus.REPLACED;
        this.updatedBy = requireNonNull(replacedBy, "Prescription updater id is required.");
        this.updatedAt = requireNonNull(replacedAt, "Prescription update time is required.");
    }

    public void replaceItems(
            List<PrescriptionItem> replacementItems,
            String note,
            UUID updatedBy,
            Instant updatedAt
    ) {
        ensurePendingDispense("Only pending prescriptions can be amended.");
        List<PrescriptionItem> validatedItems = validateAndCopyItems(replacementItems, id);
        String normalizedNote = normalizeOptionalText(note);
        UUID validatedUpdatedBy = requireNonNull(updatedBy, "Prescription updater id is required.");
        Instant validatedUpdatedAt = requireNonNull(updatedAt, "Prescription update time is required.");

        this.items = validatedItems;
        this.note = normalizedNote;
        this.updatedBy = validatedUpdatedBy;
        this.updatedAt = validatedUpdatedAt;
    }

    public void markDispensed(UUID dispensedBy, Instant dispensedAt) {
        if (status == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }
        if (status == PrescriptionStatus.CANCELLED) {
            throw new PrescriptionInvalidStatusException("Cancelled prescriptions cannot be dispensed.");
        }
        ensureNotReplaced("Replaced prescriptions can no longer be dispensed.");

        UUID validatedDispensedBy = requireNonNull(dispensedBy, "Dispensing user id is required.");
        Instant validatedDispensedAt = requireNonNull(dispensedAt, "Dispensing time is required.");
        this.status = PrescriptionStatus.DISPENSED;
        this.updatedBy = validatedDispensedBy;
        this.updatedAt = validatedDispensedAt;
    }

    public void markPartiallyDispensed(UUID dispensedBy, Instant dispensedAt) {
        if (status == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }
        if (status == PrescriptionStatus.CANCELLED) {
            throw new PrescriptionInvalidStatusException("Cancelled prescriptions cannot be dispensed.");
        }
        ensureNotReplaced("Replaced prescriptions can no longer be dispensed.");

        UUID validatedDispensedBy = requireNonNull(dispensedBy, "Dispensing user id is required.");
        Instant validatedDispensedAt = requireNonNull(dispensedAt, "Dispensing time is required.");
        this.status = PrescriptionStatus.PARTIALLY_DISPENSED;
        this.updatedBy = validatedDispensedBy;
        this.updatedAt = validatedDispensedAt;
    }

    public void cancel(String cancelReason, UUID cancelledBy, Instant cancelledAt) {
        if (status == PrescriptionStatus.CANCELLED) {
            throw new PrescriptionAlreadyCancelledException();
        }
        if (status == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }
        if (status == PrescriptionStatus.PARTIALLY_DISPENSED) {
            throw new PrescriptionAlreadyDispensedException(
                    "Partially dispensed prescriptions cannot be cancelled. Inventory has already been deducted."
            );
        }
        ensureNotReplaced("Replaced prescriptions cannot be cancelled.");

        String validatedReason = requireText(cancelReason, "Cancellation reason is required.");
        if (validatedReason.length() > 500) {
            throw new ValidationException("Cancellation reason must not exceed 500 characters.");
        }
        this.cancelReason = validatedReason;
        UUID validatedCancelledBy = requireNonNull(cancelledBy, "Cancelling user id is required.");
        Instant validatedCancelledAt = requireNonNull(cancelledAt, "Cancellation time is required.");
        this.status = PrescriptionStatus.CANCELLED;
        this.updatedBy = validatedCancelledBy;
        this.updatedAt = validatedCancelledAt;
    }

    public boolean isPendingDispense() {
        return status == PrescriptionStatus.PENDING_DISPENSE;
    }

    public boolean isPartiallyDispensed() {
        return status == PrescriptionStatus.PARTIALLY_DISPENSED;
    }

    public void recomputeStatusAfterReturn(UUID returnedBy, Instant returnedAt, String returnReason) {
        if (status != PrescriptionStatus.DISPENSED && status != PrescriptionStatus.PARTIALLY_DISPENSED) {
            throw new PrescriptionInvalidStatusException(
                    "Only dispensed or partially dispensed prescriptions can accept medication returns."
            );
        }

        UUID validatedReturnedBy = requireNonNull(returnedBy, "Returning user id is required.");
        Instant validatedReturnedAt = requireNonNull(returnedAt, "Return time is required.");

        boolean anyDispensed = items.stream().anyMatch(item -> item.getDispensedQuantity() > 0);
        if (anyDispensed) {
            this.status = PrescriptionStatus.PARTIALLY_DISPENSED;
            this.cancelReason = null;
        } else {
            this.status = PrescriptionStatus.CANCELLED;
            this.cancelReason = normalizeOptionalText(returnReason);
        }
        this.updatedBy = validatedReturnedBy;
        this.updatedAt = validatedReturnedAt;
    }

    private void ensurePendingDispense(String message) {
        if (!isPendingDispense()) {
            throw new PrescriptionInvalidStatusException(message);
        }
    }

    private void ensureNotReplaced(String message) {
        if (status == PrescriptionStatus.REPLACED) {
            throw new PrescriptionInvalidStatusException(message);
        }
    }

    private void ensureNotInterconnected() {
        if (interconnectionStatus == InterconnectionStatus.SUCCESS) {
            throw new PrescriptionInvalidStatusException(
                    "Successfully interconnected prescriptions cannot be submitted again."
            );
        }
    }

    private void validateInterconnectionState() {
        boolean valid = switch (interconnectionStatus) {
            case NOT_SENT -> lastInterconnectionAt == null
                    && lastInterconnectionError == null
                    && interconnectionReceiptCode == null;
            case SUCCESS -> lastInterconnectionAt != null
                    && lastInterconnectionError == null
                    && interconnectionReceiptCode != null;
            case FAILED -> lastInterconnectionAt != null
                    && lastInterconnectionError != null
                    && interconnectionReceiptCode == null;
        };
        if (!valid) {
            throw new ValidationException("Prescription interconnection state is inconsistent.");
        }
    }

    private void validateReplacementState() {
        boolean linked = replacesPrescriptionId != null;
        if (linked && (replacesPrescriptionCode == null || replacementReason == null)) {
            throw new ValidationException(
                    "A replacement prescription requires the replaced prescription code and a replacement reason."
            );
        }
        if (!linked && (replacesPrescriptionCode != null || replacementReason != null)) {
            throw new ValidationException(
                    "Replacement metadata is only allowed on a replacement prescription."
            );
        }
        if (linked && replacesPrescriptionId.equals(id)) {
            throw new ValidationException("A prescription cannot replace itself.");
        }
    }

    private static List<PrescriptionItem> validateAndCopyItems(
            List<PrescriptionItem> items,
            UUID prescriptionId
    ) {
        if (items == null || items.isEmpty()) {
            throw new ValidationException("Prescription must contain at least one medicine.");
        }

        Set<UUID> medicineIds = new HashSet<>();
        for (PrescriptionItem item : items) {
            if (item == null) {
                throw new ValidationException("Prescription item is required.");
            }
            if (!prescriptionId.equals(item.getPrescriptionId())) {
                throw new ValidationException(
                        "Prescription item does not belong to prescription: " + prescriptionId
                );
            }
            if (!medicineIds.add(item.getMedicineId())) {
                throw new ValidationException("Medicine already exists in the prescription: " + item.getMedicineId());
            }
        }

        return List.copyOf(items);
    }

    private static String normalizeOptionalText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String validateReplacementReason(String replacementReason) {
        String validatedReason = requireText(replacementReason, "Replacement reason is required.");
        if (validatedReason.length() > MAX_REPLACEMENT_REASON_LENGTH) {
            throw new ValidationException(
                    "Replacement reason must not exceed " + MAX_REPLACEMENT_REASON_LENGTH + " characters."
            );
        }
        return validatedReason;
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ValidationException(message);
        }
        return value.trim();
    }

    private static <T> T requireNonNull(T value, String message) {
        if (Objects.isNull(value)) {
            throw new ValidationException(message);
        }
        return value;
    }
}
