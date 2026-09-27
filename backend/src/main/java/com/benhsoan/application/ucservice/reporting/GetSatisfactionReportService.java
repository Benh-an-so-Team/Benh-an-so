package com.benhsoan.application.ucservice.reporting;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.port.dto.result.survey.DoctorSatisfactionItemResult;
import com.benhsoan.port.dto.result.survey.SatisfactionReportResult;
import com.benhsoan.port.inbound.survey.GetSatisfactionReportUseCase;
import com.benhsoan.port.outbound.repository.survey.DoctorSatisfactionSummary;
import com.benhsoan.port.outbound.repository.survey.SatisfactionOverallSummary;
import com.benhsoan.port.outbound.repository.survey.SatisfactionReportQueryRepository;
import com.benhsoan.port.outbound.repository.survey.SatisfactionScoreCount;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetSatisfactionReportService implements GetSatisfactionReportUseCase {

    private final SatisfactionReportQueryRepository reportQueryRepository;
    private final ClockPort clockPort;

    @Override
    public SatisfactionReportResult getReport(LocalDate from, LocalDate to, UUID doctorId) {
        ReportingTimeRange timeRange = ReportingTimeRange.of(from, to);

        SatisfactionOverallSummary overall = reportQueryRepository.getOverallSummary(
                timeRange.fromInclusive(),
                timeRange.toExclusive(),
                doctorId
        );

        List<SatisfactionScoreCount> rawDistribution = reportQueryRepository.getScoreDistribution(
                timeRange.fromInclusive(),
                timeRange.toExclusive(),
                doctorId
        );

        Map<Integer, Long> scoreDistribution = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) {
            scoreDistribution.put(i, 0L);
        }
        for (SatisfactionScoreCount count : rawDistribution) {
            scoreDistribution.put(count.score(), count.count());
        }

        List<DoctorSatisfactionSummary> rawDoctorSummaries = reportQueryRepository.getDoctorSummaries(
                timeRange.fromInclusive(),
                timeRange.toExclusive(),
                doctorId
        );

        List<DoctorSatisfactionItemResult> doctors = rawDoctorSummaries.stream()
                .map(d -> new DoctorSatisfactionItemResult(
                        d.doctorId(),
                        d.doctorUsername(),
                        d.doctorFullName(),
                        d.totalSurveys(),
                        roundToOneDecimal(d.averageScore())
                ))
                .toList();

        return new SatisfactionReportResult(
                from,
                to,
                clockPort.now(),
                overall.totalSurveys(),
                roundToOneDecimal(overall.averageScore()),
                scoreDistribution,
                doctors
        );
    }

    private double roundToOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
