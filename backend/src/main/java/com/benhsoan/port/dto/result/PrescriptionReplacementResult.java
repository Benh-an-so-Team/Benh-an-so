package com.benhsoan.port.dto.result;

public record PrescriptionReplacementResult(
        PrescriptionResult originalPrescription,
        PrescriptionResult replacementPrescription,
        PrescriptionInterconnectionResult interconnection
) {
}
