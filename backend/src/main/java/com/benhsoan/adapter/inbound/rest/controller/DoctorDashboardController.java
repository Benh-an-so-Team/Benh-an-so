package com.benhsoan.adapter.inbound.rest.controller;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.benhsoan.adapter.inbound.rest.mapper.DoctorDashboardRestMapper;
import com.benhsoan.adapter.inbound.rest.response.dashboard.DoctorDashboardResponse;
import com.benhsoan.infrastructure.security.annotation.RequirePermission;
import com.benhsoan.port.dto.query.dashboard.GetDoctorDashboardQuery;
import com.benhsoan.port.dto.result.DoctorDashboardResult;
import com.benhsoan.port.inbound.dashboard.GetDoctorDashboardUseCase;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@Validated
public class DoctorDashboardController {

    private final GetDoctorDashboardUseCase getDoctorDashboardUseCase;
    private final DoctorDashboardRestMapper mapper;

    @GetMapping("/doctor")
    @RequirePermission("DASHBOARD_DOCTOR_READ")
    public DoctorDashboardResponse getDoctorDashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) UUID doctorId
    ) {
        DoctorDashboardResult result = getDoctorDashboardUseCase.getDashboard(
                new GetDoctorDashboardQuery(date, doctorId)
        );
        return mapper.toResponse(result);
    }
}
