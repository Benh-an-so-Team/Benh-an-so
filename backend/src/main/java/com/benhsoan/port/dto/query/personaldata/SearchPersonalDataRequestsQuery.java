package com.benhsoan.port.dto.query.personaldata;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;

public record SearchPersonalDataRequestsQuery(
        UUID patientId,
        PersonalDataRequestStatus status,
        boolean overdueOnly,
        Instant dueFrom,
        Instant dueTo
) {
}
