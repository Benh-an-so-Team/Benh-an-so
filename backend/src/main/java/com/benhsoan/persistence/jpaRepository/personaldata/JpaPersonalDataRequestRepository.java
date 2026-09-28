package com.benhsoan.persistence.jpaRepository.personaldata;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.persistence.entity.personaldata.PersonalDataRequestEntity;

import jakarta.persistence.LockModeType;

public interface JpaPersonalDataRequestRepository extends JpaRepository<PersonalDataRequestEntity, UUID> {

    List<PersonalDataRequestEntity> findByStatusAndDueAtBeforeOrderByDueAtAsc(
            PersonalDataRequestStatus status, Instant dueAt);

    List<PersonalDataRequestEntity> findByStatusAndDueAtBetweenOrderByDueAtAsc(
            PersonalDataRequestStatus status, Instant from, Instant to);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PersonalDataRequestEntity r where r.id = :id")
    Optional<PersonalDataRequestEntity> findByIdForUpdate(@Param("id") UUID id);

    @Query("""
            select r from PersonalDataRequestEntity r
            where (:patientId is null or r.patientId = :patientId)
              and (:status is null or r.status = :status)
              and (:overdueOnly = false
                   or (r.status = com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus.RECEIVED
                       and r.dueAt < :now))
              and (:dueFrom is null or r.dueAt >= :dueFrom)
              and (:dueTo is null or r.dueAt <= :dueTo)
            """)
    Page<PersonalDataRequestEntity> search(
            @Param("patientId") UUID patientId,
            @Param("status") PersonalDataRequestStatus status,
            @Param("overdueOnly") boolean overdueOnly,
            @Param("now") Instant now,
            @Param("dueFrom") Instant dueFrom,
            @Param("dueTo") Instant dueTo,
            Pageable pageable);
}
