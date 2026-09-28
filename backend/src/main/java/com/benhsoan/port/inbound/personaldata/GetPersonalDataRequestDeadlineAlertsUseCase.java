package com.benhsoan.port.inbound.personaldata;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineAlertResult;

public interface GetPersonalDataRequestDeadlineAlertsUseCase {

    Page<PersonalDataRequestDeadlineAlertResult> getAlerts(Pageable pageable);
}
