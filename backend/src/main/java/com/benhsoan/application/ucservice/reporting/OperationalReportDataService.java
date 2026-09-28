package com.benhsoan.application.ucservice.reporting;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.reporting.enums.ReportType;
import com.benhsoan.port.dto.result.DiseasePatternItemResult;
import com.benhsoan.port.dto.result.DiseasePatternReportResult;
import com.benhsoan.port.dto.result.DoctorVisitsReportResult;
import com.benhsoan.port.dto.result.DoctorVisitSummaryResult;
import com.benhsoan.port.dto.result.OperationalSummaryResult;
import com.benhsoan.port.dto.result.OperationalTimelineItemResult;
import com.benhsoan.port.dto.result.OperationalTimelineResult;
import com.benhsoan.port.dto.result.TopMedicineItemResult;
import com.benhsoan.port.dto.result.TopMedicinesReportResult;
import com.benhsoan.port.outbound.repository.reporting.DailyRevenueSummary;
import com.benhsoan.port.outbound.repository.reporting.DailyVisitSummary;
import com.benhsoan.port.outbound.repository.reporting.DiseasePatternSummary;
import com.benhsoan.port.outbound.repository.reporting.DoctorVisitSummary;
import com.benhsoan.port.outbound.repository.reporting.OperationalReportQueryRepository;
import com.benhsoan.port.outbound.repository.reporting.VisitReportDetailItem;
import com.benhsoan.port.outbound.time.ClockPort;

