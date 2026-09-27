package com.benhsoan.adapter.inbound.rest.response.survey;

import java.time.Instant;
import java.util.UUID;

public record SatisfactionSurveyResponse(
        UUID id,
        UUID visitId,
        String visitCode,
        UUID patientId,
        UUID doctorId,
        String doctorName,
        int score,
        String comment,
        Instant createdAt,
        Instant updatedAt
) {
}
