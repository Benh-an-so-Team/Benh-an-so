package com.benhsoan.application.ucservice.survey;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.application.ucservice.patient.PatientAccessGuard;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.survey.PatientSatisfactionSurvey;
import com.benhsoan.domain.survey.exception.SatisfactionSurveyAlreadyExistsException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.exception.VisitInvalidStatusException;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;
import com.benhsoan.port.inbound.survey.SubmitSatisfactionSurveyUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.survey.SatisfactionSurveyRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class SubmitSatisfactionSurveyService implements SubmitSatisfactionSurveyUseCase {

    private final VisitRepository visitRepository;
    private final SatisfactionSurveyRepository surveyRepository;
    private final PatientAccessGuard patientAccessGuard;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;

    @Override
    public SatisfactionSurveyResult submitSurvey(UUID visitId, int score, String comment) {
        Visit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new VisitNotFoundException(visitId));

        patientAccessGuard.requirePatientOwnership(
                visit.getPatientId(),
                ResourceType.PATIENT_SATISFACTION_SURVEY,
                visitId
        );

        if (visit.getStatus() != VisitStatus.COMPLETED) {
            throw new VisitInvalidStatusException("Only completed visits can be surveyed.");
        }

        if (surveyRepository.existsByVisitId(visitId)) {
            throw new SatisfactionSurveyAlreadyExistsException(visitId);
        }

        PatientSatisfactionSurvey survey = PatientSatisfactionSurvey.create(
                visitId,
                visit.getPatientId(),
                visit.getDoctorId(),
                score,
                comment,
                clockPort.now()
        );

        PatientSatisfactionSurvey saved = surveyRepository.save(survey);

        String doctorName = userRepository.findById(visit.getDoctorId())
                .map(User::getFullName)
                .orElse("Unknown Doctor");

        AuditLog audit = AuditLog.create(
                currentUserPort.getCurrentUserId(),
                ActionType.CREATE,
                ResourceType.PATIENT_SATISFACTION_SURVEY,
                saved.getId(),
                "Submitted satisfaction survey for visit: " + visit.getVisitCode(),
                null,
                clockPort.now()
        );
        auditLogRepository.save(audit);

        return new SatisfactionSurveyResult(
                saved.getId(),
                saved.getVisitId(),
                visit.getVisitCode(),
                saved.getPatientId(),
                saved.getDoctorId(),
                doctorName,
                saved.getScore(),
                saved.getComment(),
                saved.getCreatedAt(),
                saved.getUpdatedAt()
        );
    }
}
