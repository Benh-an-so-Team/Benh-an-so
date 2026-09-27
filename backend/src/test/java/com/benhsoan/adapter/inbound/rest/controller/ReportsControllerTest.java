package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.ReportingRestMapper;
import com.benhsoan.domain.reporting.enums.ReportType;
import com.benhsoan.domain.reporting.exception.OperationalReportDataEmptyException;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.port.dto.result.DoctorVisitsReportResult;
import com.benhsoan.port.dto.result.DoctorVisitSummaryResult;
import com.benhsoan.port.dto.result.DiseasePatternItemResult;
import com.benhsoan.port.dto.result.DiseasePatternReportResult;
import com.benhsoan.port.dto.result.OperationalReportExportResult;
import com.benhsoan.port.dto.result.OperationalSummaryResult;
import com.benhsoan.port.dto.result.OperationalTimelineItemResult;
import com.benhsoan.port.dto.result.OperationalTimelineResult;
import com.benhsoan.port.inbound.reporting.ExportOperationalReportUseCase;
import com.benhsoan.port.inbound.reporting.GetDiseasePatternReportUseCase;
import com.benhsoan.port.inbound.reporting.GetDoctorVisitsReportUseCase;
import com.benhsoan.port.inbound.reporting.GetOperationalSummaryUseCase;
import com.benhsoan.port.inbound.reporting.GetRevenueBreakdownReportUseCase;
import com.benhsoan.port.inbound.reporting.GetTopMedicinesReportUseCase;
import com.benhsoan.port.inbound.reporting.GetOperationalTimelineUseCase;
import com.benhsoan.port.inbound.reporting.GetAppointmentEffectivenessReportUseCase;
import com.benhsoan.port.inbound.survey.GetSatisfactionReportUseCase;
import com.benhsoan.port.dto.result.survey.SatisfactionReportResult;
import com.benhsoan.port.dto.result.survey.DoctorSatisfactionItemResult;
import java.util.Map;
import com.benhsoan.domain.appointment.enums.AppointmentStatus;
import com.benhsoan.port.dto.result.AppointmentEffectivenessReportResult;
import com.benhsoan.port.dto.result.AppointmentStatusCountResult;
import com.benhsoan.port.dto.result.DoctorRevenueResult;
import com.benhsoan.port.dto.result.RevenueBreakdownReportResult;
import com.benhsoan.port.dto.result.ServiceGroupRevenueResult;
import com.benhsoan.port.dto.result.TopMedicineItemResult;
import com.benhsoan.port.dto.result.TopMedicinesReportResult;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = ReportsController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ReportingRestMapper.class, GlobalExceptionHandler.class})
class ReportsControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private GetOperationalSummaryUseCase getOperationalSummaryUseCase;
    @MockitoBean private GetOperationalTimelineUseCase getOperationalTimelineUseCase;
    @MockitoBean private GetTopMedicinesReportUseCase getTopMedicinesReportUseCase;
    @MockitoBean private GetDoctorVisitsReportUseCase getDoctorVisitsReportUseCase;
    @MockitoBean private GetDiseasePatternReportUseCase getDiseasePatternReportUseCase;
    @MockitoBean private ExportOperationalReportUseCase exportOperationalReportUseCase;
    @MockitoBean private GetRevenueBreakdownReportUseCase getRevenueBreakdownReportUseCase;
    @MockitoBean private GetAppointmentEffectivenessReportUseCase getAppointmentEffectivenessReportUseCase;
    @MockitoBean private GetSatisfactionReportUseCase getSatisfactionReportUseCase;
    @MockitoBean private CurrentUserPort currentUserPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private ClockPort clockPort;

    @Test
    void returnsSummary() throws Exception {
        when(getOperationalSummaryUseCase.getSummary(any(), any())).thenReturn(new OperationalSummaryResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                12L,
                new BigDecimal("5400000"),
                "VND"
        ));

        mockMvc.perform(get("/reports/summary")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visitCount").value(12))
                .andExpect(jsonPath("$.revenue").value(5400000))
                .andExpect(jsonPath("$.currency").value("VND"));
    }

    @Test
    void returnsEmptySummaryWhenNoDataExists() throws Exception {
        when(getOperationalSummaryUseCase.getSummary(any(), any())).thenReturn(new OperationalSummaryResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                0L,
                BigDecimal.ZERO,
                "VND"
        ));

        mockMvc.perform(get("/reports/summary")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visitCount").value(0))
                .andExpect(jsonPath("$.revenue").value(0))
                .andExpect(jsonPath("$.currency").value("VND"));
    }

    @Test
    void rejectsMissingFromParameter() throws Exception {
        mockMvc.perform(get("/reports/summary")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from is required."));

        verifyNoInteractions(getOperationalSummaryUseCase);
    }

    @Test
    void rejectsBlankFromParameter() throws Exception {
        mockMvc.perform(get("/reports/summary")
                        .param("from", " ")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from is required."));

        verifyNoInteractions(getOperationalSummaryUseCase);
    }

    @Test
    void rejectsInvalidDateFormat() throws Exception {
        mockMvc.perform(get("/reports/summary")
                        .param("from", "01-08-2026")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be in yyyy-MM-dd format."));

        verifyNoInteractions(getOperationalSummaryUseCase);
    }

    @Test
    void rejectsWhenFromIsAfterTo() throws Exception {
        mockMvc.perform(get("/reports/summary")
                        .param("from", "2026-08-04")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before or equal to to."));

        verifyNoInteractions(getOperationalSummaryUseCase);
    }

    @Test
    void returnsTimeline() throws Exception {
        when(getOperationalTimelineUseCase.getTimeline(any(), any())).thenReturn(new OperationalTimelineResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                List.of(
                        new OperationalTimelineItemResult(LocalDate.of(2026, 8, 1), 2L, new BigDecimal("100000")),
                        new OperationalTimelineItemResult(LocalDate.of(2026, 8, 2), 0L, BigDecimal.ZERO),
                        new OperationalTimelineItemResult(LocalDate.of(2026, 8, 3), 1L, new BigDecimal("-20000"))
                )
        ));

        mockMvc.perform(get("/reports/visits-timeline")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[1].date").value("2026-08-02"))
                .andExpect(jsonPath("$.items[1].visitCount").value(0))
                .andExpect(jsonPath("$.items[2].revenue").value(-20000));
    }

    @Test
    void returnsTimelineWithZeroRowsWhenNoDataExists() throws Exception {
        when(getOperationalTimelineUseCase.getTimeline(any(), any())).thenReturn(new OperationalTimelineResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                List.of(
                        new OperationalTimelineItemResult(LocalDate.of(2026, 8, 1), 0L, BigDecimal.ZERO),
                        new OperationalTimelineItemResult(LocalDate.of(2026, 8, 2), 0L, BigDecimal.ZERO),
                        new OperationalTimelineItemResult(LocalDate.of(2026, 8, 3), 0L, BigDecimal.ZERO)
                )
        ));

        mockMvc.perform(get("/reports/visits-timeline")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].visitCount").value(0))
                .andExpect(jsonPath("$.items[1].revenue").value(0))
                .andExpect(jsonPath("$.items[2].visitCount").value(0));
    }

    @Test
    void returnsTopMedicines() throws Exception {
        when(getTopMedicinesReportUseCase.getTopMedicines(any(), any())).thenReturn(new TopMedicinesReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                Instant.parse("2026-08-03T08:00:00Z"),
                List.of(
                        new TopMedicineItemResult(
                                1,
                                java.util.UUID.fromString("16000000-0000-0000-0000-000000000001"),
                                "MED-PARA-500",
                                "Paracetamol 500 mg",
                                9L
                        )
                )
        ));

        mockMvc.perform(get("/reports/top-medicines")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generatedAt").value("2026-08-03T08:00:00Z"))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[0].medicineCode").value("MED-PARA-500"))
                .andExpect(jsonPath("$.items[0].medicineName").value("Paracetamol 500 mg"))
                .andExpect(jsonPath("$.items[0].totalDispensedQuantity").value(9));
    }

    @Test
    void returnsEmptyTopMedicinesWhenNoDataExists() throws Exception {
        when(getTopMedicinesReportUseCase.getTopMedicines(any(), any())).thenReturn(new TopMedicinesReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                Instant.parse("2026-08-03T08:00:00Z"),
                List.of()
        ));

        mockMvc.perform(get("/reports/top-medicines")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2026-08-01"))
                .andExpect(jsonPath("$.to").value("2026-08-03"))
                .andExpect(jsonPath("$.generatedAt").value("2026-08-03T08:00:00Z"))
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void rejectsInvalidDateFormatForTopMedicines() throws Exception {
        mockMvc.perform(get("/reports/top-medicines")
                        .param("from", "01-08-2026")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be in yyyy-MM-dd format."));

        verifyNoInteractions(getTopMedicinesReportUseCase);
    }

    @Test
    void rejectsWhenFromIsAfterToForTopMedicines() throws Exception {
        mockMvc.perform(get("/reports/top-medicines")
                        .param("from", "2026-08-04")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before or equal to to."));

        verifyNoInteractions(getTopMedicinesReportUseCase);
    }

    @Test
    void rejectsWhenTopMedicinesDateRangeExceeds366Days() throws Exception {
        mockMvc.perform(get("/reports/top-medicines")
                        .param("from", "2025-01-01")
                        .param("to", "2026-01-02"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Date range must not exceed 366 days."));

        verifyNoInteractions(getTopMedicinesReportUseCase);
    }

    @Test
    void returnsDoctorVisits() throws Exception {
        when(getDoctorVisitsReportUseCase.getDoctorVisits(any(), any())).thenReturn(new DoctorVisitsReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 14),
                Instant.parse("2026-08-14T08:00:00Z"),
                List.of(
                        new DoctorVisitSummaryResult(
                                1,
                                java.util.UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"),
                                "doctor1",
                                "Nguyễn Văn A",
                                25L
                        )
                )
        ));

        mockMvc.perform(get("/reports/doctor-visits")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2026-08-01"))
                .andExpect(jsonPath("$.to").value("2026-08-14"))
                .andExpect(jsonPath("$.generatedAt").value("2026-08-14T08:00:00Z"))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[0].doctorId").value("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"))
                .andExpect(jsonPath("$.items[0].doctorCode").value("doctor1"))
                .andExpect(jsonPath("$.items[0].doctorName").value("Nguyễn Văn A"))
                .andExpect(jsonPath("$.items[0].totalVisits").value(25));
    }

    @Test
    void returnsEmptyDoctorVisitsWhenNoDataExists() throws Exception {
        when(getDoctorVisitsReportUseCase.getDoctorVisits(any(), any())).thenReturn(new DoctorVisitsReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 14),
                Instant.parse("2026-08-14T08:00:00Z"),
                List.of()
        ));

        mockMvc.perform(get("/reports/doctor-visits")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void rejectsInvalidDateFormatForDoctorVisits() throws Exception {
        mockMvc.perform(get("/reports/doctor-visits")
                        .param("from", "01-08-2026")
                        .param("to", "2026-08-14"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be in yyyy-MM-dd format."));

        verifyNoInteractions(getDoctorVisitsReportUseCase);
    }

    @Test
    void rejectsWhenFromIsAfterToForDoctorVisits() throws Exception {
        mockMvc.perform(get("/reports/doctor-visits")
                        .param("from", "2026-08-15")
                        .param("to", "2026-08-14"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before or equal to to."));

        verifyNoInteractions(getDoctorVisitsReportUseCase);
    }

    @Test
    void returnsDiseasePatterns() throws Exception {
        java.util.UUID catalogId = java.util.UUID.fromString("11111111-2222-3333-4444-555555555555");
        when(getDiseasePatternReportUseCase.getDiseasePatternReport(any(), any(), any())).thenReturn(new DiseasePatternReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 31),
                null,
                null,
                50L,
                Instant.parse("2026-08-31T08:00:00Z"),
                List.of(
                        new DiseasePatternItemResult(
                                1,
                                catalogId,
                                "J00",
                                "Viêm mũi họng cấp",
                                "Bệnh hệ hô hấp",
                                50L,
                                100.0
                        )
                )
        ));

        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2026-08-01"))
                .andExpect(jsonPath("$.to").value("2026-08-31"))
                .andExpect(jsonPath("$.doctorId").doesNotExist())
                .andExpect(jsonPath("$.doctorName").doesNotExist())
                .andExpect(jsonPath("$.totalDiagnoses").value(50))
                .andExpect(jsonPath("$.generatedAt").value("2026-08-31T08:00:00Z"))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[0].catalogId").value("11111111-2222-3333-4444-555555555555"))
                .andExpect(jsonPath("$.items[0].diseaseCode").value("J00"))
                .andExpect(jsonPath("$.items[0].diseaseName").value("Viêm mũi họng cấp"))
                .andExpect(jsonPath("$.items[0].diseaseGroup").value("Bệnh hệ hô hấp"))
                .andExpect(jsonPath("$.items[0].diagnosisCount").value(50))
                .andExpect(jsonPath("$.items[0].percentage").value(100.0));
    }

    @Test
    void returnsDiseasePatternsFilteredByDoctor() throws Exception {
        java.util.UUID doctorId = java.util.UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
        java.util.UUID catalogId = java.util.UUID.fromString("11111111-2222-3333-4444-555555555555");
        when(getDiseasePatternReportUseCase.getDiseasePatternReport(
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), doctorId)).thenReturn(new DiseasePatternReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 31),
                doctorId,
                "Dr. Nguyen Minh Anh",
                20L,
                Instant.parse("2026-08-31T08:00:00Z"),
                List.of(
                        new DiseasePatternItemResult(
                                1,
                                catalogId,
                                "I10",
                                "Tăng huyết áp",
                                "Bệnh hệ tuần hoàn",
                                20L,
                                100.0
                        )
                )
        ));

        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .param("doctorId", doctorId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2026-08-01"))
                .andExpect(jsonPath("$.to").value("2026-08-31"))
                .andExpect(jsonPath("$.doctorId").value("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"))
                .andExpect(jsonPath("$.doctorName").value("Dr. Nguyen Minh Anh"))
                .andExpect(jsonPath("$.totalDiagnoses").value(20))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[0].diseaseCode").value("I10"));
    }

    @Test
    void returnsEmptyDiseasePatternsWhenNoDataExists() throws Exception {
        when(getDiseasePatternReportUseCase.getDiseasePatternReport(any(), any(), any())).thenReturn(new DiseasePatternReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 31),
                null,
                null,
                0L,
                Instant.parse("2026-08-31T08:00:00Z"),
                List.of()
        ));

        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalDiagnoses").value(0));
    }

    @Test
    void rejectsInvalidDateFormatForDiseasePatterns() throws Exception {
        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "01-08-2026")
                        .param("to", "2026-08-31"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be in yyyy-MM-dd format."));

        verifyNoInteractions(getDiseasePatternReportUseCase);
    }

    @Test
    void rejectsWhenFromIsAfterToForDiseasePatterns() throws Exception {
        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-09-01")
                        .param("to", "2026-08-31"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before or equal to to."));

        verifyNoInteractions(getDiseasePatternReportUseCase);
    }

    @Test
    void rejectsWhenDiseasePatternsDateRangeExceeds366Days() throws Exception {
        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2025-01-01")
                        .param("to", "2026-01-02"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Date range must not exceed 366 days."));

        verifyNoInteractions(getDiseasePatternReportUseCase);
    }

    @Test
    void allowsDiseasePatternsDateRangeOf366DaysInLeapYear() throws Exception {
        when(getDiseasePatternReportUseCase.getDiseasePatternReport(
                LocalDate.of(2024, 1, 1), LocalDate.of(2024, 12, 31), null)).thenReturn(new DiseasePatternReportResult(
                LocalDate.of(2024, 1, 1),
                LocalDate.of(2024, 12, 31),
                null,
                null,
                0L,
                Instant.parse("2024-12-31T23:59:59Z"),
                List.of()
        ));

        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2024-01-01")
                        .param("to", "2024-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2024-01-01"))
                .andExpect(jsonPath("$.to").value("2024-12-31"));
    }

    @Test
    void exportsCsv() throws Exception {
        when(exportOperationalReportUseCase.export(any(), any(), any())).thenReturn(new OperationalReportExportResult(
                ReportType.OPERATIONAL_REPORT,
                "operational-report-2026-08-01-to-2026-08-03.csv",
                "text/csv; charset=UTF-8",
                "\uFEFFOPERATIONAL REPORT\nFrom,2026-08-01\nTo,2026-08-03\nVisit Count,2\nRevenue (VND),100000\n\nDate,Visit Count,Revenue (VND)\n2026-08-01,2,100000\n"
                        .getBytes(StandardCharsets.UTF_8)
        ));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/csv;charset=UTF-8"))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"operational-report-2026-08-01-to-2026-08-03.csv\""))
                .andExpect(content().bytes(
                        "\uFEFFOPERATIONAL REPORT\nFrom,2026-08-01\nTo,2026-08-03\nVisit Count,2\n"
                                .concat("Revenue (VND),100000\n\nDate,Visit Count,Revenue (VND)\n2026-08-01,2,100000\n")
                                .getBytes(StandardCharsets.UTF_8)
                ));
        verify(exportOperationalReportUseCase).export(
                ReportType.OPERATIONAL_REPORT, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 3));
    }

    @Test
    void exportsCsvWithUnmaskAndReason() throws Exception {
        when(exportOperationalReportUseCase.export(any(), any(), any(), any(), eq(true), any())).thenReturn(new OperationalReportExportResult(
                ReportType.VISIT_REPORT,
                "visit-report-2026-08-01-to-2026-08-03.csv",
                "text/csv; charset=UTF-8",
                "\uFEFFVISIT REPORT\nFrom,2026-08-01\nTo,2026-08-03\n".getBytes(StandardCharsets.UTF_8)
        ));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "VISIT_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .param("unmask", "true")
                        .param("reason", "Nghien cuu lam sang"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"visit-report-2026-08-01-to-2026-08-03.csv\""));

        verify(exportOperationalReportUseCase).export(
                ReportType.VISIT_REPORT,
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                null,
                true,
                "Nghien cuu lam sang"
        );
    }

    @Test
    void exportsCsvReturnsForbiddenWhenUnmaskedExportLacksPermission() throws Exception {
        when(exportOperationalReportUseCase.export(any(), any(), any(), any(), eq(true), any()))
                .thenThrow(new org.springframework.security.access.AccessDeniedException("User lacks permission to export unmasked patient data."));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "VISIT_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .param("unmask", "true")
                        .param("reason", "Nghien cuu lam sang"))
                .andExpect(status().isForbidden());
    }

    @Test
    void exportsCsvReturnsBadRequestWhenReasonValidationFails() throws Exception {
        when(exportOperationalReportUseCase.export(any(), any(), any(), any(), eq(true), any()))
                .thenThrow(new com.benhsoan.domain.shared.exception.ValidationException("Reason is required and must be at least 5 characters for unmasked export."));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "VISIT_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .param("unmask", "true")
                        .param("reason", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Reason is required and must be at least 5 characters for unmasked export."));
    }

    @Test
    void exportsCsvReturnsBadRequestWhenReasonExceeds500Characters() throws Exception {
        when(exportOperationalReportUseCase.export(any(), any(), any(), any(), eq(true), any()))
                .thenThrow(new com.benhsoan.domain.shared.exception.ValidationException("Reason must not exceed 500 characters."));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "VISIT_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .param("unmask", "true")
                        .param("reason", "A".repeat(501)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Reason must not exceed 500 characters."));
    }

    @Test
    void returnsStructuredErrorWhenNoDataCanBeExported() throws Exception {
        when(exportOperationalReportUseCase.export(any(), any(), any()))
                .thenThrow(new OperationalReportDataEmptyException());

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("REPORT_DATA_EMPTY"))
                .andExpect(jsonPath("$.message").value("No report data available for the selected period."))
                .andExpect(header().doesNotExist("Content-Disposition"));
    }

    @Test
    void rejectsInvalidExportDateInputsBeforeCallingUseCase() throws Exception {
        mockMvc.perform(get("/reports/export")
                        .param("reportType", "OPERATIONAL_REPORT")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from is required."));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "01-08-2026")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be in yyyy-MM-dd format."));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2026-08-04")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before or equal to to."));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2025-01-01")
                        .param("to", "2026-01-02"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Date range must not exceed 366 days."));

        verifyNoInteractions(exportOperationalReportUseCase);
    }

    @Test
    void rejectsMissingOrUnsupportedReportTypeBeforeCallingUseCase() throws Exception {
        mockMvc.perform(get("/reports/export")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("reportType is required."));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "TOP_MEDICINES_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("reportType must be one of: VISIT_REPORT, REVENUE_REPORT, OPERATIONAL_REPORT, DISEASE_PATTERN_REPORT."));

        verifyNoInteractions(exportOperationalReportUseCase);
    }

    @Test
    void returnsRevenueBreakdown() throws Exception {
        when(getRevenueBreakdownReportUseCase.getRevenueBreakdown(any(), any()))
                .thenReturn(new RevenueBreakdownReportResult(
                        LocalDate.of(2026, 8, 1),
                        LocalDate.of(2026, 8, 31),
                        new BigDecimal("700000"),
                        new BigDecimal("100000"),
                        new BigDecimal("400000"),
                        new BigDecimal("200000"),
                        BigDecimal.ZERO,
                        "VND",
                        List.of(
                                new ServiceGroupRevenueResult("EXAMINATION", "Khám bệnh", new BigDecimal("100000"), new BigDecimal("14.29")),
                                new ServiceGroupRevenueResult("LAB_TEST", "Xét nghiệm", new BigDecimal("150000"), new BigDecimal("21.43")),
                                new ServiceGroupRevenueResult("MEDICATION", "Thuốc / Dược phẩm", new BigDecimal("200000"), new BigDecimal("28.57"))
                        ),
                        List.of(
                                new DoctorRevenueResult(
                                        java.util.UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"),
                                        "doctor1",
                                        "Dr. Nguyen Minh Anh",
                                        new BigDecimal("100000"),
                                        new BigDecimal("250000"),
                                        new BigDecimal("200000"),
                                        BigDecimal.ZERO,
                                        new BigDecimal("550000"),
                                        new BigDecimal("78.57")
                                )
                        )
                ));

        mockMvc.perform(get("/reports/revenue-breakdown")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalNetRevenue").value(700000))
                .andExpect(jsonPath("$.totalExamRevenue").value(100000))
                .andExpect(jsonPath("$.totalClinicalServiceRevenue").value(400000))
                .andExpect(jsonPath("$.totalMedicationRevenue").value(200000))
                .andExpect(jsonPath("$.currency").value("VND"))
                .andExpect(jsonPath("$.serviceGroups[0].groupCode").value("EXAMINATION"))
                .andExpect(jsonPath("$.serviceGroups[0].revenue").value(100000))
                .andExpect(jsonPath("$.serviceGroups[2].groupCode").value("MEDICATION"))
                .andExpect(jsonPath("$.serviceGroups[2].revenue").value(200000))
                .andExpect(jsonPath("$.doctors[0].doctorCode").value("doctor1"))
                .andExpect(jsonPath("$.doctors[0].totalRevenue").value(550000));
    }

    @Test
    void rejectsInvalidRangeForRevenueBreakdown() throws Exception {
        mockMvc.perform(get("/reports/revenue-breakdown")
                        .param("from", "2026-08-31")
                        .param("to", "2026-08-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before or equal to to."));
    }

    @Test
    void rejectsRangeExceedingMaxDaysForRevenueBreakdown() throws Exception {
        mockMvc.perform(get("/reports/revenue-breakdown")
                        .param("from", "2025-01-01")
                        .param("to", "2026-02-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Date range must not exceed 366 days."));
    }

    @Test
    void returnsAppointmentEffectivenessReport() throws Exception {
        when(getAppointmentEffectivenessReportUseCase.getReport(any(), any(), any(), any()))
                .thenReturn(new AppointmentEffectivenessReportResult(
                        LocalDate.of(2026, 8, 1),
                        LocalDate.of(2026, 8, 31),
                        Instant.parse("2026-08-31T08:00:00Z"),
                        100,
                        List.of(
                                new AppointmentStatusCountResult("RECEPTION_COUNTER", AppointmentStatus.COMPLETED, 40, new BigDecimal("40.00")),
                                new AppointmentStatusCountResult("ONLINE_PORTAL", AppointmentStatus.COMPLETED, 10, new BigDecimal("10.00")),
                                new AppointmentStatusCountResult("RECEPTION_COUNTER", AppointmentStatus.CANCELLED, 30, new BigDecimal("30.00")),
                                new AppointmentStatusCountResult("ONLINE_PORTAL", AppointmentStatus.NO_SHOW, 20, new BigDecimal("20.00"))
                        )
                ));

        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(100))
                .andExpect(jsonPath("$.items[0].bookingChannel").value("RECEPTION_COUNTER"))
                .andExpect(jsonPath("$.items[0].status").value("COMPLETED"))
                .andExpect(jsonPath("$.items[0].count").value(40))
                .andExpect(jsonPath("$.items[0].percentage").value(40.00))
                .andExpect(jsonPath("$.items[1].bookingChannel").value("ONLINE_PORTAL"))
                .andExpect(jsonPath("$.items[1].status").value("COMPLETED"))
                .andExpect(jsonPath("$.items[1].count").value(10))
                .andExpect(jsonPath("$.items[1].percentage").value(10.00));
    }

    @Test
    void passesDoctorAndChannelFiltersToAppointmentEffectivenessReport() throws Exception {
        UUID doctorId = UUID.randomUUID();
        when(getAppointmentEffectivenessReportUseCase.getReport(any(), any(), any(), any()))
                .thenReturn(new AppointmentEffectivenessReportResult(
                        LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31),
                        Instant.parse("2026-08-31T08:00:00Z"), 0, List.of()));

        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .param("doctorId", doctorId.toString())
                        .param("bookingChannel", "ONLINE_PORTAL"))
                .andExpect(status().isOk());

        verify(getAppointmentEffectivenessReportUseCase)
                .getReport(eq(LocalDate.of(2026, 8, 1)), eq(LocalDate.of(2026, 8, 31)),
                        eq(doctorId), eq("ONLINE_PORTAL"));
    }

    @Test
    void rejectsInvalidBookingChannelForAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .param("bookingChannel", "SMS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("bookingChannel must be one of: ONLINE_PORTAL, RECEPTION_COUNTER."));
    }

    @Test
    void rejectsMissingFromForAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("to", "2026-08-31"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from is required."));
    }

    @Test
    void rejectsMissingToForAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("to is required."));
    }

    @Test
    void rejectsInvalidDateFormatForAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026/08/01")
                        .param("to", "2026-08-31"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be in yyyy-MM-dd format."));
    }

    @Test
    void rejectsInvertedRangeForAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-31")
                        .param("to", "2026-08-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("from must be before or equal to to."));
    }

    @Test
    void rejectsRangeExceedingMaxDaysForAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2025-01-01")
                        .param("to", "2026-02-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Date range must not exceed 366 days."));
    }

    @Test
    void returnsSatisfactionReport() throws Exception {
        UUID docId = UUID.randomUUID();
        SatisfactionReportResult reportResult = new SatisfactionReportResult(
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 25),
                Instant.parse("2026-09-25T14:00:00Z"),
                50L,
                4.7,
                Map.of(1, 0L, 2, 1L, 3, 2L, 4, 15L, 5, 32L),
                List.of(new DoctorSatisfactionItemResult(docId, "dr.anh", "Dr. Nguyen Minh Anh", 50L, 4.7))
        );

        when(getSatisfactionReportUseCase.getReport(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 25), null))
                .thenReturn(reportResult);

        mockMvc.perform(get("/reports/satisfaction")
                        .param("from", "2026-09-01")
                        .param("to", "2026-09-25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSurveys").value(50))
                .andExpect(jsonPath("$.averageScore").value(4.7))
                .andExpect(jsonPath("$.scoreDistribution['5']").value(32))
                .andExpect(jsonPath("$.doctors[0].doctorName").value("Dr. Nguyen Minh Anh"));
    }
}
