package com.benhsoan.persistence.jpaRepository.patient;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.patient.PatientAllergyChangeLogEntity;

public interface JpaPatientAllergyChangeLogRepository extends JpaRepository<PatientAllergyChangeLogEntity, UUID> {

    List<PatientAllergyChangeLogEntity> findByAllergyIdOrderByChangedAtDesc(UUID allergyId);

    List<PatientAllergyChangeLogEntity> findByPatientIdOrderByChangedAtDesc(UUID patientId);
}
