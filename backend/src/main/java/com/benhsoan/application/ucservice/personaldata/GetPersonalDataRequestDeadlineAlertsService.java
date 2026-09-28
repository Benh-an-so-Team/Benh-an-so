package com.benhsoan.application.ucservice.personaldata;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineAlertResult;
import com.benhsoan.port.inbound.personaldata.GetPersonalDataRequestDeadlineAlertsUseCase;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestDeadlineAlertRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetPersonalDataRequestDeadlineAlertsService
        implements GetPersonalDataRequestDeadlineAlertsUseCase {

    private final PersonalDataRequestDeadlineAlertRepository alertRepository;

    @Override
    public Page<PersonalDataRequestDeadlineAlertResult> getAlerts(Pageable pageable) {
        return alertRepository.findAll(pageable)
                .map(alert -> new PersonalDataRequestDeadlineAlertResult(
                        alert.getId(),
                        alert.getPersonalDataRequestId(),
                        alert.getAlertType(),
                        alert.getCreatedAt()));
    }
}
