package com.benhsoan.persistence.jpaRepository.patient;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import com.benhsoan.persistence.entity.patient.PatientEntity;

public interface JpaPatientRepository extends JpaRepository<PatientEntity, UUID>, JpaSpecificationExecutor<PatientEntity> {

    Optional<PatientEntity> findByPatientCode(String patientCode);

    Page<PatientEntity> findByFullNameContainingIgnoreCase(
            String keyword,
            Pageable pageable
    );

    boolean existsByPatientCode(String patientCode);

    boolean existsByIdentityNumber(String identityNumber);

    Optional<PatientEntity> findByIdentityNumber(String identityNumber);

    Optional<PatientEntity> findTopByOrderByPatientCodeDesc();

    boolean existsByIdentityNumberAndIdNot( String identityNumber, UUID id);

    Optional<PatientEntity> findByUserId(UUID userId);

    Optional<PatientEntity> findByGuardianUserIdAndId(UUID guardianUserId, UUID patientId);

    /**
     * NCL-14-CN-010 / QTN-33: only valid dependent profiles (active, not merged) are eligible
     * for linked-profile discovery and for new dependent booking. Historical appointment
     * records are unaffected because they do not travel through this lookup.
     */
    @Query("""
        select patient from PatientEntity patient
        where patient.guardianUserId = :guardianUserId
          and patient.status = com.benhsoan.domain.patient.enums.PatientStatus.ACTIVE
          and patient.active = true
        order by patient.fullName asc, patient.id asc
        """)
    List<PatientEntity> findValidDependentsByGuardianUserId(
            @Param("guardianUserId") UUID guardianUserId);

    /**
     * Same lifecycle rule as {@link #findValidDependentsByGuardianUserId}, scoped to a single
     * patient id. Used to re-validate the booking target server-side so a client cannot bypass
     * the linked-profile list by submitting an inactive or merged patientId directly.
     */
    @Query("""
        select patient from PatientEntity patient
        where patient.guardianUserId = :guardianUserId
          and patient.id = :patientId
          and patient.status = com.benhsoan.domain.patient.enums.PatientStatus.ACTIVE
          and patient.active = true
        """)
    Optional<PatientEntity> findValidDependentByGuardianUserIdAndId(
            @Param("guardianUserId") UUID guardianUserId,
            @Param("patientId") UUID patientId);

    /**
     * NCL-14-CN-010 TC-03 sweep source: every active, non-merged dependent that still carries a
     * guardian user link. The adulthood check itself uses the canonical
     * {@code PatientMinorPolicy} rather than duplicating age arithmetic in SQL.
     */
    @Query("""
        select patient from PatientEntity patient
        where patient.guardianUserId is not null
          and patient.status = com.benhsoan.domain.patient.enums.PatientStatus.ACTIVE
          and patient.active = true
        """)
    List<PatientEntity> findGuardianLinkedProfiles();

    List<PatientEntity> findAllByPhone(String phone);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select patient from PatientEntity patient where patient.id = :patientId")
    Optional<PatientEntity> findByIdForUpdate(@Param("patientId") UUID patientId);

    @Query("""
        SELECT p FROM PatientEntity p
        WHERE p.status = 'ACTIVE'
          AND p.phone IS NOT NULL
          AND TRIM(p.phone) <> ''
          AND EXISTS (
              SELECT 1 FROM PatientEntity p2
              WHERE p2.id <> p.id
                AND p2.status = 'ACTIVE'
                AND p2.dateOfBirth = p.dateOfBirth
                AND REPLACE(p2.phone, ' ', '') = REPLACE(p.phone, ' ', '')
          )
        ORDER BY p.dateOfBirth ASC, p.phone ASC, p.createdAt ASC
    """)
    List<PatientEntity> findSuspectedDuplicates();
}
