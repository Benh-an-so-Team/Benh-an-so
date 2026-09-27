package com.benhsoan.adapter.inbound.rest.response.reporting;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record SatisfactionReportResponse(
        LocalDate from,
        LocalDate to,
        Instant generatedAt,
        long totalSurveys,
        double averageScore,
        Map<Integer, Long> scoreDistribution,
        List<DoctorSatisfactionSummaryResponse> doctors
) {
}
