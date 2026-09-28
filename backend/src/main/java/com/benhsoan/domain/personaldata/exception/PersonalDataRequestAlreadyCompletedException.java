package com.benhsoan.domain.personaldata.exception;

import java.util.UUID;

import com.benhsoan.domain.shared.exception.DomainErrorCode;

public class PersonalDataRequestAlreadyCompletedException extends PersonalDataRequestException {

    public PersonalDataRequestAlreadyCompletedException(UUID id) {
        super(DomainErrorCode.PERSONAL_DATA_REQUEST_ALREADY_COMPLETED,
                "Personal data request is already completed: " + id);
    }
}
