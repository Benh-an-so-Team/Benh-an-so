package com.benhsoan.adapter.inbound.rest.mapper;

import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.response.survey.SatisfactionSurveyResponse;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;

@Component
public class SatisfactionSurveyRestMapper {

    public SatisfactionSurveyResponse toResponse(SatisfactionSurveyResult result) {
        if (result == null) {
            return null;
        }
        return new SatisfactionSurveyResponse(
                result.id(),
                result.visitId(),
                result.visitCode(),
                result.patientId(),
                result.doctorId(),
                result.doctorName(),
                result.score(),
                result.comment(),
                result.createdAt(),
                result.updatedAt()
        );
    }
}
