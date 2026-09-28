package com.benhsoan.domain.personaldata.exception;

import java.util.UUID;

import com.benhsoan.domain.shared.exception.DomainErrorCode;

public class PersonalDataRequestNotFoundException extends PersonalDataRequestException {

    public PersonalDataRequestNotFoundException(UUID id) {
        super(DomainErrorCode.PERSONAL_DATA_REQUEST_NOT_FOUND,
                "Personal data request not found: " + id);
    }
}
