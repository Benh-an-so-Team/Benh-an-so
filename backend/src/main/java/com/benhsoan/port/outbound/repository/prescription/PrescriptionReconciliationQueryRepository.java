package com.benhsoan.port.outbound.repository.prescription;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.benhsoan.port.dto.query.prescription.ReconciliationQueryFilter;
import com.benhsoan.port.dto.result.PrescriptionReconciliationItemResult;

/**
 * Dedicated reconciliation read model for NCL-12-CN-007 CV-02.
 *
 * It deliberately does not reuse the {@code PrescriptionRepository} aggregate mapper,
 * because that mapper loads the prescription items of every row and would therefore issue
 * one extra query per prescription. The reconciliation list is served by a projection plus
 * one batched dispensing query and one batched note-count query, so the number of queries
 * per page is constant regardless of the page size.
 */
public interface PrescriptionReconciliationQueryRepository {

    Page<PrescriptionReconciliationItemResult> findByFilter(
            ReconciliationQueryFilter filter,
            Pageable pageable);
}