import java.util.UUID;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OperationalReportDataService {

    private static final String DEFAULT_CURRENCY = "VND";

    private final OperationalReportQueryRepository operationalReportQueryRepository;
    private final ClockPort clockPort;

    public OperationalSummaryResult getSummary(LocalDate from, LocalDate to) {
        ReportingTimeRange range = ReportingTimeRange.of(from, to);

        return new OperationalSummaryResult(
                from,
                to,
                operationalReportQueryRepository.countCompletedVisits(range.fromInclusive(), range.toExclusive()),
                operationalReportQueryRepository.sumNetRevenue(range.fromInclusive(), range.toExclusive()),
                DEFAULT_CURRENCY);
    }

    public OperationalTimelineResult getTimeline(LocalDate from, LocalDate to) {
        ReportingTimeRange range = ReportingTimeRange.of(from, to);
        Map<LocalDate, Long> visitsByDate = aggregateVisitsByDate(
                operationalReportQueryRepository.findDailyCompletedVisits(range.fromInclusive(), range.toExclusive()));
        Map<LocalDate, BigDecimal> revenueByDate = aggregateRevenueByDate(
                operationalReportQueryRepository.findDailyNetRevenue(range.fromInclusive(), range.toExclusive()));

        return new OperationalTimelineResult(from, to, buildItems(from, to, visitsByDate, revenueByDate));
    }

    public OperationalReportData getReportData(LocalDate from, LocalDate to) {
        return new OperationalReportData(
                getSummary(from, to),
                getTimeline(from, to));
    }

    public List<VisitReportDetailItem> getCompletedVisitDetails(LocalDate from, LocalDate to) {
        return getCompletedVisitDetails(from, to, null);
    }

    public List<VisitReportDetailItem> getCompletedVisitDetails(LocalDate from, LocalDate to, UUID doctorId) {
        ReportingTimeRange range = ReportingTimeRange.of(from, to);
        return operationalReportQueryRepository.findCompletedVisitDetails(
                range.fromInclusive(),
                range.toExclusive(),
                doctorId);
    }

    public boolean hasReportData(ReportType reportType, LocalDate from, LocalDate to) {
        return hasReportData(reportType, from, to, null);
    }

    public boolean hasReportData(ReportType reportType, LocalDate from, LocalDate to, UUID doctorId) {
        ReportingTimeRange range = ReportingTimeRange.of(from, to);
        return switch (reportType) {
            case VISIT_REPORT -> operationalReportQueryRepository.hasCompletedVisits(
                    range.fromInclusive(), range.toExclusive());
            case REVENUE_REPORT -> operationalReportQueryRepository.hasInvoices(
                    range.fromInclusive(), range.toExclusive());
            case OPERATIONAL_REPORT -> operationalReportQueryRepository.hasCompletedVisits(
                    range.fromInclusive(), range.toExclusive())
                    || operationalReportQueryRepository.hasInvoices(range.fromInclusive(), range.toExclusive());
            case DISEASE_PATTERN_REPORT -> operationalReportQueryRepository.hasDiagnoses(
                    range.fromInclusive(), range.toExclusive(), doctorId);
        };
    }

    public TopMedicinesReportResult getTopMedicines(LocalDate from, LocalDate to) {
        ReportingTimeRange range = ReportingTimeRange.of(from, to);
        List<TopMedicineItemResult> items = new ArrayList<>();
        List<com.benhsoan.port.outbound.repository.reporting.TopMedicineSummary> summaries = operationalReportQueryRepository
                .findTopDispensedMedicines(range.fromInclusive(), range.toExclusive());

        for (int index = 0; index < summaries.size(); index++) {
            var item = summaries.get(index);
            items.add(new TopMedicineItemResult(
                    index + 1,
                    item.medicineId(),
                    item.medicineCode(),
                    item.medicineName(),
                    item.totalDispensedQuantity()));
        }

        return new TopMedicinesReportResult(
                from,
                to,
                null,
                items);
    }

    public DoctorVisitsReportResult getDoctorVisits(LocalDate from, LocalDate to) {
        ReportingTimeRange range = ReportingTimeRange.of(from, to);
        List<DoctorVisitSummaryResult> items = new ArrayList<>();
        List<DoctorVisitSummary> summaries = operationalReportQueryRepository
                .findDoctorVisitSummaries(range.fromInclusive(), range.toExclusive());

        for (int index = 0; index < summaries.size(); index++) {
            var item = summaries.get(index);
            items.add(new DoctorVisitSummaryResult(
                    index + 1,
                    item.doctorId(),
                    item.doctorCode(),
                    item.doctorName(),
                    item.totalVisits()));
        }

        return new DoctorVisitsReportResult(
                from,
                to,
                null,
                items);
    }

    public DiseasePatternReportResult getDiseasePatterns(
            LocalDate from,
            LocalDate to,
            UUID doctorId,
            String doctorName) {
        ReportingTimeRange range = ReportingTimeRange.of(from, to);
        List<DiseasePatternSummary> summaries = operationalReportQueryRepository.findDiseasePatternSummaries(
                range.fromInclusive(), range.toExclusive(), doctorId);

        long totalDiagnoses = 0L;
        for (DiseasePatternSummary summary : summaries) {
            totalDiagnoses += summary.diagnosisCount();
        }

        List<DiseasePatternItemResult> items = new ArrayList<>();
        for (int index = 0; index < summaries.size(); index++) {
            var item = summaries.get(index);
            double percentage = totalDiagnoses > 0
                    ? Math.round((double) item.diagnosisCount() * 10000.0 / totalDiagnoses) / 100.0
                    : 0.0;
            items.add(new DiseasePatternItemResult(
                    index + 1,
                    item.diagnosisCatalogId(),
                    item.diseaseCode(),
                    item.diseaseName(),
                    item.diseaseGroup(),
                    item.diagnosisCount(),
                    percentage));
        }

        return new DiseasePatternReportResult(
                from,
                to,
                doctorId,
                doctorName,
                totalDiagnoses,
                clockPort.now(),
                items);
    }

    private Map<LocalDate, Long> aggregateVisitsByDate(List<DailyVisitSummary> visits) {
        Map<LocalDate, Long> result = new HashMap<>();
        for (DailyVisitSummary visit : visits) {
            result.put(visit.date(), visit.visitCount());
        }
        return result;
    }

    private Map<LocalDate, BigDecimal> aggregateRevenueByDate(List<DailyRevenueSummary> revenues) {
        Map<LocalDate, BigDecimal> result = new HashMap<>();
        for (DailyRevenueSummary revenue : revenues) {
            result.put(revenue.date(), revenue.revenue());
        }
        return result;
    }

    private List<OperationalTimelineItemResult> buildItems(
            LocalDate from,
            LocalDate to,
            Map<LocalDate, Long> visitsByDate,
            Map<LocalDate, BigDecimal> revenueByDate) {
        java.util.ArrayList<OperationalTimelineItemResult> items = new java.util.ArrayList<>();
        LocalDate current = from;
        while (!current.isAfter(to)) {
            items.add(new OperationalTimelineItemResult(
                    current,
                    visitsByDate.getOrDefault(current, 0L),
                    revenueByDate.getOrDefault(current, BigDecimal.ZERO)));
            current = current.plusDays(1);
        }
        return items;
    }
}
