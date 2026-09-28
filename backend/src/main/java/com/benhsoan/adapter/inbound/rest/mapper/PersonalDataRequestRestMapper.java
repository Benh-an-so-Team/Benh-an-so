package com.benhsoan.adapter.inbound.rest.mapper;

import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.response.personaldata.PersonalDataRequestResponse;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;

@Component
public class PersonalDataRequestRestMapper {

    public PersonalDataRequestResponse toResponse(PersonalDataRequestResult result) {
        if (result == null) {
            return null;
        }
        return new PersonalDataRequestResponse(
                result.id(),
                result.patientId(),
                result.requestType(),
                result.status(),
                result.reason(),
                result.receivedAt(),
                result.dueAt(),
                result.result(),
                result.completedAt(),
                result.processedBy(),
                result.createdAt(),
                result.updatedAt(),
                result.overdue()
        );
    }
}
