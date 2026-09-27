package com.benhsoan.adapter.inbound.rest.mapper;

import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionReconciliationItemResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionReconciliationNoteResponse;
import com.benhsoan.port.dto.result.PrescriptionReconciliationItemResult;
import com.benhsoan.port.dto.result.PrescriptionReconciliationNoteResult;

@Component
public class PrescriptionReconciliationRestMapper {

    public PrescriptionReconciliationItemResponse toItemResponse(
            PrescriptionReconciliationItemResult result
    ) {
        return new PrescriptionReconciliationItemResponse(
                result.prescriptionId(),
                result.prescriptionCode(),
                result.patientId(),
                result.patientCode(),
                result.patientName(),
                result.doctorId(),
                result.doctorName(),
                result.prescriptionStatus(),
                result.interconnectionStatus(),
                result.outcome(),
                result.discrepancy(),
                result.retransmissionEligible(),
                result.prescribedAt(),
                result.lastInterconnectionAt(),
                result.lastDispensedAt(),
                result.lastInterconnectionError(),
                result.interconnectionReceiptCode(),
                result.reconciliationNoteCount());
    }

    public PrescriptionReconciliationNoteResponse toNoteResponse(
            PrescriptionReconciliationNoteResult result
    ) {
        return new PrescriptionReconciliationNoteResponse(
                result.id(),
                result.prescriptionId(),
                result.reconciliationOutcome(),
                result.reason(),
                result.notedBy(),
                result.notedAt());
    }
}
