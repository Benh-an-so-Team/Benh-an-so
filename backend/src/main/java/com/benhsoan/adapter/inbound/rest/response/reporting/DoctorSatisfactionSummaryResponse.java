package com.benhsoan.adapter.inbound.rest.response.reporting;

import java.util.UUID;

public record DoctorSatisfactionSummaryResponse(
        UUID doctorId,
        String doctorUsername,
        String doctorName,
        long totalSurveys,
        double averageScore
) {
}
