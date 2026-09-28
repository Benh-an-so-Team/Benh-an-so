package com.benhsoan.port.dto.result.personaldata;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;

public record PersonalDataRequestResult(
        UUID id,
        UUID patientId,
        String requestType,
        PersonalDataRequestStatus status,
        String reason,
        Instant receivedAt,
        Instant dueAt,
        String result,
        Instant completedAt,
        UUID processedBy,
        Instant createdAt,
        Instant updatedAt,
        boolean overdue
) {
}
