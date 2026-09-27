package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Collections;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.DoctorDashboardRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.DoctorDashboardResult;
import com.benhsoan.port.inbound.dashboard.GetDoctorDashboardUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = DoctorDashboardController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class,
        RequirePermissionAspect.class, PermissionEvaluator.class, DoctorDashboardSecurityIntegrationTest.AspectTestConfig.class,
        DoctorDashboardRestMapper.class})
@DisplayName("DoctorDashboardSecurityIntegrationTest - QTN-01 Phân quyền truy cập theo vai trò")
class DoctorDashboardSecurityIntegrationTest {

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig { }

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GetDoctorDashboardUseCase getDoctorDashboardUseCase;

    @MockitoBean
    private AnonymizationModeState anonymizationModeState;

    @MockitoBean
    private JwtTokenPort jwtTokenPort;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private UserSessionRepository userSessionRepository;

    @MockitoBean
    private ClockPort clockPort;

    @MockitoBean
    private RoleRepository roleRepository;

    @MockitoBean
    private AuditLogRepository auditLogRepository;

    @MockitoBean
    private CurrentUserPort currentUserPort;

    @Test
    @DisplayName("QTN-01: Bác sĩ hoặc Admin có quyền DASHBOARD_DOCTOR_READ truy cập thành công (200 OK)")
    void doctorAndAdminCanReadDoctorDashboard() throws Exception {
        when(getDoctorDashboardUseCase.getDashboard(any()))
                .thenReturn(new DoctorDashboardResult(
                        new DoctorDashboardResult.Summary(0, 0, 0, 0, 0, 0, 0),
                        Collections.emptyList(),
                        Collections.emptyList(),
                        Collections.emptyList(),
                        Collections.emptyList(),
                        Instant.parse("2026-09-25T08:00:00Z")
                ));

        // Bác sĩ có quyền DASHBOARD_DOCTOR_READ
        mockMvc.perform(get("/dashboard/doctor")
                        .with(user("doctor").authorities(new SimpleGrantedAuthority("PERMISSION_DASHBOARD_DOCTOR_READ"))))
                .andExpect(status().isOk());

        // Admin có quyền DASHBOARD_DOCTOR_READ
        mockMvc.perform(get("/dashboard/doctor")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_DASHBOARD_DOCTOR_READ"))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("QTN-01: Lễ tân hoặc Dược sĩ không có quyền DASHBOARD_DOCTOR_READ bị từ chối 403 Forbidden và ghi nhật ký kiểm toán")
    void nonDoctorRolesAreForbiddenAndAudited() throws Exception {
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        // Lễ tân
        mockMvc.perform(get("/dashboard/doctor")
                        .with(user("receptionist").authorities(new SimpleGrantedAuthority("PERMISSION_CARE_LOG_READ"))))
                .andExpect(status().isForbidden());

        // Dược sĩ
        mockMvc.perform(get("/dashboard/doctor")
                        .with(user("pharmacist").authorities(new SimpleGrantedAuthority("PERMISSION_PHARMACY_READ"))))
                .andExpect(status().isForbidden());

        // Verify audit log được ghi lại khi bị từ chối
        verify(auditLogRepository, org.mockito.Mockito.atLeastOnce()).save(any(AuditLog.class));
    }
}
