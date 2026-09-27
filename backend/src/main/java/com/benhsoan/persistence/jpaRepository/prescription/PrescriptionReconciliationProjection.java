package com.benhsoan.persistence.jpaRepository.prescription;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;

/**
 * Flat projection for the NCL-12-CN-007 reconciliation list. It carries exactly what the
 * reconciliation row needs plus the identifiers used to resolve the patient and doctor
 * display context inside the same query, so no per-row lookup is required.
 */
public record PrescriptionReconciliationProjection(
        UUID prescriptionId,
        String prescriptionCode,
        UUID medicalRecordId,
        PrescriptionStatus prescriptionStatus,
        InterconnectionStatus interconnectionStatus,
        Instant prescribedAt,
        Instant lastInterconnectionAt,
        String lastInterconnectionError,
        String interconnectionReceiptCode,
        UUID patientId,
        String patientCode,
        String patientName,
        UUID doctorId,
        String doctorName
) {
}
