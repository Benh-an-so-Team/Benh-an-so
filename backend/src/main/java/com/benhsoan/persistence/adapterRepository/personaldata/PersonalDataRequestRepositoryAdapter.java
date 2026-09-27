package com.benhsoan.persistence.adapterRepository.personaldata;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.personaldata.PersonalDataRequest;
import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.persistence.entity.personaldata.PersonalDataRequestEntity;
import com.benhsoan.persistence.jpaRepository.personaldata.JpaPersonalDataRequestRepository;
import com.benhsoan.persistence.mapper.personaldata.PersonalDataRequestPersistenceMapper;
import com.benhsoan.port.outbound.repository.personaldata.PersonalDataRequestRepository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PersonalDataRequestRepositoryAdapter implements PersonalDataRequestRepository {

    private final JpaPersonalDataRequestRepository jpaRepository;
    private final PersonalDataRequestPersistenceMapper mapper;

    @Override
    @Transactional
    public PersonalDataRequest save(PersonalDataRequest request) {
        PersonalDataRequestEntity saved = jpaRepository.save(mapper.toEntity(request));
        return mapper.toDomain(saved);
    }

    @Override
    public Optional<PersonalDataRequest> findById(UUID id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }

    @Override
    public Optional<PersonalDataRequest> findByIdForUpdate(UUID id) {
        return jpaRepository.findByIdForUpdate(id).map(mapper::toDomain);
    }

    @Override
    public Page<PersonalDataRequest> search(
            UUID patientId,
            PersonalDataRequestStatus status,
            boolean overdueOnly,
            Instant now,
            Instant dueFrom,
            Instant dueTo,
            Pageable pageable) {
        return jpaRepository.search(patientId, status, overdueOnly, now, dueFrom, dueTo, pageable)
                .map(mapper::toDomain);
    }

    @Override
    public List<PersonalDataRequest> findOpenWithDueBefore(Instant now) {
        return jpaRepository
                .findByStatusAndDueAtBeforeOrderByDueAtAsc(PersonalDataRequestStatus.RECEIVED, now)
                .stream()
                .map(mapper::toDomain)
                .toList();
    }

    @Override
    public List<PersonalDataRequest> findOpenWithDueBetween(Instant fromInclusive, Instant toInclusive) {
        return jpaRepository
                .findByStatusAndDueAtBetweenOrderByDueAtAsc(PersonalDataRequestStatus.RECEIVED, fromInclusive, toInclusive)
                .stream()
                .map(mapper::toDomain)
                .toList();
    }
}
