package com.benhsoan.application.ucservice.personaldata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.config.PersonalDataRequestDeadlineCheckProperties;
import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineReviewResult;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestRepository;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class ReviewPersonalDataRequestDeadlinesServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-26T08:00:00Z");
    private static final PersonalDataRequestDeadlineCheckProperties PROPS =
            new PersonalDataRequestDeadlineCheckProperties(true, 60000, 24);

    @Mock private PersonalDataRequestRepository requestRepository;
    @Mock private PersonalDataRequestResultMapper resultMapper;
    @Mock private ClockPort clockPort;

    private ReviewPersonalDataRequestDeadlinesService service;

    @Test
    @DisplayName("TC-02: phát hiện yêu cầu đã quá hạn (dueAt < now)")
    void reviewDetectsOverdueRequests() {
        PersonalDataRequest overdue = PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null,
                NOW.minusSeconds(7200), NOW.minusSeconds(1));
        when(clockPort.now()).thenReturn(NOW);
        when(requestRepository.findOpenWithDueBefore(NOW)).thenReturn(List.of(overdue));
        when(requestRepository.findOpenWithDueBetween(NOW, NOW.plus(24, ChronoUnit.HOURS)))
                .thenReturn(List.of());
        when(resultMapper.toResult(overdue)).thenReturn(resultFor(overdue));

        service = new ReviewPersonalDataRequestDeadlinesService(requestRepository, resultMapper, PROPS, clockPort);

        PersonalDataRequestDeadlineReviewResult review = service.review();

        assertEquals(1, review.overdueRequests().size());
        assertTrue(review.overdueRequests().get(0).overdue());
        assertTrue(review.upcomingRequests().isEmpty());
    }

    @Test
    @DisplayName("TC-02: phát hiện yêu cầu sắp đến hạn trong cửa sổ cấu hình")
    void reviewDetectsUpcomingRequestsInsideWindow() {
        PersonalDataRequest upcoming = PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW, NOW.plusSeconds(3600));
        Instant windowEnd = NOW.plus(24, ChronoUnit.HOURS);
        when(clockPort.now()).thenReturn(NOW);
        when(requestRepository.findOpenWithDueBefore(NOW)).thenReturn(List.of());
        when(requestRepository.findOpenWithDueBetween(NOW, windowEnd)).thenReturn(List.of(upcoming));
        when(resultMapper.toResult(upcoming)).thenReturn(resultFor(upcoming));

        service = new ReviewPersonalDataRequestDeadlinesService(requestRepository, resultMapper, PROPS, clockPort);

        PersonalDataRequestDeadlineReviewResult review = service.review();

        assertEquals(1, review.upcomingRequests().size());
        assertTrue(review.overdueRequests().isEmpty());
        verify(requestRepository).findOpenWithDueBetween(NOW, windowEnd);
    }

    @Test
    @DisplayName("cửa sổ sắp đến hạn là configurable và được truyền đúng biên trên")
    void reviewUsesConfiguredUpcomingWindow() {
        PersonalDataRequestDeadlineCheckProperties customProps =
                new PersonalDataRequestDeadlineCheckProperties(true, 60000, 48);
        when(clockPort.now()).thenReturn(NOW);
        when(requestRepository.findOpenWithDueBefore(NOW)).thenReturn(List.of());
        when(requestRepository.findOpenWithDueBetween(NOW, NOW.plus(48, ChronoUnit.HOURS)))
                .thenReturn(List.of());

        service = new ReviewPersonalDataRequestDeadlinesService(requestRepository, resultMapper, customProps, clockPort);

        PersonalDataRequestDeadlineReviewResult review = service.review();

        assertTrue(review.upcomingRequests().isEmpty());
        verify(requestRepository).findOpenWithDueBetween(NOW, NOW.plus(48, ChronoUnit.HOURS));
    }

    private PersonalDataRequestResult resultFor(PersonalDataRequest r) {
        return new PersonalDataRequestResult(
                r.getId(), r.getPatientId(), r.getRequestType(), r.getStatus(), r.getReason(),
                r.getReceivedAt(), r.getDueAt(), r.getResult(), r.getCompletedAt(), r.getProcessedBy(),
                r.getCreatedAt(), r.getUpdatedAt(), r.isOverdue(NOW));
    }
}
