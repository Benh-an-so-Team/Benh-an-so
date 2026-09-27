package com.benhsoan.port.outbound.repository.survey;

import java.util.UUID;

public record DoctorSatisfactionSummary(
        UUID doctorId,
        String doctorUsername,
        String doctorFullName,
        long totalSurveys,
        double averageScore
) {
}
