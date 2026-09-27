package com.benhsoan.persistence.jpaRepository.prescription;

import java.util.UUID;

/** Batched reconciliation note count per prescription. */
public record PrescriptionReconciliationNoteCountProjection(
        UUID prescriptionId,
        Long noteCount
) {
}
