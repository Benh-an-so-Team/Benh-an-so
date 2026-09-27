package com.benhsoan.port.dto.query.prescription;

import java.util.List;

import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.shared.exception.ValidationException;

/**
 * One (dispensing status set, interconnection status set) block used by the reconciliation
 * query filter. Blocks are produced from
 * {@link com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome} so the
 * classification matrix is never duplicated in query code.
 */
public record ReconciliationOutcomeGroup(
        List<PrescriptionStatus> dispensingStatuses,
        List<InterconnectionStatus> interconnectionStatuses
) {

    public ReconciliationOutcomeGroup {
        dispensingStatuses = List.copyOf(dispensingStatuses);
        interconnectionStatuses = List.copyOf(interconnectionStatuses);
        if (dispensingStatuses.isEmpty() || interconnectionStatuses.isEmpty()) {
            throw new ValidationException(
                    "A reconciliation outcome group must declare both dispensing and interconnection statuses.");
        }
    }
}