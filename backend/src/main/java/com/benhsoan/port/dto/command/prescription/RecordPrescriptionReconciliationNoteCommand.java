package com.benhsoan.port.dto.command.prescription;

import java.util.UUID;

/**
 * NCL-12-CN-007: record a reconciliation reason/note for a prescription.
 *
 * Only the prescription and the free text reason come from the client. The discrepancy
 * type, the author and the timestamp are always resolved server side.
 */
public record RecordPrescriptionReconciliationNoteCommand(
        UUID prescriptionId,
        String reason
) {
}
