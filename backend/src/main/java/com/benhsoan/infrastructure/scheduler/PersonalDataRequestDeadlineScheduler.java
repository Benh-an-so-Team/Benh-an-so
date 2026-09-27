package com.benhsoan.infrastructure.scheduler;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineReviewResult;
import com.benhsoan.port.inbound.personaldata.PersistPersonalDataRequestDeadlineAlertsUseCase;
import com.benhsoan.port.inbound.personaldata.ReviewPersonalDataRequestDeadlinesUseCase;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * NCL-15-CN-006 TC-02: periodic review of personal-data-request deadlines. When
 * enabled ({@code personal-data-request.deadline-check.enabled=true}) it reviews
 * overdue and upcoming requests and persists deduplicated administrator alerts.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "personal-data-request.deadline-check.enabled", havingValue = "true")
public class PersonalDataRequestDeadlineScheduler {

    private final ReviewPersonalDataRequestDeadlinesUseCase reviewUseCase;
    private final PersistPersonalDataRequestDeadlineAlertsUseCase persistAlertsUseCase;

    @Scheduled(fixedDelayString = "${personal-data-request.deadline-check.scan-interval-ms}")
    public void reviewDeadlines() {
        PersonalDataRequestDeadlineReviewResult review = reviewUseCase.review();
        int created = persistAlertsUseCase.persist(review);
        if (created > 0) {
            log.info("Persisted {} new personal-data-request deadline alert(s) "
                    + "({} overdue, {} upcoming).",
                    created, review.overdueRequests().size(), review.upcomingRequests().size());
        }
    }
}
