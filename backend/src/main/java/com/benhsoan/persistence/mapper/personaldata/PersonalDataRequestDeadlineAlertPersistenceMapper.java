package com.benhsoan.persistence.mapper.personaldata;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.personaldata.PersonalDataRequestDeadlineAlert;
import com.benhsoan.persistence.entity.personaldata.PersonalDataRequestDeadlineAlertEntity;

@Component
public class PersonalDataRequestDeadlineAlertPersistenceMapper {

    public PersonalDataRequestDeadlineAlertEntity toEntity(PersonalDataRequestDeadlineAlert domain) {
        if (domain == null) {
            return null;
        }
        return PersonalDataRequestDeadlineAlertEntity.builder()
                .id(domain.getId())
                .personalDataRequestId(domain.getPersonalDataRequestId())
                .alertType(domain.getAlertType())
                .createdAt(domain.getCreatedAt())
                .build();
    }

    public PersonalDataRequestDeadlineAlert toDomain(PersonalDataRequestDeadlineAlertEntity entity) {
        if (entity == null) {
            return null;
        }
        return PersonalDataRequestDeadlineAlert.restore(
                entity.getId(),
                entity.getPersonalDataRequestId(),
                entity.getAlertType(),
                entity.getCreatedAt());
    }
}
