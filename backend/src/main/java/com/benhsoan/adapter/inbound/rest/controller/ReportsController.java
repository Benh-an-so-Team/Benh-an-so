package com.benhsoan.adapter.inbound.rest.controller;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

import com.benhsoan.adapter.inbound.rest.mapper.ReportingRestMapper;
import com.benhsoan.adapter.inbound.rest.response.reporting.AppointmentEffectivenessReportResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.DiseasePatternReportResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.DoctorVisitsReportResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.OperationalSummaryResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.OperationalTimelineResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.RevenueBreakdownReportResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.TopMedicinesReportResponse;
import com.benhsoan.domain.reporting.enums.ReportType;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.infrastructure.security.annotation.RequirePermission;
import com.benhsoan.port.dto.result.OperationalReportExportResult;
import com.benhsoan.port.inbound.reporting.ExportOperationalReportUseCase;
import com.benhsoan.port.inbound.reporting.GetAppointmentEffectivenessReportUseCase;
import com.benhsoan.port.inbound.reporting.GetDiseasePatternReportUseCase;
import com.benhsoan.port.inbound.reporting.GetDoctorVisitsReportUseCase;
import com.benhsoan.port.inbound.reporting.GetOperationalSummaryUseCase;
import com.benhsoan.port.inbound.reporting.GetRevenueBreakdownReportUseCase;
import com.benhsoan.port.inbound.reporting.GetTopMedicinesReportUseCase;
import com.benhsoan.adapter.inbound.rest.response.reporting.SatisfactionReportResponse;
import com.benhsoan.port.inbound.reporting.GetOperationalTimelineUseCase;
import com.benhsoan.port.inbound.survey.GetSatisfactionReportUseCase;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@Validated
public class ReportsController {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final long MAX_REPORT_RANGE_DAYS = 366;

    private final GetOperationalSummaryUseCase getOperationalSummaryUseCase;
    private final GetOperationalTimelineUseCase getOperationalTimelineUseCase;
    private final GetTopMedicinesReportUseCase getTopMedicinesReportUseCase;
    private final GetDoctorVisitsReportUseCase getDoctorVisitsReportUseCase;
    private final GetDiseasePatternReportUseCase getDiseasePatternReportUseCase;
    private final ExportOperationalReportUseCase exportOperationalReportUseCase;
    private final GetRevenueBreakdownReportUseCase getRevenueBreakdownReportUseCase;
    private final GetAppointmentEffectivenessReportUseCase getAppointmentEffectivenessReportUseCase;
    private final GetSatisfactionReportUseCase getSatisfactionReportUseCase;
    private final ReportingRestMapper mapper;

