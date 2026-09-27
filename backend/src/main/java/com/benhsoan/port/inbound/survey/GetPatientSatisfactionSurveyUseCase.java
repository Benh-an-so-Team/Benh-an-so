package com.benhsoan.port.inbound.survey;

import java.util.UUID;

import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;

public interface GetPatientSatisfactionSurveyUseCase {

    SatisfactionSurveyResult getSurveyByVisitId(UUID visitId);

    SatisfactionSurveyResult getSurveyById(UUID surveyId);
}
