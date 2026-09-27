package com.benhsoan.domain.prescription;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.shared.exception.ValidationException;

import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Append only reconciliation note for NCL-12-CN-007.
 *
 * The workbook states that a discrepant prescription can be handled either by
 * retransmitting the interconnection or by recording a reason/note. This aggregate is
 * the note alternative. It deliberately does not reuse {@code prescriptions.note}
 * (clinical note, immutable once transmitted per QTN-12/QTN-42) nor
 * {@code prescriptions.cancel_reason} (cancellation only), and it has no update or
 * delete behaviour.
 *
 * {@code reconciliationOutcome} is always derived server side from the current
 * prescription state; a client supplied discrepancy type is never accepted.
 */
@Getter
@ToString
@EqualsAndHashCode(of = "id")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PrescriptionReconciliationNote {

    public static final int MAX_REASON_LENGTH = 500;

    private UUID id;

    private UUID prescriptionId;

    private PrescriptionReconciliationOutcome reconciliationOutcome;

    private String reason;

    private UUID notedBy;

    private Instant notedAt;

    private Instant createdAt;

    private PrescriptionReconciliationNote(
            UUID id,
            UUID prescriptionId,
            PrescriptionReconciliationOutcome reconciliationOutcome,
            String reason,
            UUID notedBy,
            Instant notedAt,
            Instant createdAt
    ) {
        this.id = requireNonNull(id, "Reconciliation note id is required.");
        this.prescriptionId = requireNonNull(prescriptionId, "Prescription id is required.");
        this.reconciliationOutcome = requireNonNull(
                reconciliationOutcome, "Reconciliation outcome is required.");
        this.reason = requireReason(reason);
        this.notedBy = requireNonNull(notedBy, "Reconciliation note author is required.");
        this.notedAt = requireNonNull(notedAt, "Reconciliation note time is required.");
        this.createdAt = requireNonNull(createdAt, "Created at is required.");
    }

    public static PrescriptionReconciliationNote create(
            UUID id,
            UUID prescriptionId,
            PrescriptionReconciliationOutcome reconciliationOutcome,
            String reason,
            UUID notedBy,
            Instant notedAt
    ) {
        return new PrescriptionReconciliationNote(
                id, prescriptionId, reconciliationOutcome, reason, notedBy, notedAt, notedAt);
    }

    public static PrescriptionReconciliationNote restore(
            UUID id,
            UUID prescriptionId,
            PrescriptionReconciliationOutcome reconciliationOutcome,
            String reason,
            UUID notedBy,
            Instant notedAt,
            Instant createdAt
    ) {
        return new PrescriptionReconciliationNote(
                id, prescriptionId, reconciliationOutcome, reason, notedBy, notedAt, createdAt);
    }

    private static String requireReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new ValidationException("Reconciliation reason is required.");
        }
        String trimmed = reason.trim();
        if (trimmed.length() > MAX_REASON_LENGTH) {
            throw new ValidationException(
                    "Reconciliation reason must not exceed " + MAX_REASON_LENGTH + " characters.");
        }
        return trimmed;
    }

    private static <T> T requireNonNull(T value, String message) {
        if (Objects.isNull(value)) {
            throw new ValidationException(message);
        }
        return value;
    }
}
