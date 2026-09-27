package com.benhsoan.port.inbound.prescription;

import java.util.List;
import java.util.UUID;

import com.benhsoan.port.dto.result.PrescriptionReconciliationNoteResult;

/**
 * NCL-12-CN-007: read the append only reconciliation note history of a prescription.
 */
public interface GetPrescriptionReconciliationNotesUseCase {

    List<PrescriptionReconciliationNoteResult> getNotes(UUID prescriptionId);
}
