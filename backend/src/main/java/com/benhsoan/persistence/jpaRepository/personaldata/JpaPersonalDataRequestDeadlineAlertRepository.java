package com.benhsoan.persistence.jpaRepository.personaldata;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestDeadlineAlertType;
import com.benhsoan.persistence.entity.personaldata.PersonalDataRequestDeadlineAlertEntity;

public interface JpaPersonalDataRequestDeadlineAlertRepository
        extends JpaRepository<PersonalDataRequestDeadlineAlertEntity, UUID> {

    boolean existsByPersonalDataRequestIdAndAlertType(
            UUID personalDataRequestId, PersonalDataRequestDeadlineAlertType alertType);
}
