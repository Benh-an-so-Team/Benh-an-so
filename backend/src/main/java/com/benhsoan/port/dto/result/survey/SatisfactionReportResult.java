package com.benhsoan.port.dto.result.survey;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record SatisfactionReportResult(
        LocalDate from,
        LocalDate to,
        Instant generatedAt,
        long totalSurveys,
        double averageScore,
        Map<Integer, Long> scoreDistribution,
        List<DoctorSatisfactionItemResult> doctors
) {
}
