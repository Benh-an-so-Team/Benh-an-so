package com.benhsoan.persistence.jpaRepository.prescription;

import java.time.Instant;
import java.util.UUID;

/** Batched dispensing aggregate: the last dispensing instant per prescription. */
public record PrescriptionDispenseAggregateProjection(
        UUID prescriptionId,
        Instant lastDispensedAt
) {
}
