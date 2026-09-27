package com.benhsoan.adapter.inbound.rest.response.personaldata;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestDeadlineAlertType;

public record PersonalDataRequestDeadlineAlertResponse(
        UUID id,
        UUID personalDataRequestId,
        PersonalDataRequestDeadlineAlertType alertType,
        Instant createdAt
) {
}
