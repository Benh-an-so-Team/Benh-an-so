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
import com.benhsoan.domain.survey.exception.SatisfactionSurveyNotFoundException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;
import com.benhsoan.port.inbound.survey.UpdateSatisfactionSurveyUseCase;
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
public class UpdateSatisfactionSurveyService implements UpdateSatisfactionSurveyUseCase {

    private final SatisfactionSurveyRepository surveyRepository;
    private final VisitRepository visitRepository;
    private final PatientAccessGuard patientAccessGuard;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;

    @Override
    public SatisfactionSurveyResult updateSurvey(UUID surveyId, int score, String comment) {
        PatientSatisfactionSurvey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new SatisfactionSurveyNotFoundException(surveyId));

        patientAccessGuard.requirePatientOwnership(
                survey.getPatientId(),
                ResourceType.PATIENT_SATISFACTION_SURVEY,
                surveyId
        );

        survey.update(score, comment, clockPort.now());
        PatientSatisfactionSurvey updated = surveyRepository.save(survey);

        Visit visit = visitRepository.findById(survey.getVisitId())
                .orElseThrow(() -> new VisitNotFoundException(survey.getVisitId()));

        String doctorName = userRepository.findById(survey.getDoctorId())
                .map(User::getFullName)
                .orElse("Unknown Doctor");

        AuditLog audit = AuditLog.create(
                currentUserPort.getCurrentUserId(),
                ActionType.UPDATE,
                ResourceType.PATIENT_SATISFACTION_SURVEY,
                updated.getId(),
                "Updated satisfaction survey for visit: " + visit.getVisitCode(),
                null,
                clockPort.now()
        );
        auditLogRepository.save(audit);

        return new SatisfactionSurveyResult(
                updated.getId(),
                updated.getVisitId(),
                visit.getVisitCode(),
                updated.getPatientId(),
                updated.getDoctorId(),
                doctorName,
                updated.getScore(),
                updated.getComment(),
                updated.getCreatedAt(),
                updated.getUpdatedAt()
        );
    }
}
