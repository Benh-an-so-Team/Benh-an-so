package com.benhsoan.application.ucservice.personaldata;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.exception.PatientAlreadyMergedException;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.port.dto.command.personaldata.RecordPersonalDataRequestCommand;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.inbound.personaldata.RecordPersonalDataRequestUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class RecordPersonalDataRequestService implements RecordPersonalDataRequestUseCase {

    private final PersonalDataRequestRepository requestRepository;
    private final PatientRepository patientRepository;
    private final PersonalDataRequestAuthorizer authorizer;
    private final PersonalDataRequestResultMapper resultMapper;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;

    @Override
    public PersonalDataRequestResult record(RecordPersonalDataRequestCommand command) {
        authorizer.requireUpdatePermission();

        Patient patient = patientRepository.findById(command.patientId())
                .orElseThrow(() -> new PatientNotFoundException(command.patientId()));
        if (patient.isMerged()) {
            throw new PatientAlreadyMergedException(patient.getId(), patient.getMergedIntoPatientId());
        }

        Instant now = clockPort.now();
        PersonalDataRequest request = PersonalDataRequest.create(
                command.patientId(),
                command.requestType(),
                command.reason(),
                now,
                command.dueAt()
        );

        PersonalDataRequest saved = requestRepository.save(request);

        auditLogRepository.save(AuditLog.create(
                currentUserPort.getCurrentUserId(),
                ActionType.CREATE,
                ResourceType.PERSONAL_DATA_REQUEST,
                saved.getId(),
                "Recorded personal data request of type: " + saved.getRequestType(),
                null,
                now
        ));

        return resultMapper.toResult(saved);
    }
}
