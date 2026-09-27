package com.benhsoan.persistence.adapterRepository.dashboard;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Repository;

import com.benhsoan.persistence.jpaRepository.dashboard.DoctorDashboardAppointmentProjection;
import com.benhsoan.persistence.jpaRepository.dashboard.DoctorDashboardClinicalResultProjection;
import com.benhsoan.persistence.jpaRepository.dashboard.DoctorDashboardPendingRecordProjection;
import com.benhsoan.persistence.jpaRepository.dashboard.JpaDoctorDashboardRepository;
import com.benhsoan.port.dto.result.DoctorDashboardResult;
import com.benhsoan.port.outbound.repository.dashboard.DoctorDashboardQueryRepository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class DoctorDashboardQueryRepositoryAdapter implements DoctorDashboardQueryRepository {

    private final JpaDoctorDashboardRepository jpaRepository;

    @Override
    public List<DoctorDashboardResult.AppointmentItem> findAppointments(UUID doctorId, Instant fromTime, Instant toTime) {
        return jpaRepository.findAppointmentsForDoctorBetween(doctorId, fromTime, toTime)
                .stream()
                .map(this::toAppointmentItem)
                .toList();
    }

    @Override
    public List<DoctorDashboardResult.PendingMedicalRecordItem> findPendingMedicalRecords(
            UUID doctorId,
            int signingDeadlineHours,
            Instant now
    ) {
        return jpaRepository.findPendingMedicalRecordsForDoctor(doctorId)
                .stream()
                .map(p -> toPendingRecordItem(p, signingDeadlineHours, now))
                .sorted(Comparator.comparing(DoctorDashboardResult.PendingMedicalRecordItem::isOverdue).reversed()
                        .thenComparing(DoctorDashboardResult.PendingMedicalRecordItem::visitCompletedAt,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    @Override
    public List<DoctorDashboardResult.ClinicalResultItem> findNewClinicalResults(UUID doctorId, Instant since) {
        return jpaRepository.findNewClinicalResultsForDoctor(doctorId, since)
                .stream()
                .map(this::toClinicalResultItem)
                .toList();
    }

    private DoctorDashboardResult.AppointmentItem toAppointmentItem(DoctorDashboardAppointmentProjection p) {
        return new DoctorDashboardResult.AppointmentItem(
                p.appointmentId(),
                p.appointmentCode(),
                p.patientId(),
                p.patientCode(),
                p.patientFullName(),
                p.patientPhone(),
                p.startTime(),
                p.endTime(),
                p.status(),
                p.reason()
        );
    }

    private DoctorDashboardResult.PendingMedicalRecordItem toPendingRecordItem(
            DoctorDashboardPendingRecordProjection p,
            int signingDeadlineHours,
            Instant now
    ) {
        Instant deadlineAt = null;
        boolean isOverdue = false;
        long overdueHours = 0;

        if (p.visitCompletedAt() != null) {
            deadlineAt = p.visitCompletedAt().plus(Duration.ofHours(signingDeadlineHours));
            if (now.isAfter(deadlineAt)) {
                isOverdue = true;
                overdueHours = Math.max(0, Duration.between(deadlineAt, now).toHours());
            }
        }
        long reminderCount = p.reminderCount() != null ? p.reminderCount() : 0L;

        return new DoctorDashboardResult.PendingMedicalRecordItem(
                p.medicalRecordId(),
                p.visitId(),
                p.visitCode(),
                p.patientId(),
                p.patientCode(),
                p.patientFullName(),
                p.status(),
                p.visitCompletedAt(),
                deadlineAt,
                isOverdue,
                overdueHours,
                reminderCount
        );
    }

    private DoctorDashboardResult.ClinicalResultItem toClinicalResultItem(DoctorDashboardClinicalResultProjection p) {
        return new DoctorDashboardResult.ClinicalResultItem(
                p.clinicalResultId(),
                p.clinicalOrderItemId(),
                p.serviceCode(),
                p.serviceName(),
                p.visitId(),
                p.visitCode(),
                p.patientId(),
                p.patientCode(),
                p.patientFullName(),
                p.resultType(),
                p.numericValue(),
                p.textValue(),
                p.unit(),
                p.referenceRange(),
                p.abnormalFlag(),
                p.conclusion(),
                p.status(),
                p.enteredAt()
        );
    }
}
