package com.benhsoan.persistence.adapterRepository.personaldata;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.personaldata.PersonalDataRequestDeadlineAlert;
import com.benhsoan.domain.personaldata.enums.PersonalDataRequestDeadlineAlertType;
import com.benhsoan.persistence.entity.personaldata.PersonalDataRequestDeadlineAlertEntity;
import com.benhsoan.persistence.jpaRepository.personaldata.JpaPersonalDataRequestDeadlineAlertRepository;
import com.benhsoan.persistence.mapper.personaldata.PersonalDataRequestDeadlineAlertPersistenceMapper;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestDeadlineAlertRepository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PersonalDataRequestDeadlineAlertRepositoryAdapter
        implements PersonalDataRequestDeadlineAlertRepository {

    private final JpaPersonalDataRequestDeadlineAlertRepository jpaRepository;
    private final PersonalDataRequestDeadlineAlertPersistenceMapper mapper;

    @Override
    @Transactional
    public boolean saveIfAbsent(
            UUID personalDataRequestId,
            PersonalDataRequestDeadlineAlertType alertType,
            Instant createdAt) {
        if (jpaRepository.existsByPersonalDataRequestIdAndAlertType(personalDataRequestId, alertType)) {
            return false;
        }
        PersonalDataRequestDeadlineAlert alert = PersonalDataRequestDeadlineAlert.create(
                personalDataRequestId, alertType, createdAt);
        jpaRepository.save(mapper.toEntity(alert));
        return true;
    }

    @Override
    public Page<PersonalDataRequestDeadlineAlert> findAll(Pageable pageable) {
        return jpaRepository.findAll(pageable).map(mapper::toDomain);
    }
}
