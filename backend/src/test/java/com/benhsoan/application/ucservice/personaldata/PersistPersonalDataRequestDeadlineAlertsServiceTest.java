package com.benhsoan.application.ucservice.personaldata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestDeadlineAlertType;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineReviewResult;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestDeadlineAlertRepository;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class PersistPersonalDataRequestDeadlineAlertsServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-26T08:00:00Z");

    @Mock private PersonalDataRequestDeadlineAlertRepository alertRepository;
    @Mock private ClockPort clockPort;

    private PersistPersonalDataRequestDeadlineAlertsService service;

    @Test
    @DisplayName("TC-02: tạo alert OVERDUE cho yêu cầu quá hạn")
    void persistsOverdueAlert() {
        UUID requestId = UUID.randomUUID();
        when(clockPort.now()).thenReturn(NOW);
        when(alertRepository.saveIfAbsent(requestId, PersonalDataRequestDeadlineAlertType.OVERDUE, NOW))
                .thenReturn(true);

        service = new PersistPersonalDataRequestDeadlineAlertsService(alertRepository, clockPort);

        int created = service.persist(new PersonalDataRequestDeadlineReviewResult(
                List.of(result(requestId)), List.of()));

        assertEquals(1, created);
        verify(alertRepository).saveIfAbsent(requestId, PersonalDataRequestDeadlineAlertType.OVERDUE, NOW);
    }

    @Test
    @DisplayName("TC-02: tạo alert UPCOMING cho yêu cầu sắp đến hạn")
    void persistsUpcomingAlert() {
        UUID requestId = UUID.randomUUID();
        when(clockPort.now()).thenReturn(NOW);
        when(alertRepository.saveIfAbsent(requestId, PersonalDataRequestDeadlineAlertType.UPCOMING, NOW))
                .thenReturn(true);

        service = new PersistPersonalDataRequestDeadlineAlertsService(alertRepository, clockPort);

        int created = service.persist(new PersonalDataRequestDeadlineReviewResult(
                List.of(), List.of(result(requestId))));

        assertEquals(1, created);
        verify(alertRepository).saveIfAbsent(requestId, PersonalDataRequestDeadlineAlertType.UPCOMING, NOW);
    }

    @Test
    @DisplayName("chạy lại không tạo alert trùng lặp (saveIfAbsent trả false)")
    void doesNotDuplicateExistingAlerts() {
        UUID requestId = UUID.randomUUID();
        when(clockPort.now()).thenReturn(NOW);
        when(alertRepository.saveIfAbsent(requestId, PersonalDataRequestDeadlineAlertType.OVERDUE, NOW))
                .thenReturn(false);

        service = new PersistPersonalDataRequestDeadlineAlertsService(alertRepository, clockPort);

        int created = service.persist(new PersonalDataRequestDeadlineReviewResult(
                List.of(result(requestId)), List.of()));

        assertEquals(0, created);
    }

    private PersonalDataRequestResult result(UUID id) {
        return new PersonalDataRequestResult(
                id, UUID.randomUUID(), "MEDICAL_RECORD_COPY", null, null,
                NOW, NOW, null, null, null, NOW, NOW, true);
    }
}