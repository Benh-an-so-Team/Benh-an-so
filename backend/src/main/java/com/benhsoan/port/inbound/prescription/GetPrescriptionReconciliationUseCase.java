package com.benhsoan.port.inbound.prescription;

import org.springframework.data.domain.Page;

import com.benhsoan.port.dto.command.prescription.SearchPrescriptionReconciliationQuery;
import com.benhsoan.port.dto.result.PrescriptionReconciliationItemResult;

/**
 * NCL-12-CN-007 CV-02: list prescriptions by interconnection status and dispensing status
 * and flag the reconciliation discrepancies of the selected period.
 */
public interface GetPrescriptionReconciliationUseCase {

    Page<PrescriptionReconciliationItemResult> search(SearchPrescriptionReconciliationQuery query);
}
