package com.benhsoan.domain.survey.exception;

import java.util.UUID;

import com.benhsoan.domain.shared.exception.DomainErrorCode;

public class SatisfactionSurveyNotFoundException extends SatisfactionSurveyException {

    public SatisfactionSurveyNotFoundException(UUID id) {
        super(DomainErrorCode.SATISFACTION_SURVEY_NOT_FOUND,
                "Satisfaction survey not found: " + id);
    }

    public SatisfactionSurveyNotFoundException(String message) {
        super(DomainErrorCode.SATISFACTION_SURVEY_NOT_FOUND, message);
    }
}
