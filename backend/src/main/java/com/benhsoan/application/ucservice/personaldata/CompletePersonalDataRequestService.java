package com.benhsoan.application.ucservice.personaldata;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.domain.personaldata.exception.PersonalDataRequestNotFoundException;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.inbound.personaldata.CompletePersonalDataRequestUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class CompletePersonalDataRequestService implements CompletePersonalDataRequestUseCase {

    private final PersonalDataRequestRepository requestRepository;
    private final PersonalDataRequestAuthorizer authorizer;
    private final PersonalDataRequestResultMapper resultMapper;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;

    @Override
    public PersonalDataRequestResult complete(UUID id, String result) {
        authorizer.requireUpdatePermission();

        PersonalDataRequest request = requestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new PersonalDataRequestNotFoundException(id));

        Instant now = clockPort.now();
        UUID processorId = currentUserPort.getCurrentUserId();
        request.complete(result, processorId, now);

        PersonalDataRequest saved = requestRepository.save(request);

        auditLogRepository.save(AuditLog.create(
                processorId,
                ActionType.UPDATE,
                ResourceType.PERSONAL_DATA_REQUEST,
                saved.getId(),
                "Completed personal data request of type: " + saved.getRequestType(),
                null,
                now
        ));

        return resultMapper.toResult(saved);
    }
}
