package com.benhsoan.persistence.jpaRepository.medicalrecord;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.benhsoan.persistence.entity.medicalrecord.MedicalRecordEntity;

public interface JpaOverdueMedicalRecordRepository extends JpaRepository<MedicalRecordEntity, UUID> {

    @Query(value = """
            SELECT new com.benhsoan.persistence.jpaRepository.medicalrecord.OverdueMedicalRecordProjection(
                mr.id,
                mr.status,
                v.id,
                v.visitCode,
                v.completedAt,
                p.id,
                p.patientCode,
                p.fullName,
                u.id,
                u.fullName,
                u.email,
                u.phone,
                (SELECT COUNT(r.id) FROM MedicalRecordSigningReminderEntity r WHERE r.medicalRecordId = mr.id),
                (SELECT MAX(r.remindedAt) FROM MedicalRecordSigningReminderEntity r WHERE r.medicalRecordId = mr.id)
            )
            FROM MedicalRecordEntity mr
            JOIN VisitEntity v ON mr.visitId = v.id
            JOIN PatientEntity p ON v.patientId = p.id
            JOIN UserEntity u ON v.doctorId = u.id
            WHERE v.status = com.benhsoan.domain.visit.enums.VisitStatus.COMPLETED
              AND v.completedAt IS NOT NULL
              AND mr.status IN (com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.DRAFT, com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.OPEN)
              AND v.completedAt <= :thresholdCompletedAt
              AND (:doctorId IS NULL OR v.doctorId = :doctorId)
            ORDER BY v.completedAt ASC, mr.id ASC
            """,
            countQuery = """
            SELECT COUNT(mr.id)
            FROM MedicalRecordEntity mr
            JOIN VisitEntity v ON mr.visitId = v.id
            WHERE v.status = com.benhsoan.domain.visit.enums.VisitStatus.COMPLETED
              AND v.completedAt IS NOT NULL
              AND mr.status IN (com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.DRAFT, com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.OPEN)
              AND v.completedAt <= :thresholdCompletedAt
              AND (:doctorId IS NULL OR v.doctorId = :doctorId)
            """)
    Page<OverdueMedicalRecordProjection> findOverdueRecords(
            @Param("thresholdCompletedAt") Instant thresholdCompletedAt,
            @Param("doctorId") UUID doctorId,
            Pageable pageable
    );
}
