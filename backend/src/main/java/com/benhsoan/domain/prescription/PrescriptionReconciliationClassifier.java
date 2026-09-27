package com.benhsoan.domain.prescription;

import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.shared.exception.ValidationException;

/**
 * Pure, framework independent reconciliation policy for NCL-12-CN-007.
 *
 * Reconciliation is derived from the two states the system already maintains:
 * {@code prescriptions.interconnection_status} (NCL-12-CN-004) and
 * {@code prescriptions.status} (NCL-06-CN-003 / NCL-06-CN-008). No new reconciliation
 * state is persisted and no new status value is invented.
 *
 * Retransmission eligibility is not a new rule: it is the literal projection of the
 * existing NCL-12-CN-004 retry precondition (RetryPrescriptionInterconnectionService
 * accepts only FAILED). NCL-12-CN-007 never widens retransmission, so nothing here can
 * enable a retry the original feature would have rejected.
 */
public final class PrescriptionReconciliationClassifier {

    private PrescriptionReconciliationClassifier() {
    }

    public static PrescriptionReconciliationOutcome classify(
            PrescriptionStatus dispensingStatus,
            InterconnectionStatus interconnectionStatus
    ) {
        requirePresent(dispensingStatus, interconnectionStatus);
        for (PrescriptionReconciliationOutcome outcome : PrescriptionReconciliationOutcome.values()) {
            if (outcome.matches(dispensingStatus, interconnectionStatus)) {
                return outcome;
            }
        }
        throw new ValidationException(
                "Unsupported reconciliation state: " + dispensingStatus + " / " + interconnectionStatus + ".");
    }

    public static boolean isDiscrepancy(
            PrescriptionStatus dispensingStatus,
            InterconnectionStatus interconnectionStatus
    ) {
        return classify(dispensingStatus, interconnectionStatus).isDiscrepancy();
    }

    public static boolean isRetransmissionEligible(InterconnectionStatus interconnectionStatus) {
        if (interconnectionStatus == null) {
            throw new ValidationException("Interconnection status is required for reconciliation.");
        }
        return interconnectionStatus == InterconnectionStatus.FAILED;
    }

    private static void requirePresent(
            PrescriptionStatus dispensingStatus,
            InterconnectionStatus interconnectionStatus
    ) {
        if (dispensingStatus == null) {
            throw new ValidationException("Prescription dispensing status is required for reconciliation.");
        }
        if (interconnectionStatus == null) {
            throw new ValidationException("Interconnection status is required for reconciliation.");
        }
    }
}
