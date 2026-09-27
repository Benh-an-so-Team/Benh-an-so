package com.benhsoan.adapter.inbound.rest.response.prescription;

import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;

public record PrescriptionReplacementResponse(
        PrescriptionResponse originalPrescription,
        PrescriptionResponse replacementPrescription,
        PrescriptionInterconnectionResult interconnection
) {
}
