package com.benhsoan.application.ucservice.personaldata;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestDeadlineAlertType;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineReviewResult;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.inbound.personaldata.PersistPersonalDataRequestDeadlineAlertsUseCase;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestDeadlineAlertRepository;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

/**
 * NCL-15-CN-006 TC-02: persists a deduplicated administrator alert per affected
 * request. Identity is (request id + alert type), so re-running the scheduler does
 * not create duplicate alerts for the same condition.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class PersistPersonalDataRequestDeadlineAlertsService
        implements PersistPersonalDataRequestDeadlineAlertsUseCase {

    private final PersonalDataRequestDeadlineAlertRepository alertRepository;
    private final ClockPort clockPort;

    @Override
    public int persist(PersonalDataRequestDeadlineReviewResult review) {
        int created = 0;
        for (PersonalDataRequestResult request : review.overdueRequests()) {
            if (alertRepository.saveIfAbsent(
                    request.id(), PersonalDataRequestDeadlineAlertType.OVERDUE, clockPort.now())) {
                created++;
            }
        }
        for (PersonalDataRequestResult request : review.upcomingRequests()) {
            if (alertRepository.saveIfAbsent(
                    request.id(), PersonalDataRequestDeadlineAlertType.UPCOMING, clockPort.now())) {
                created++;
            }
        }
        return created;
    }
}
