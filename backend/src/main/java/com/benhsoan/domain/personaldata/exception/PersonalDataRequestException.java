package com.benhsoan.domain.personaldata.exception;

import com.benhsoan.domain.shared.exception.DomainErrorCode;
import com.benhsoan.domain.shared.exception.DomainException;

public abstract class PersonalDataRequestException extends DomainException {

    protected PersonalDataRequestException(DomainErrorCode code, String message) {
        super(code, message);
    }
}
