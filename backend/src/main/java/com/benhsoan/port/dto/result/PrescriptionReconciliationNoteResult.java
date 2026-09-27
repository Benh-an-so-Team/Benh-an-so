package com.benhsoan.port.dto.result;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;

/**
 * One append only reconciliation note (NCL-12-CN-007).
 *
 * {@code reconciliationOutcome} is the workbook discrepancy type in force when the note
 * was recorded. It is always derived server side from the current prescription state.
 */
public record PrescriptionReconciliationNoteResult(
        UUID id,
        UUID prescriptionId,
        PrescriptionReconciliationOutcome reconciliationOutcome,
        String reason,
        UUID notedBy,
        Instant notedAt
) {
}
