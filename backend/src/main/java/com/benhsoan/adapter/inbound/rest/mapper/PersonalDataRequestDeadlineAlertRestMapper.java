package com.benhsoan.adapter.inbound.rest.mapper;

import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.response.personaldata.PersonalDataRequestDeadlineAlertResponse;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineAlertResult;

@Component
public class PersonalDataRequestDeadlineAlertRestMapper {

    public PersonalDataRequestDeadlineAlertResponse toResponse(PersonalDataRequestDeadlineAlertResult result) {
        if (result == null) {
            return null;
        }
        return new PersonalDataRequestDeadlineAlertResponse(
                result.id(),
                result.personalDataRequestId(),
                result.alertType(),
                result.createdAt());
    }
}
