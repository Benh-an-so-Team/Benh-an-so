package com.benhsoan.port.outbound.repository.survey;

import java.util.Optional;
import java.util.UUID;

import com.benhsoan.domain.survey.PatientSatisfactionSurvey;

public interface SatisfactionSurveyRepository {

    PatientSatisfactionSurvey save(PatientSatisfactionSurvey survey);

    Optional<PatientSatisfactionSurvey> findById(UUID id);

    Optional<PatientSatisfactionSurvey> findByVisitId(UUID visitId);

    boolean existsByVisitId(UUID visitId);
}
