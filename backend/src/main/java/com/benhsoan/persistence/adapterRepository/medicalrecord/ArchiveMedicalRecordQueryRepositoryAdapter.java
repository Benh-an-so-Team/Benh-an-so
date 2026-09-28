package com.benhsoan.persistence.adapterRepository.medicalrecord;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import com.benhsoan.persistence.jpaRepository.medicalrecord.ArchiveEligibleMedicalRecordProjection;
import com.benhsoan.persistence.jpaRepository.medicalrecord.ArchivedMedicalRecordProjection;
import com.benhsoan.persistence.jpaRepository.medicalrecord.JpaArchiveMedicalRecordRepository;
import com.benhsoan.port.dto.result.ArchiveEligibleMedicalRecordResult;
import com.benhsoan.port.dto.result.ArchivedMedicalRecordResult;
import com.benhsoan.port.outbound.repository.medicalrecord.ArchiveMedicalRecordQueryRepository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class ArchiveMedicalRecordQueryRepositoryAdapter implements ArchiveMedicalRecordQueryRepository {

    private final JpaArchiveMedicalRecordRepository jpaRepository;

    @Override
    public Page<ArchiveEligibleMedicalRecordResult> findEligibleForArchive(
            Instant completedBefore,
            Pageable pageable
    ) {
        return jpaRepository.findEligibleForArchive(completedBefore, pageable)
                .map(this::toEligibleResult);
    }

    @Override
    public List<UUID> findAllEligibleMedicalRecordIds(Instant completedBefore) {
        return jpaRepository.findAllEligibleMedicalRecordIds(completedBefore);
    }

    private static final java.time.ZoneId CLINIC_ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    @Override
    public Page<ArchivedMedicalRecordResult> searchArchivedRecords(
            String keyword,
            LocalDate fromDate,
            LocalDate toDate,
            UUID doctorId,
            Pageable pageable
    ) {
        Instant fromInstant = fromDate != null ? fromDate.atStartOfDay(CLINIC_ZONE).toInstant() : null;
        Instant toInstant = toDate != null ? toDate.plusDays(1).atStartOfDay(CLINIC_ZONE).toInstant() : null;
        String trimmedKeyword = keyword != null ? keyword.trim() : null;

        return jpaRepository.searchArchivedRecords(trimmedKeyword, fromInstant, toInstant, doctorId, pageable)
                .map(this::toArchivedResult);
    }

    private ArchiveEligibleMedicalRecordResult toEligibleResult(ArchiveEligibleMedicalRecordProjection p) {
        return ArchiveEligibleMedicalRecordResult.builder()
                .medicalRecordId(p.medicalRecordId())
                .visitId(p.visitId())
                .visitCode(p.visitCode())
                .patientId(p.patientId())
                .patientCode(p.patientCode())
                .patientFullName(p.patientFullName())
                .doctorId(p.doctorId())
                .doctorFullName(p.doctorFullName())
                .specialtyName(p.specialtyName())
                .status(p.status() != null ? p.status().name() : null)
                .completedAt(p.completedAt())
                .signedAt(p.signedAt())
                .build();
    }

    private ArchivedMedicalRecordResult toArchivedResult(ArchivedMedicalRecordProjection p) {
        return ArchivedMedicalRecordResult.builder()
                .medicalRecordId(p.medicalRecordId())
                .visitId(p.visitId())
                .visitCode(p.visitCode())
                .patientId(p.patientId())
                .patientCode(p.patientCode())
                .patientFullName(p.patientFullName())
                .patientPhone(p.patientPhone())
                .doctorId(p.doctorId())
                .doctorFullName(p.doctorFullName())
                .conclusion(p.conclusion())
                .revisitDate(p.revisitDate())
                .status(p.status() != null ? p.status().name() : null)
                .completedAt(p.completedAt())
                .signedAt(p.signedAt())
                .archivedAt(p.archivedAt())
                .archivedBy(p.archivedBy())
                .build();
    }
}
