package com.benhsoan.port.inbound.dashboard;

import com.benhsoan.port.dto.query.dashboard.GetDoctorDashboardQuery;
import com.benhsoan.port.dto.result.DoctorDashboardResult;

public interface GetDoctorDashboardUseCase {

    DoctorDashboardResult getDashboard(GetDoctorDashboardQuery query);
}
