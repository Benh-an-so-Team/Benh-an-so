package com.benhsoan.persistence.jpaRepository.patient;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.patient.PatientChronicDiseaseEntity;

public interface JpaPatientChronicDiseaseRepository extends JpaRepository<PatientChronicDiseaseEntity, UUID> {

    List<PatientChronicDiseaseEntity> findByPatientIdAndActiveTrue(UUID patientId);

    boolean existsByPatientIdAndDiagnosisCatalogIdAndActiveTrue(UUID patientId, UUID diagnosisCatalogId);
}
