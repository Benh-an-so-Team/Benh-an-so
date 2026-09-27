package com.benhsoan.domain.prescription.exception;

import com.benhsoan.domain.shared.exception.DomainErrorCode;

import java.util.UUID;

public class PrescriptionNotFoundException extends PrescriptionException {

    public PrescriptionNotFoundException(UUID prescriptionId) {
        super(DomainErrorCode.PRESCRIPTION_NOT_FOUND,
                "Prescription not found with id: " + prescriptionId
        );
    }

    public PrescriptionNotFoundException(String prescriptionCode) {
        super(DomainErrorCode.PRESCRIPTION_NOT_FOUND,
                "Prescription not found with code: " + prescriptionCode
        );
    }
}
