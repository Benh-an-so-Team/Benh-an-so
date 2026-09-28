package com.benhsoan.persistence.jpaRepository.medicalrecord;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.medicalrecord.MedicalRecordSigningReminderEntity;

public interface JpaMedicalRecordSigningReminderRepository
        extends JpaRepository<MedicalRecordSigningReminderEntity, UUID> {

    List<MedicalRecordSigningReminderEntity> findByMedicalRecordIdOrderByRemindedAtDesc(UUID medicalRecordId);

    long countByMedicalRecordId(UUID medicalRecordId);

    Optional<MedicalRecordSigningReminderEntity> findTopByMedicalRecordIdOrderByRemindedAtDesc(UUID medicalRecordId);
}
