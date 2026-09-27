package com.benhsoan.port.inbound.prescription;

import com.benhsoan.port.dto.command.prescription.RecordPrescriptionReconciliationNoteCommand;
import com.benhsoan.port.dto.result.PrescriptionReconciliationNoteResult;

/**
 * NCL-12-CN-007: record a reason/note explaining a reconciliation discrepancy, as the
 * alternative to retransmitting the interconnection.
 */
public interface RecordPrescriptionReconciliationNoteUseCase {

    PrescriptionReconciliationNoteResult record(RecordPrescriptionReconciliationNoteCommand command);
}
