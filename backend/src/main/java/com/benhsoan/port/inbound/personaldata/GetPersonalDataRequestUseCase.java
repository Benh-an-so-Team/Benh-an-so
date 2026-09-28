package com.benhsoan.port.inbound.personaldata;

import java.util.UUID;

import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;

public interface GetPersonalDataRequestUseCase {

    PersonalDataRequestResult getById(UUID id);
}
