package com.benhsoan.port.outbound.repository.survey;

public record SatisfactionOverallSummary(
        long totalSurveys,
        double averageScore
) {
}
