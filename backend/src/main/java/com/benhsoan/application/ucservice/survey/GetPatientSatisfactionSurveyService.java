package com.benhsoan.application.ucservice.survey;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.application.ucservice.patient.PatientAccessGuard;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.survey.PatientSatisfactionSurvey;
import com.benhsoan.domain.survey.exception.SatisfactionSurveyNotFoundException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;
import com.benhsoan.port.inbound.survey.GetPatientSatisfactionSurveyUseCase;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.survey.SatisfactionSurveyRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetPatientSatisfactionSurveyService implements GetPatientSatisfactionSurveyUseCase {

    private final SatisfactionSurveyRepository surveyRepository;
    private final VisitRepository visitRepository;
    private final PatientAccessGuard patientAccessGuard;
    private final UserRepository userRepository;

    @Override
    public SatisfactionSurveyResult getSurveyByVisitId(UUID visitId) {
        Visit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new VisitNotFoundException(visitId));

        patientAccessGuard.requirePatientOwnership(
                visit.getPatientId(),
                ResourceType.PATIENT_SATISFACTION_SURVEY,
                visitId
        );

        PatientSatisfactionSurvey survey = surveyRepository.findByVisitId(visitId)
                .orElseThrow(() -> new SatisfactionSurveyNotFoundException("Survey not found for visit: " + visitId));

        return toResult(survey, visit.getVisitCode());
    }

    @Override
    public SatisfactionSurveyResult getSurveyById(UUID surveyId) {
        PatientSatisfactionSurvey survey = surveyRepository.findById(surveyId)
                .orElseThrow(() -> new SatisfactionSurveyNotFoundException(surveyId));

        patientAccessGuard.requirePatientOwnership(
                survey.getPatientId(),
                ResourceType.PATIENT_SATISFACTION_SURVEY,
                surveyId
        );

        Visit visit = visitRepository.findById(survey.getVisitId())
                .orElseThrow(() -> new VisitNotFoundException(survey.getVisitId()));

        return toResult(survey, visit.getVisitCode());
    }

    private SatisfactionSurveyResult toResult(PatientSatisfactionSurvey survey, String visitCode) {
        String doctorName = userRepository.findById(survey.getDoctorId())
                .map(User::getFullName)
                .orElse("Unknown Doctor");

        return new SatisfactionSurveyResult(
                survey.getId(),
                survey.getVisitId(),
                visitCode,
                survey.getPatientId(),
                survey.getDoctorId(),
                doctorName,
                survey.getScore(),
                survey.getComment(),
                survey.getCreatedAt(),
                survey.getUpdatedAt()
        );
    }
}
