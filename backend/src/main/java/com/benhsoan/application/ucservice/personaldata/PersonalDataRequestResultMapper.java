package com.benhsoan.application.ucservice.personaldata;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class PersonalDataRequestResultMapper {

    private final ClockPort clockPort;

    public PersonalDataRequestResult toResult(PersonalDataRequest request) {
        if (request == null) {
            return null;
        }
        return new PersonalDataRequestResult(
                request.getId(),
                request.getPatientId(),
                request.getRequestType(),
                request.getStatus(),
                request.getReason(),
                request.getReceivedAt(),
                request.getDueAt(),
                request.getResult(),
                request.getCompletedAt(),
                request.getProcessedBy(),
                request.getCreatedAt(),
                request.getUpdatedAt(),
                request.isOverdue(clockPort.now())
        );
    }
}
