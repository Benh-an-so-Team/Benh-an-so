package com.benhsoan.application.ucservice.personaldata;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.config.PersonalDataRequestDeadlineCheckProperties;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineReviewResult;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.inbound.personaldata.ReviewPersonalDataRequestDeadlinesUseCase;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestRepository;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

/**
 * NCL-15-CN-006 TC-02: periodic review of processing deadlines. Reports both
 * requests that are already overdue (dueAt &lt; now) and requests whose deadline
 * falls inside the configured upcoming window (now &le; dueAt &le; now + window).
 * A completed request is never reported. Alert persistence is delegated to the
 * caller through the alert persistence use case.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewPersonalDataRequestDeadlinesService implements ReviewPersonalDataRequestDeadlinesUseCase {

    private final PersonalDataRequestRepository requestRepository;
    private final PersonalDataRequestResultMapper resultMapper;
    private final PersonalDataRequestDeadlineCheckProperties properties;
    private final ClockPort clockPort;

    @Override
    public PersonalDataRequestDeadlineReviewResult review() {
        Instant now = clockPort.now();
        Instant upcomingEnd = now.plus(properties.upcomingWindowHours(), ChronoUnit.HOURS);

        List<PersonalDataRequestResult> overdue = requestRepository.findOpenWithDueBefore(now).stream()
                .map(resultMapper::toResult)
                .toList();

        List<PersonalDataRequestResult> upcoming = requestRepository
                .findOpenWithDueBetween(now, upcomingEnd).stream()
                .map(resultMapper::toResult)
                .toList();

        return new PersonalDataRequestDeadlineReviewResult(overdue, upcoming);
    }
}
