package com.benhsoan.persistence.jpaRepository.dashboard;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import com.benhsoan.persistence.entity.visit.VisitEntity;

public interface JpaDoctorDashboardRepository extends Repository<VisitEntity, UUID> {

    @Query("""
            SELECT new com.benhsoan.persistence.jpaRepository.dashboard.DoctorDashboardAppointmentProjection(
                a.id, a.appointmentCode, p.id, p.patientCode, p.fullName, p.phone,
                a.startTime, a.endTime, a.status, a.reason
            )
            FROM AppointmentEntity a
            JOIN PatientEntity p ON a.patientId = p.id
            WHERE a.doctorId = :doctorId
              AND a.startTime >= :fromTime
              AND a.startTime < :toTime
            ORDER BY a.startTime ASC
            """)
    List<DoctorDashboardAppointmentProjection> findAppointmentsForDoctorBetween(
            @Param("doctorId") UUID doctorId,
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime
    );

    @Query("""
            SELECT new com.benhsoan.persistence.jpaRepository.dashboard.DoctorDashboardPendingRecordProjection(
                mr.id, mr.status, v.id, v.visitCode, v.completedAt, p.id, p.patientCode, p.fullName,
                (SELECT COUNT(r.id) FROM MedicalRecordSigningReminderEntity r WHERE r.medicalRecordId = mr.id)
            )
            FROM MedicalRecordEntity mr
            JOIN VisitEntity v ON mr.visitId = v.id
            JOIN PatientEntity p ON v.patientId = p.id
            WHERE v.doctorId = :doctorId
              AND v.status != com.benhsoan.domain.visit.enums.VisitStatus.CANCELLED
              AND mr.status IN (com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.DRAFT, com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus.OPEN)
            ORDER BY v.completedAt ASC, mr.id ASC
            """)
    List<DoctorDashboardPendingRecordProjection> findPendingMedicalRecordsForDoctor(
            @Param("doctorId") UUID doctorId
    );

    @Query("""
            SELECT new com.benhsoan.persistence.jpaRepository.dashboard.DoctorDashboardClinicalResultProjection(
                cr.id, cr.clinicalOrderItemId, coi.serviceCode, coi.serviceName,
                v.id, v.visitCode, p.id, p.patientCode, p.fullName,
                cr.resultType, cr.numericValue, cr.textValue, cr.unit, cr.referenceRange,
                cr.abnormalFlag, cr.conclusion, cr.status, COALESCE(cr.updatedAt, cr.enteredAt)
            )
            FROM ClinicalResultEntity cr
            JOIN ClinicalOrderItemEntity coi ON cr.clinicalOrderItemId = coi.id
            JOIN VisitEntity v ON cr.visitId = v.id
            JOIN PatientEntity p ON v.patientId = p.id
            WHERE (v.doctorId = :doctorId OR EXISTS (
                SELECT 1 FROM ClinicalOrderEntity co WHERE co.id = coi.clinicalOrderId AND co.orderedBy = :doctorId
            ))
              AND cr.status IN (com.benhsoan.domain.clinical.enums.ClinicalResultStatus.FINAL, com.benhsoan.domain.clinical.enums.ClinicalResultStatus.CORRECTED)
              AND COALESCE(cr.updatedAt, cr.enteredAt) >= :since
            ORDER BY COALESCE(cr.updatedAt, cr.enteredAt) DESC
            """)
    List<DoctorDashboardClinicalResultProjection> findNewClinicalResultsForDoctor(
            @Param("doctorId") UUID doctorId,
            @Param("since") Instant since
    );
}
