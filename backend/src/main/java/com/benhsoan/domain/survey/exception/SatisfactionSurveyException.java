package com.benhsoan.domain.survey.exception;

import com.benhsoan.domain.shared.exception.DomainErrorCode;
import com.benhsoan.domain.shared.exception.DomainException;

public abstract class SatisfactionSurveyException extends DomainException {

    protected SatisfactionSurveyException(DomainErrorCode code, String message) {
        super(code, message);
    }
}
