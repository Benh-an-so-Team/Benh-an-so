package com.benhsoan.port.dto.query.prescription;

import java.time.Instant;
import java.util.List;

/**
 * Technical filter handed to the reconciliation query repository.
 *
 * Period semantics (locked): a prescription belongs to [from, to) when its
 * prescribedAt, its lastInterconnectionAt, or any dispense item dispensedAt falls inside
 * the half open interval. Nulls mean unbounded on that side.
 *
 * outcomeGroups use OR semantics and are limited only by what the caller can express: the
 * persistence layer expands any number of groups.
 */
public record ReconciliationQueryFilter(
        Instant fromInclusive,
        Instant toExclusive,
        String prescriptionCode,
        List<ReconciliationOutcomeGroup> outcomeGroups
) {

    public ReconciliationQueryFilter {
        outcomeGroups = List.copyOf(outcomeGroups);
    }

    /** True when neither bound is supplied, so the period predicate must be skipped. */
    public boolean periodUnbounded() {
        return fromInclusive == null && toExclusive == null;
    }
}