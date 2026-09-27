package com.benhsoan.adapter.inbound.rest.response.prescription;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;

/**
 * One append only reconciliation note. reconciliationOutcome is the workbook discrepancy type
 * in force when the note was recorded, always derived server side.
 */
public record PrescriptionReconciliationNoteResponse(
        UUID id,
        UUID prescriptionId,
        PrescriptionReconciliationOutcome reconciliationOutcome,
        String reason,
        UUID notedBy,
        Instant notedAt
) {
}
