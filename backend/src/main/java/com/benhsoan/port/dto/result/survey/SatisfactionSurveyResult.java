package com.benhsoan.port.dto.result.survey;

import java.time.Instant;
import java.util.UUID;

public record SatisfactionSurveyResult(
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
