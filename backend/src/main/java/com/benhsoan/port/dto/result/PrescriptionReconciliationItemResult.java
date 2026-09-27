package com.benhsoan.port.dto.result;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;

/**
 * One reconciliation row of NCL-12-CN-007.
 *
 * The workbook defines exactly two discrepancy categories, exposed through
 * {@code outcome} plus the {@code discrepancy} boolean. No quantity information
 * (prescribed/dispensed/remaining) is exposed because NCL-12-CN-007 reconciles
 * interconnection state against dispensing state only. No allergy, identity, insurance,
 * phone, address or clinical history data is exposed.
 */
public record PrescriptionReconciliationItemResult(
        UUID prescriptionId,
        String prescriptionCode,
        UUID patientId,
        String patientCode,
        String patientName,
        UUID doctorId,
        String doctorName,
        PrescriptionStatus prescriptionStatus,
        InterconnectionStatus interconnectionStatus,
        PrescriptionReconciliationOutcome outcome,
        boolean discrepancy,
        boolean retransmissionEligible,
        Instant prescribedAt,
        Instant lastInterconnectionAt,
        Instant lastDispensedAt,
        String lastInterconnectionError,
        String interconnectionReceiptCode,
        long reconciliationNoteCount
) {
}
