package com.benhsoan.persistence.jpaRepository.medicalrecord;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.benhsoan.persistence.entity.medicalrecord.MedicalRecordEntity;

public interface JpaArchiveMedicalRecordRepository extends JpaRepository<MedicalRecordEntity, UUID> {

    @Query(value = """
            SELECT new com.benhsoan.persistence.jpaRepository.medicalrecord.ArchiveEligibleMedicalRecordProjection(
                mr.id,
                v.id,
                v.visitCode,
                p.id,
                p.patientCode,
                p.fullName,
                u.id,
                u.fullName,
                s.name,
                mr.status,
                v.completedAt,
                mr.signedAt
            )
            FROM MedicalRecordEntity mr
            JOIN VisitEntity v ON mr.visitId = v.id
            JOIN PatientEntity p ON v.patientId = p.id
            JOIN UserEntity u ON v.doctorId = u.id
            LEFT JOIN SpecialtyEntity s ON v.specialtyId = s.id
            WHERE v.status = com.benhsoan.domain.visit.enums.VisitStatus.COMPLETED
              AND v.completedAt IS NOT NULL
              AND mr.status IN (com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.SIGNED, com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.LOCKED)
              AND v.completedAt <= :completedBefore
            ORDER BY v.completedAt ASC, mr.id ASC
            """,
            countQuery = """
            SELECT COUNT(mr.id)
            FROM MedicalRecordEntity mr
            JOIN VisitEntity v ON mr.visitId = v.id
            WHERE v.status = com.benhsoan.domain.visit.enums.VisitStatus.COMPLETED
              AND v.completedAt IS NOT NULL
              AND mr.status IN (com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.SIGNED, com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.LOCKED)
              AND v.completedAt <= :completedBefore
            """)
    Page<ArchiveEligibleMedicalRecordProjection> findEligibleForArchive(
            @Param("completedBefore") Instant completedBefore,
            Pageable pageable
    );

    @Query("""
            SELECT mr.id
            FROM MedicalRecordEntity mr
            JOIN VisitEntity v ON mr.visitId = v.id
            WHERE v.status = com.benhsoan.domain.visit.enums.VisitStatus.COMPLETED
              AND v.completedAt IS NOT NULL
              AND mr.status IN (com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.SIGNED, com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.LOCKED)
              AND v.completedAt <= :completedBefore
            ORDER BY v.completedAt ASC
            """)
    List<UUID> findAllEligibleMedicalRecordIds(
            @Param("completedBefore") Instant completedBefore
    );

    @Query(value = """
            SELECT new com.benhsoan.persistence.jpaRepository.medicalrecord.ArchivedMedicalRecordProjection(
                mr.id,
                v.id,
                v.visitCode,
                p.id,
                p.patientCode,
                p.fullName,
                p.phone,
                u.id,
                u.fullName,
                mr.conclusion,
                mr.revisitDate,
                mr.status,
                v.completedAt,
                mr.signedAt,
                mr.archivedAt,
                mr.archivedBy
            )
            FROM MedicalRecordEntity mr
            JOIN VisitEntity v ON mr.visitId = v.id
            JOIN PatientEntity p ON v.patientId = p.id
            JOIN UserEntity u ON v.doctorId = u.id
            WHERE mr.status = com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.ARCHIVED
              AND (:doctorId IS NULL OR v.doctorId = :doctorId)
              AND (:fromInstant IS NULL OR v.visitAt >= :fromInstant)
              AND (:toInstant IS NULL OR v.visitAt < :toInstant)
              AND (
                  :keyword IS NULL OR :keyword = ''
                  OR LOWER(p.patientCode) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(p.fullName) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR p.phone LIKE CONCAT('%', :keyword, '%')
                  OR LOWER(v.visitCode) LIKE LOWER(CONCAT('%', :keyword, '%'))
              )
            ORDER BY mr.archivedAt DESC, mr.id DESC
            """,
            countQuery = """
            SELECT COUNT(mr.id)
            FROM MedicalRecordEntity mr
            JOIN VisitEntity v ON mr.visitId = v.id
            JOIN PatientEntity p ON v.patientId = p.id
            WHERE mr.status = com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.ARCHIVED
              AND (:doctorId IS NULL OR v.doctorId = :doctorId)
              AND (:fromInstant IS NULL OR v.visitAt >= :fromInstant)
              AND (:toInstant IS NULL OR v.visitAt < :toInstant)
              AND (
                  :keyword IS NULL OR :keyword = ''
                  OR LOWER(p.patientCode) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(p.fullName) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR p.phone LIKE CONCAT('%', :keyword, '%')
                  OR LOWER(v.visitCode) LIKE LOWER(CONCAT('%', :keyword, '%'))
              )
            """)
    Page<ArchivedMedicalRecordProjection> searchArchivedRecords(
            @Param("keyword") String keyword,
            @Param("fromInstant") Instant fromInstant,
            @Param("toInstant") Instant toInstant,
            @Param("doctorId") UUID doctorId,
            Pageable pageable
    );
}
