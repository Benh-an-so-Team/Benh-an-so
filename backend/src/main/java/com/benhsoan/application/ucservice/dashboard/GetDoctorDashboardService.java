package com.benhsoan.application.ucservice.dashboard;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.appointment.enums.AppointmentStatus;
import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.domain.clinical.enums.ClinicalResultAbnormalFlag;
import com.benhsoan.domain.queue.enums.QueueItemStatus;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.query.dashboard.GetDoctorDashboardQuery;
import com.benhsoan.port.dto.result.DoctorDashboardResult;
import com.benhsoan.port.dto.result.QueueItemResult;
import com.benhsoan.port.inbound.dashboard.GetDoctorDashboardUseCase;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.dashboard.DoctorDashboardQueryRepository;
import com.benhsoan.port.outbound.repository.queue.QueueItemQueryRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetDoctorDashboardService implements GetDoctorDashboardUseCase {

    private final DoctorDashboardQueryRepository doctorDashboardQueryRepository;
    private final QueueItemQueryRepository queueItemQueryRepository;
    private final ClinicConfigurationRepository clinicConfigurationRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;

    @Override
    public DoctorDashboardResult getDashboard(GetDoctorDashboardQuery query) {
        ensureAuthorized();

        UUID targetDoctorId = resolveTargetDoctorId(query);
        if (targetDoctorId == null) {
            throw new ValidationException("Doctor ID is required.");
        }

        Instant now = clockPort.now();
        LocalDate date = (query != null && query.date() != null)
                ? query.date()
                : LocalDate.ofInstant(now, ZoneOffset.UTC);

        Instant startOfDay = date.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant startOfNextDay = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        int signingDeadlineHours = clinicConfigurationRepository.find()
                .map(ClinicConfiguration::getSigningDeadlineHours)
                .orElse(ClinicConfiguration.DEFAULT_SIGNING_DEADLINE_HOURS);

        // 1. Today's Appointments
        List<DoctorDashboardResult.AppointmentItem> appointments = doctorDashboardQueryRepository
                .findAppointments(targetDoctorId, startOfDay, startOfNextDay);

        // 2. Queue for the day
        List<QueueItemResult> queueResults = queueItemQueryRepository
                .findQueueBoard(date, targetDoctorId, null);

        List<DoctorDashboardResult.QueueItem> queue = queueResults.stream()
                .map(this::toQueueItem)
                .toList();

        // 3. Pending-signature Medical Records
        List<DoctorDashboardResult.PendingMedicalRecordItem> pendingMedicalRecords = doctorDashboardQueryRepository
                .findPendingMedicalRecords(targetDoctorId, signingDeadlineHours, now);

        // 4. Newly available Clinical Results (entered or updated on target date)
        List<DoctorDashboardResult.ClinicalResultItem> newClinicalResults = doctorDashboardQueryRepository
                .findNewClinicalResults(targetDoctorId, startOfDay);

        // 5. Aggregate Summary Metrics
        DoctorDashboardResult.Summary summary = calculateSummary(
                appointments,
                queue,
                pendingMedicalRecords,
                newClinicalResults
        );

        return new DoctorDashboardResult(
                summary,
                appointments,
                queue,
                pendingMedicalRecords,
                newClinicalResults,
                now
        );
    }

    private void ensureAuthorized() {
        if (!currentUserPort.hasRole("DOCTOR") && !currentUserPort.hasRole("ADMIN")) {
            throw new AccessDeniedException("Chỉ bác sĩ hoặc quản trị viên mới có thể xem bảng điều khiển của bác sĩ.");
        }
    }

    private UUID resolveTargetDoctorId(GetDoctorDashboardQuery query) {
        // Enforce AC-02: DOCTOR can only view their own dashboard, even if requesting another doctor's ID
        if (currentUserPort.hasRole("DOCTOR") && !currentUserPort.hasRole("ADMIN")) {
            return currentUserPort.getCurrentUserId();
        }

        if (query != null && query.doctorId() != null) {
            return query.doctorId();
        }

        return currentUserPort.getCurrentUserId();
    }

    private DoctorDashboardResult.QueueItem toQueueItem(QueueItemResult q) {
        return new DoctorDashboardResult.QueueItem(
                q.id(),
                q.medicalQueueId(),
                q.queueNumber(),
                q.patientId(),
                q.patientCode(),
                q.patientName(),
                q.roomId(),
                q.roomNumber(),
                q.visitId(),
                q.visitCode(),
                q.status(),
                q.priority(),
                q.checkedInAt(),
                q.calledAt()
        );
    }

    private DoctorDashboardResult.Summary calculateSummary(
            List<DoctorDashboardResult.AppointmentItem> appointments,
            List<DoctorDashboardResult.QueueItem> queue,
            List<DoctorDashboardResult.PendingMedicalRecordItem> pendingMedicalRecords,
            List<DoctorDashboardResult.ClinicalResultItem> newClinicalResults
    ) {
        int todayAppointmentsCount = (int) appointments.stream()
                .filter(a -> a.status() != AppointmentStatus.CANCELLED)
                .count();

        int waitingQueueCount = (int) queue.stream()
                .filter(q -> q.status() == QueueItemStatus.WAITING)
                .count();

        int inProgressQueueCount = (int) queue.stream()
                .filter(q -> q.status() == QueueItemStatus.IN_PROGRESS || q.status() == QueueItemStatus.WAITING_FOR_RESULT)
                .count();

        int pendingSignaturesCount = pendingMedicalRecords.size();

        int overdueSignaturesCount = (int) pendingMedicalRecords.stream()
                .filter(DoctorDashboardResult.PendingMedicalRecordItem::isOverdue)
                .count();

        int newClinicalResultsCount = newClinicalResults.size();

        int abnormalClinicalResultsCount = (int) newClinicalResults.stream()
                .filter(r -> r.abnormalFlag() == ClinicalResultAbnormalFlag.ABNORMAL
                        || r.abnormalFlag() == ClinicalResultAbnormalFlag.LOW
                        || r.abnormalFlag() == ClinicalResultAbnormalFlag.HIGH)
                .count();

        return new DoctorDashboardResult.Summary(
                todayAppointmentsCount,
                waitingQueueCount,
                inProgressQueueCount,
                pendingSignaturesCount,
                overdueSignaturesCount,
                newClinicalResultsCount,
                abnormalClinicalResultsCount
        );
    }
}
