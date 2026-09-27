package com.benhsoan.port.dto.query.dashboard;

import java.time.LocalDate;
import java.util.UUID;

public record GetDoctorDashboardQuery(
        LocalDate date,
        UUID doctorId
) {
    public GetDoctorDashboardQuery(LocalDate date) {
        this(date, null);
    }
}
