package com.benhsoan.application.ucservice.personaldata;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.personaldata.exception.PersonalDataRequestNotFoundException;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.inbound.personaldata.GetPersonalDataRequestUseCase;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetPersonalDataRequestService implements GetPersonalDataRequestUseCase {

    private final PersonalDataRequestRepository requestRepository;
    private final PersonalDataRequestAuthorizer authorizer;
    private final PersonalDataRequestResultMapper resultMapper;

    @Override
    public PersonalDataRequestResult getById(UUID id) {
        authorizer.requireReadPermission();
        return requestRepository.findById(id)
                .map(resultMapper::toResult)
                .orElseThrow(() -> new PersonalDataRequestNotFoundException(id));
    }
}
