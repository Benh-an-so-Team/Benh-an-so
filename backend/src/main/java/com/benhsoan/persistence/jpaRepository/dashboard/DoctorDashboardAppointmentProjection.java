package com.benhsoan.persistence.jpaRepository.dashboard;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.appointment.enums.AppointmentStatus;

public record DoctorDashboardAppointmentProjection(
        UUID appointmentId,
        String appointmentCode,
        UUID patientId,
        String patientCode,
        String patientFullName,
        String patientPhone,
        Instant startTime,
        Instant endTime,
        AppointmentStatus status,
        String reason
) {
}
