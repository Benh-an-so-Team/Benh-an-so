package com.benhsoan.persistence.mapper.personaldata;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.persistence.entity.personaldata.PersonalDataRequestEntity;

@Component
public class PersonalDataRequestPersistenceMapper {

    public PersonalDataRequestEntity toEntity(PersonalDataRequest domain) {
        if (domain == null) {
            return null;
        }
        return PersonalDataRequestEntity.builder()
                .id(domain.getId())
                .patientId(domain.getPatientId())
                .requestType(domain.getRequestType())
                .status(domain.getStatus())
                .reason(domain.getReason())
                .receivedAt(domain.getReceivedAt())
                .dueAt(domain.getDueAt())
                .result(domain.getResult())
                .completedAt(domain.getCompletedAt())
                .processedBy(domain.getProcessedBy())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }

    public PersonalDataRequest toDomain(PersonalDataRequestEntity entity) {
        if (entity == null) {
            return null;
        }
        return PersonalDataRequest.restore(
                entity.getId(),
                entity.getPatientId(),
                entity.getRequestType(),
                entity.getStatus(),
                entity.getReason(),
                entity.getReceivedAt(),
                entity.getDueAt(),
                entity.getResult(),
                entity.getCompletedAt(),
                entity.getProcessedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
