package com.benhsoan.domain.prescription.exception;

import com.benhsoan.domain.shared.exception.DomainErrorCode;

public class UnauthorizedPrescriptionReplacementException extends PrescriptionException {

    public UnauthorizedPrescriptionReplacementException() {
        super(DomainErrorCode.UNAUTHORIZED_PRESCRIPTION_REPLACEMENT,
                "Only the doctor who prescribed the prescription can replace it."
        );
    }

    public UnauthorizedPrescriptionReplacementException(String message) {
        super(DomainErrorCode.UNAUTHORIZED_PRESCRIPTION_REPLACEMENT, message);
    }
}
