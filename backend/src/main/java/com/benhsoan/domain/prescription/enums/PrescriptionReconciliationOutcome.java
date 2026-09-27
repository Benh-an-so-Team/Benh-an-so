package com.benhsoan.domain.prescription.enums;

import java.util.Set;

/**
 * NCL-12-CN-007 CV-01/CV-02: reconciliation outcome between the interconnection
 * (NCL-12-CN-004) state and the dispensing (NCL-06-CN-003) state of a prescription.
 *
 * The workbook defines exactly two discrepancy categories for NCL-12-CN-007:
 * {@link #TRANSMITTED_NOT_DISPENSED} (da lien thong nhung chua cap phat) and
 * {@link #DISPENSED_NOT_TRANSMITTED} (da cap phat nhung chua lien thong). Remaining
 * values are non-discrepancy visibility states so the administrator still sees the
 * whole period list. Cancellation against interconnection is outside the story scope
 * and quantity level reconciliation is not part of this story, therefore neither
 * {@link #CANCELLED} nor a partially dispensed prescription introduces a third
 * discrepancy category.
 *
 * Each value also carries the dispensing/interconnection status sets it covers. Those
 * sets are the single source of truth used both by
 * {@link com.benhsoan.domain.prescription.PrescriptionReconciliationClassifier} and by
 * the reconciliation query filter, so the classification matrix is declared once.
 */
public enum PrescriptionReconciliationOutcome {

    /** Interconnection succeeded and the prescription is fully or partially dispensed. */
    CONSISTENT(
            false,
            Set.of(PrescriptionStatus.DISPENSED, PrescriptionStatus.PARTIALLY_DISPENSED),
            Set.of(InterconnectionStatus.SUCCESS)),

    /** Interconnection succeeded but no medication has been dispensed yet. */
    TRANSMITTED_NOT_DISPENSED(
            true,
            Set.of(PrescriptionStatus.PENDING_DISPENSE),
            Set.of(InterconnectionStatus.SUCCESS)),

    /** Medication was dispensed while the interconnection submission is not successful. */
    DISPENSED_NOT_TRANSMITTED(
            true,
            Set.of(PrescriptionStatus.DISPENSED, PrescriptionStatus.PARTIALLY_DISPENSED),
            Set.of(InterconnectionStatus.NOT_SENT, InterconnectionStatus.FAILED)),

    /** Neither transmitted successfully nor dispensed; the normal pre-dispense state. */
    NOT_TRANSMITTED_NOT_DISPENSED(
            false,
            Set.of(PrescriptionStatus.PENDING_DISPENSE),
            Set.of(InterconnectionStatus.NOT_SENT, InterconnectionStatus.FAILED)),

    /** Cancelled prescription: visible for auditing, outside NCL-12-CN-007 reconciliation scope. */
    CANCELLED(
            false,
            Set.of(PrescriptionStatus.CANCELLED),
            Set.of(InterconnectionStatus.NOT_SENT, InterconnectionStatus.SUCCESS, InterconnectionStatus.FAILED)),

    /**
     * Replaced prescription (NCL-12-CN-008): no longer active for dispensing, so it is never
     * a transmission/dispensing discrepancy. Visible for auditing, outside NCL-12-CN-007
     * reconciliation scope, consistent with the treatment of {@link #CANCELLED}.
     */
    REPLACED(
            false,
            Set.of(PrescriptionStatus.REPLACED),
            Set.of(InterconnectionStatus.NOT_SENT, InterconnectionStatus.SUCCESS, InterconnectionStatus.FAILED));

    private final boolean discrepancy;

    private final Set<PrescriptionStatus> dispensingStatuses;

    private final Set<InterconnectionStatus> interconnectionStatuses;

    PrescriptionReconciliationOutcome(
            boolean discrepancy,
            Set<PrescriptionStatus> dispensingStatuses,
            Set<InterconnectionStatus> interconnectionStatuses
    ) {
        this.discrepancy = discrepancy;
        this.dispensingStatuses = Set.copyOf(dispensingStatuses);
        this.interconnectionStatuses = Set.copyOf(interconnectionStatuses);
    }

    public boolean isDiscrepancy() {
        return discrepancy;
    }

    public Set<PrescriptionStatus> dispensingStatuses() {
        return dispensingStatuses;
    }

    public Set<InterconnectionStatus> interconnectionStatuses() {
        return interconnectionStatuses;
    }

    public boolean matches(
            PrescriptionStatus dispensingStatus,
            InterconnectionStatus interconnectionStatus
    ) {
        return dispensingStatus != null
                && interconnectionStatus != null
                && dispensingStatuses.contains(dispensingStatus)
                && interconnectionStatuses.contains(interconnectionStatus);
    }
}
