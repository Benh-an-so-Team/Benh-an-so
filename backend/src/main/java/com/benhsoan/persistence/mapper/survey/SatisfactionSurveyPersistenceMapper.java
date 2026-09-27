package com.benhsoan.persistence.mapper.survey;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.survey.PatientSatisfactionSurvey;
import com.benhsoan.persistence.entity.survey.SatisfactionSurveyEntity;

@Component
public class SatisfactionSurveyPersistenceMapper {

    public SatisfactionSurveyEntity toEntity(PatientSatisfactionSurvey domain) {
        if (domain == null) {
            return null;
        }
        return SatisfactionSurveyEntity.builder()
                .id(domain.getId())
                .visitId(domain.getVisitId())
                .patientId(domain.getPatientId())
                .doctorId(domain.getDoctorId())
                .score(domain.getScore())
                .comment(domain.getComment())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    public PatientSatisfactionSurvey toDomain(SatisfactionSurveyEntity entity) {
        if (entity == null) {
            return null;
        }
        return PatientSatisfactionSurvey.restore(
                entity.getId(),
                entity.getVisitId(),
                entity.getPatientId(),
                entity.getDoctorId(),
                entity.getScore(),
                entity.getComment(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
