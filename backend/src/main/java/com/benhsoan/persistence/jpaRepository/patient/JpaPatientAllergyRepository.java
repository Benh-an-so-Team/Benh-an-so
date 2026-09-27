package com.benhsoan.persistence.jpaRepository.patient;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.patient.PatientAllergyEntity;

public interface JpaPatientAllergyRepository extends JpaRepository<PatientAllergyEntity, UUID> {

    List<PatientAllergyEntity> findByPatientIdAndActiveTrue(UUID patientId);

    boolean existsByPatientIdAndNormalizedAllergenNameAndActiveTrue(UUID patientId, String normalizedAllergenName);

    boolean existsByPatientIdAndNormalizedAllergenNameAndActiveTrueAndIdNot(
            UUID patientId,
            String normalizedAllergenName,
            UUID id
    );
}
