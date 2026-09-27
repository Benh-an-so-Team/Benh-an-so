package com.benhsoan.port.inbound.survey;

import java.util.UUID;

import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;

public interface SubmitSatisfactionSurveyUseCase {

    SatisfactionSurveyResult submitSurvey(UUID visitId, int score, String comment);
}
