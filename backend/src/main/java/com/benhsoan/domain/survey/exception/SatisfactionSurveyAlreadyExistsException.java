package com.benhsoan.domain.survey.exception;

import java.util.UUID;

import com.benhsoan.domain.shared.exception.DomainErrorCode;

public class SatisfactionSurveyAlreadyExistsException extends SatisfactionSurveyException {

    public SatisfactionSurveyAlreadyExistsException(UUID visitId) {
        super(DomainErrorCode.SATISFACTION_SURVEY_ALREADY_EXISTS,
                "Satisfaction survey already exists for visit: " + visitId);
    }
}