    @GetMapping("/summary")
    @RequirePermission("REPORT_VIEW")
    public OperationalSummaryResponse getSummary(
            @RequestParam String from,
            @RequestParam String to
    ) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);

        return mapper.toResponse(getOperationalSummaryUseCase.getSummary(fromDate, toDate));
    }

    @GetMapping("/revenue-breakdown")
    @RequirePermission("REPORT_VIEW")
    public RevenueBreakdownReportResponse getRevenueBreakdown(
            @RequestParam String from,
            @RequestParam String to
    ) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);

        return mapper.toResponse(getRevenueBreakdownReportUseCase.getRevenueBreakdown(fromDate, toDate));
    }

    @GetMapping("/visits-timeline")
    @RequirePermission("REPORT_VIEW")
    public OperationalTimelineResponse getVisitsTimeline(
            @RequestParam String from,
            @RequestParam String to
    ) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);

        return mapper.toResponse(getOperationalTimelineUseCase.getTimeline(fromDate, toDate));
    }

    @GetMapping("/top-medicines")
    @RequirePermission("REPORT_VIEW")
    public TopMedicinesReportResponse getTopMedicines(
            @RequestParam String from,
            @RequestParam String to
    ) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);

        return mapper.toResponse(getTopMedicinesReportUseCase.getTopMedicines(fromDate, toDate));
    }

    @GetMapping("/doctor-visits")
    @RequirePermission("REPORT_VIEW")
    public DoctorVisitsReportResponse getDoctorVisits(
            @RequestParam String from,
            @RequestParam String to
    ) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);

        return mapper.toResponse(getDoctorVisitsReportUseCase.getDoctorVisits(fromDate, toDate));
    }

    @GetMapping("/appointment-effectiveness")
    @RequirePermission("REPORT_VIEW")
    public AppointmentEffectivenessReportResponse getAppointmentEffectiveness(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(required = false) UUID doctorId,
            @RequestParam(required = false) String bookingChannel
    ) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);
        String channel = parseBookingChannel(bookingChannel);

        return mapper.toResponse(
                getAppointmentEffectivenessReportUseCase.getReport(fromDate, toDate, doctorId, channel)
        );
    }

    @GetMapping("/disease-patterns")
    @RequirePermission("REPORT_VIEW")
    public DiseasePatternReportResponse getDiseasePatterns(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(required = false) UUID doctorId
    ) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);

        return mapper.toResponse(getDiseasePatternReportUseCase.getDiseasePatternReport(fromDate, toDate, doctorId));
    }

    @GetMapping("/satisfaction")
    @RequirePermission("REPORT_VIEW")
    public SatisfactionReportResponse getSatisfaction(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(required = false) UUID doctorId
    ) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);

        return mapper.toResponse(getSatisfactionReportUseCase.getReport(fromDate, toDate, doctorId));
    }

    @GetMapping("/export")
    @RequirePermission("REPORT_EXPORT")
    public ResponseEntity<ByteArrayResource> export(
            @RequestParam String reportType,
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(required = false) UUID doctorId,
            @RequestParam(required = false, defaultValue = "false") boolean unmask,
            @RequestParam(required = false) String reason
    ) {
        ReportType selectedReportType = parseReportType(reportType);
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);

        OperationalReportExportResult exportResult;
        if (!unmask && reason == null) {
            exportResult = doctorId == null
                    ? exportOperationalReportUseCase.export(selectedReportType, fromDate, toDate)
                    : exportOperationalReportUseCase.export(selectedReportType, fromDate, toDate, doctorId);
        } else {
            exportResult = exportOperationalReportUseCase.export(
                    selectedReportType,
                    fromDate,
                    toDate,
                    doctorId,
                    unmask,
                    reason
            );
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + exportResult.fileName() + "\"")
                .contentType(MediaType.parseMediaType(exportResult.contentType()))
                .contentLength(exportResult.content().length)
                .body(new ByteArrayResource(exportResult.content()));
    }

    private LocalDate parseDate(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new ValidationException(fieldName + " is required.");
        }
        try {
            return LocalDate.parse(value, DATE_FORMATTER);
        } catch (RuntimeException ex) {
            throw new ValidationException(fieldName + " must be in yyyy-MM-dd format.");
        }
    }

    private ReportType parseReportType(String value) {
        if (value == null || value.isBlank()) {
            throw new ValidationException("reportType is required.");
        }
        try {
            return ReportType.valueOf(value);
        } catch (IllegalArgumentException ex) {
            throw new ValidationException("reportType must be one of: VISIT_REPORT, REVENUE_REPORT, OPERATIONAL_REPORT, DISEASE_PATTERN_REPORT.");
        }
    }

    private String parseBookingChannel(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if ("ONLINE_PORTAL".equals(value) || "RECEPTION_COUNTER".equals(value)) {
            return value;
        }
        throw new ValidationException("bookingChannel must be one of: ONLINE_PORTAL, RECEPTION_COUNTER.");
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new ValidationException("from must be before or equal to to.");
        }
        long inclusiveDays = ChronoUnit.DAYS.between(from, to) + 1;
        if (inclusiveDays > MAX_REPORT_RANGE_DAYS) {
            throw new ValidationException("Date range must not exceed 366 days.");
        }
    }
}
