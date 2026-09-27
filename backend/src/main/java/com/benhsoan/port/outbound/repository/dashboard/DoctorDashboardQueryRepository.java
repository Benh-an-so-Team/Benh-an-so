package com.benhsoan.port.outbound.repository.dashboard;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.benhsoan.port.dto.result.DoctorDashboardResult;

public interface DoctorDashboardQueryRepository {

    List<DoctorDashboardResult.AppointmentItem> findAppointments(UUID doctorId, Instant fromTime, Instant toTime);

    List<DoctorDashboardResult.PendingMedicalRecordItem> findPendingMedicalRecords(
            UUID doctorId,
            int signingDeadlineHours,
            Instant now
    );

    List<DoctorDashboardResult.ClinicalResultItem> findNewClinicalResults(UUID doctorId, Instant since);
}
