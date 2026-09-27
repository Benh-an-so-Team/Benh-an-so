package com.benhsoan.persistence.jpaRepository.patient;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.patient.PatientFamilyHistoryEntity;

public interface JpaPatientFamilyHistoryRepository extends JpaRepository<PatientFamilyHistoryEntity, UUID> {

    List<PatientFamilyHistoryEntity> findByPatientIdAndActiveTrue(UUID patientId);
}
