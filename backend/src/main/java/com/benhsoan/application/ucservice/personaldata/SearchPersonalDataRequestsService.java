package com.benhsoan.application.ucservice.personaldata;

import java.time.Instant;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.port.dto.query.personaldata.SearchPersonalDataRequestsQuery;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.inbound.personaldata.SearchPersonalDataRequestsUseCase;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestRepository;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SearchPersonalDataRequestsService implements SearchPersonalDataRequestsUseCase {

    private final PersonalDataRequestRepository requestRepository;
    private final PersonalDataRequestAuthorizer authorizer;
    private final PersonalDataRequestResultMapper resultMapper;
    private final ClockPort clockPort;

    @Override
    public Page<PersonalDataRequestResult> search(SearchPersonalDataRequestsQuery query, Pageable pageable) {
        authorizer.requireReadPermission();

        Instant now = clockPort.now();
        Page<PersonalDataRequest> page = requestRepository.search(
                query.patientId(),
                query.status(),
                query.overdueOnly(),
                now,
                query.dueFrom(),
                query.dueTo(),
                pageable
        );
        return page.map(resultMapper::toResult);
    }
}
