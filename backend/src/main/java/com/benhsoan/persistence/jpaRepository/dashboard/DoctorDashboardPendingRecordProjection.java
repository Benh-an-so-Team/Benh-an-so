package com.benhsoan.persistence.jpaRepository.dashboard;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus;

public record DoctorDashboardPendingRecordProjection(
        UUID medicalRecordId,
        MedicalRecordStatus status,
        UUID visitId,
        String visitCode,
        Instant visitCompletedAt,
        UUID patientId,
        String patientCode,
        String patientFullName,
        Long reminderCount
) {
}
