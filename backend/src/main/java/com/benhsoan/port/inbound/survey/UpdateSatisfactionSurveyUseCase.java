package com.benhsoan.port.inbound.survey;

import java.util.UUID;

import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;

public interface UpdateSatisfactionSurveyUseCase {

    SatisfactionSurveyResult updateSurvey(UUID surveyId, int score, String comment);
}
