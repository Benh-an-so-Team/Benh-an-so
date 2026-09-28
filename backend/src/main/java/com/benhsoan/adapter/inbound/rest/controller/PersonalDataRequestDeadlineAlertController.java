package com.benhsoan.adapter.inbound.rest.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.benhsoan.adapter.inbound.rest.mapper.PersonalDataRequestDeadlineAlertRestMapper;
import com.benhsoan.adapter.inbound.rest.response.personaldata.PersonalDataRequestDeadlineAlertResponse;
import com.benhsoan.infrastructure.security.annotation.RequirePermission;
import com.benhsoan.port.inbound.personaldata.GetPersonalDataRequestDeadlineAlertsUseCase;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/personal-data-request-deadline-alerts")
@RequiredArgsConstructor
public class PersonalDataRequestDeadlineAlertController {

    private final GetPersonalDataRequestDeadlineAlertsUseCase getAlertsUseCase;
    private final PersonalDataRequestDeadlineAlertRestMapper mapper;

    @GetMapping
    @RequirePermission("PERSONAL_DATA_REQUEST_READ")
    public Page<PersonalDataRequestDeadlineAlertResponse> getAlerts(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return getAlertsUseCase.getAlerts(pageable).map(mapper::toResponse);
    }
}
