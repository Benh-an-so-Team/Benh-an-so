package com.benhsoan.persistence.jpaRepository.prescription;

import java.util.List;
import java.util.Optional;
import java.time.Instant;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.benhsoan.persistence.entity.prescription.PrescriptionEntity;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;

import jakarta.persistence.LockModeType;

public interface JpaPrescriptionRepository
        extends JpaRepository<PrescriptionEntity, UUID> {

    Optional<PrescriptionEntity> findByPrescriptionCode(String prescriptionCode);

    boolean existsByPrescriptionCode(String prescriptionCode);

    Optional<PrescriptionEntity> findTopByOrderByPrescriptionCodeDesc();

    List<PrescriptionEntity> findByMedicalRecordIdOrderByPrescribedAtDesc(
            UUID medicalRecordId
    );

    Page<PrescriptionEntity> findByStatus(
            PrescriptionStatus status,
            Pageable pageable
    );

    @Query("""
            select prescription from PrescriptionEntity prescription
            where prescription.interconnectionStatus = :status
              and (:fromInclusive is null or prescription.lastInterconnectionAt >= :fromInclusive)
              and (:toExclusive is null or prescription.lastInterconnectionAt < :toExclusive)
            """)
    Page<PrescriptionEntity> findByInterconnectionStatus(
            @Param("status") InterconnectionStatus status,
            @Param("fromInclusive") Instant fromInclusive,
            @Param("toExclusive") Instant toExclusive,
            Pageable pageable
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select prescription from PrescriptionEntity prescription "
            + "where prescription.id = :id")
    Optional<PrescriptionEntity> findByIdForUpdate(@Param("id") UUID id);

    Optional<PrescriptionEntity> findByReplacesPrescriptionId(UUID replacesPrescriptionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select prescription from PrescriptionEntity prescription "
            + "where prescription.medicalRecordId = :medicalRecordId "
            + "and prescription.status = :status "
            + "order by prescription.prescribedAt")
    List<PrescriptionEntity> findByMedicalRecordIdAndStatusForUpdate(
            @Param("medicalRecordId") UUID medicalRecordId,
            @Param("status") PrescriptionStatus status);

    @Query("select prescription.id from PrescriptionEntity prescription "
            + "where prescription.medicalRecordId = :medicalRecordId")
    List<UUID> findIdsByMedicalRecordId(@Param("medicalRecordId") UUID medicalRecordId);

    @Query("""
            select new com.benhsoan.persistence.jpaRepository.prescription.PrescriptionCountProjection(
                prescription.medicalRecordId, count(prescription)
            )
            from PrescriptionEntity prescription
            where prescription.medicalRecordId in :medicalRecordIds
            group by prescription.medicalRecordId
            """)
    List<PrescriptionCountProjection> countByMedicalRecordIdIn(
            @Param("medicalRecordIds") java.util.Collection<UUID> medicalRecordIds
    );

    @Modifying
    @Query("delete from PrescriptionEntity prescription where prescription.medicalRecordId = :medicalRecordId")
    void deleteByMedicalRecordId(@Param("medicalRecordId") UUID medicalRecordId);

}
