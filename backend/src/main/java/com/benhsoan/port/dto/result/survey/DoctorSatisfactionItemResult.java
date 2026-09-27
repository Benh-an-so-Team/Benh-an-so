package com.benhsoan.port.dto.result.survey;

import java.util.UUID;

public record DoctorSatisfactionItemResult(
        UUID doctorId,
        String doctorUsername,
        String doctorName,
        long totalSurveys,
        double averageScore
) {
}
