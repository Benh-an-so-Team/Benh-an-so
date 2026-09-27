package com.benhsoan.application.ucservice.reporting;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.port.dto.result.survey.SatisfactionReportResult;
import com.benhsoan.port.outbound.repository.survey.DoctorSatisfactionSummary;
import com.benhsoan.port.outbound.repository.survey.SatisfactionOverallSummary;
import com.benhsoan.port.outbound.repository.survey.SatisfactionReportQueryRepository;
import com.benhsoan.port.outbound.repository.survey.SatisfactionScoreCount;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class GetSatisfactionReportServiceTest {

    @Mock
    private SatisfactionReportQueryRepository reportQueryRepository;
    @Mock
    private ClockPort clockPort;

    private GetSatisfactionReportService service;

    private final LocalDate from = LocalDate.of(2026, 9, 1);
    private final LocalDate to = LocalDate.of(2026, 9, 25);
    private final Instant generatedAt = Instant.parse("2026-09-25T14:30:00Z");

    @BeforeEach
    void setUp() {
        service = new GetSatisfactionReportService(reportQueryRepository, clockPort);
    }

    @Test
    @DisplayName("TC-03: Quản lý phòng khám xem báo cáo tổng hợp theo kỳ và theo bác sĩ")
    void testGetReport_Success_TC03() {
        when(clockPort.now()).thenReturn(generatedAt);

        SatisfactionOverallSummary overall = new SatisfactionOverallSummary(100L, 4.65);
        when(reportQueryRepository.getOverallSummary(any(Instant.class), any(Instant.class), eq(null)))
                .thenReturn(overall);

        List<SatisfactionScoreCount> distribution = List.of(
                new SatisfactionScoreCount(1, 2L),
                new SatisfactionScoreCount(2, 3L),
                new SatisfactionScoreCount(3, 5L),
                new SatisfactionScoreCount(4, 30L),
                new SatisfactionScoreCount(5, 60L)
        );
        when(reportQueryRepository.getScoreDistribution(any(Instant.class), any(Instant.class), eq(null)))
                .thenReturn(distribution);

        UUID doc1Id = UUID.randomUUID();
        UUID doc2Id = UUID.randomUUID();
        List<DoctorSatisfactionSummary> doctors = List.of(
                new DoctorSatisfactionSummary(doc1Id, "dr.anh", "Dr. Nguyen Minh Anh", 60L, 4.8),
                new DoctorSatisfactionSummary(doc2Id, "dr.huy", "Dr. Tran Quang Huy", 40L, 4.4)
        );
        when(reportQueryRepository.getDoctorSummaries(any(Instant.class), any(Instant.class), eq(null)))
                .thenReturn(doctors);

        SatisfactionReportResult result = service.getReport(from, to, null);

        assertNotNull(result);
        assertEquals(from, result.from());
        assertEquals(to, result.to());
        assertEquals(generatedAt, result.generatedAt());
        assertEquals(100L, result.totalSurveys());
        assertEquals(4.7, result.averageScore()); // 4.65 rounded to 1 decimal is 4.7
        assertEquals(5, result.scoreDistribution().size());
        assertEquals(2L, result.scoreDistribution().get(1));
        assertEquals(60L, result.scoreDistribution().get(5));

        assertEquals(2, result.doctors().size());
        assertEquals("Dr. Nguyen Minh Anh", result.doctors().get(0).doctorName());
        assertEquals(60L, result.doctors().get(0).totalSurveys());
        assertEquals(4.8, result.doctors().get(0).averageScore());

        verify(reportQueryRepository).getOverallSummary(any(Instant.class), any(Instant.class), eq(null));
        verify(reportQueryRepository).getScoreDistribution(any(Instant.class), any(Instant.class), eq(null));
        verify(reportQueryRepository).getDoctorSummaries(any(Instant.class), any(Instant.class), eq(null));
    }

    @Test
    @DisplayName("Lọc báo cáo theo bác sĩ cụ thể")
    void testGetReport_WithDoctorIdFilter() {
        when(clockPort.now()).thenReturn(generatedAt);
        UUID targetDoctorId = UUID.randomUUID();

        SatisfactionOverallSummary overall = new SatisfactionOverallSummary(40L, 4.4);
        when(reportQueryRepository.getOverallSummary(any(Instant.class), any(Instant.class), eq(targetDoctorId)))
                .thenReturn(overall);

        when(reportQueryRepository.getScoreDistribution(any(Instant.class), any(Instant.class), eq(targetDoctorId)))
                .thenReturn(List.of(new SatisfactionScoreCount(5, 40L)));

        List<DoctorSatisfactionSummary> doctors = List.of(
                new DoctorSatisfactionSummary(targetDoctorId, "dr.huy", "Dr. Tran Quang Huy", 40L, 4.4)
        );
        when(reportQueryRepository.getDoctorSummaries(any(Instant.class), any(Instant.class), eq(targetDoctorId)))
                .thenReturn(doctors);

        SatisfactionReportResult result = service.getReport(from, to, targetDoctorId);

        assertNotNull(result);
        assertEquals(40L, result.totalSurveys());
        assertEquals(1, result.doctors().size());
        assertEquals(targetDoctorId, result.doctors().get(0).doctorId());
        verify(reportQueryRepository).getDoctorSummaries(any(Instant.class), any(Instant.class), eq(targetDoctorId));
    }
}
