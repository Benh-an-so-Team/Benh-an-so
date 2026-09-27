package com.benhsoan.adapter.inbound.rest.response.prescription;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;

/**
 * One NCL-12-CN-007 reconciliation row.
 *
 * outcome plus discrepancy express the two workbook discrepancy categories. Quantity fields
 * (prescribed/dispensed/remaining) are intentionally absent because this story reconciles
 * interconnection state against dispensing state only. No allergy, identity, insurance,
 * phone, address or clinical history data is exposed.
 */
public record PrescriptionReconciliationItemResponse(
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
