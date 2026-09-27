package com.benhsoan.port.dto.command.prescription;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.shared.exception.ValidationException;

/**
 * Filters for NCL-12-CN-007 reconciliation listing.
 *
 * Paging is validated here (project convention), while the period range is validated in
 * the application service. When both outcome and discrepanciesOnly are supplied, the
 * explicit outcome wins and discrepanciesOnly is ignored.
 */
public record SearchPrescriptionReconciliationQuery(
        Instant from,
        Instant to,
        PrescriptionReconciliationOutcome outcome,
        boolean discrepanciesOnly,
        String prescriptionCode,
        int page,
        int size
) {

    public SearchPrescriptionReconciliationQuery {
        if (page < 0 || size < 1 || size > 100) {
            throw new ValidationException("Page must be non-negative and size must be between 1 and 100.");
        }
    }

    public List<PrescriptionReconciliationOutcome> requestedOutcomes() {
        if (outcome != null) {
            return List.of(outcome);
        }
        if (!discrepanciesOnly) {
            return List.of();
        }
        return Arrays.stream(PrescriptionReconciliationOutcome.values())
                .filter(PrescriptionReconciliationOutcome::isDiscrepancy)
                .toList();
    }

    public String normalizedPrescriptionCode() {
        return prescriptionCode == null || prescriptionCode.isBlank() ? null : prescriptionCode.trim();
    }
}
