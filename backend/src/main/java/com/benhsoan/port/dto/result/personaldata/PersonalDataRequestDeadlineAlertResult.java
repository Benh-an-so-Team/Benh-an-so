package com.benhsoan.port.dto.result.personaldata;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestDeadlineAlertType;

public record PersonalDataRequestDeadlineAlertResult(
        UUID id,
        UUID personalDataRequestId,
        PersonalDataRequestDeadlineAlertType alertType,
        Instant createdAt
) {
}
