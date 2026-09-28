package com.benhsoan.infrastructure.scheduler;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineReviewResult;
import com.benhsoan.port.inbound.personaldata.PersistPersonalDataRequestDeadlineAlertsUseCase;
import com.benhsoan.port.inbound.personaldata.ReviewPersonalDataRequestDeadlinesUseCase;

@ExtendWith(MockitoExtension.class)
class PersonalDataRequestDeadlineSchedulerTest {

    @Mock private ReviewPersonalDataRequestDeadlinesUseCase reviewUseCase;
    @Mock private PersistPersonalDataRequestDeadlineAlertsUseCase persistAlertsUseCase;

    @Test
    @DisplayName("scheduler phối hợp review rồi persist alert")
    void reviewThenPersistsAlerts() {
        PersonalDataRequestDeadlineReviewResult review =
                new PersonalDataRequestDeadlineReviewResult(List.of(), List.of());
        when(reviewUseCase.review()).thenReturn(review);

        PersonalDataRequestDeadlineScheduler scheduler =
                new PersonalDataRequestDeadlineScheduler(reviewUseCase, persistAlertsUseCase);

        scheduler.reviewDeadlines();

        verify(reviewUseCase).review();
        verify(persistAlertsUseCase).persist(review);
    }
}