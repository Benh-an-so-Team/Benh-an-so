package com.benhsoan.persistence.jpaRepository.vitalsign;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.vitalsign.VitalSignEntity;

public interface JpaVitalSignRepository extends JpaRepository<VitalSignEntity, UUID> {

    Optional<VitalSignEntity> findFirstByVisitIdOrderByRecordedAtDesc(UUID visitId);

    List<VitalSignEntity> findByVisitIdOrderByRecordedAtDesc(UUID visitId);

    List<VitalSignEntity> findByPatientIdOrderByRecordedAtAsc(UUID patientId);

    List<VitalSignEntity> findByPatientIdOrderByRecordedAtDesc(UUID patientId);

    boolean existsByVisitId(UUID visitId);
}
