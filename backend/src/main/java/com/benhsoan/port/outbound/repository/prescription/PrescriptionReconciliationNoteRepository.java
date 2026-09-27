package com.benhsoan.port.outbound.repository.prescription;

import java.util.List;
import java.util.UUID;

import com.benhsoan.domain.prescription.PrescriptionReconciliationNote;

/**
 * Append only persistence for NCL-12-CN-007 reconciliation notes.
 *
 * There is intentionally no update operation and no delete operation on this port: the notes are
 * a history that explains why a discrepancy was accepted instead of retransmitted. They are only
 * ever removed by {@code MedicalRecordCascadeDeleter}, together with the prescription they belong
 * to, exactly like the other prescription child tables.
 */
public interface PrescriptionReconciliationNoteRepository {

    PrescriptionReconciliationNote save(PrescriptionReconciliationNote note);

    List<PrescriptionReconciliationNote> findByPrescriptionId(UUID prescriptionId);
}
