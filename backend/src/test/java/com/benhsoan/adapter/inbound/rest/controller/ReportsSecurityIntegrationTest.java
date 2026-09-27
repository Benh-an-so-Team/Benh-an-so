package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.ReportingRestMapper;
import com.benhsoan.application.ucservice.auditlog.AdminOperationAuditService;
import com.benhsoan.application.ucservice.auth.LoginService;
import com.benhsoan.application.ucservice.auth.RefreshTokenService;
import com.benhsoan.application.ucservice.auth.TwoFactorAuthenticationService;
import com.benhsoan.application.ucservice.role.RolePermissionsResultMapper;
import com.benhsoan.application.ucservice.role.UpdateRolePermissionsService;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.domain.reporting.enums.ReportType;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.DoctorVisitsReportResult;
import com.benhsoan.port.dto.result.OperationalSummaryResult;
import com.benhsoan.port.dto.result.DiseasePatternReportResult;
import com.benhsoan.port.dto.result.AppointmentEffectivenessReportResult;
import com.benhsoan.port.dto.result.OperationalReportExportResult;
import com.benhsoan.port.dto.result.RevenueBreakdownReportResult;
import com.benhsoan.port.dto.result.TopMedicinesReportResult;
import com.benhsoan.port.dto.command.auth.LoginCommand;
import com.benhsoan.port.dto.command.auth.RefreshTokenCommand;
import com.benhsoan.port.dto.command.role.UpdateRolePermissionsCommand;
import com.benhsoan.port.inbound.reporting.ExportOperationalReportUseCase;
import com.benhsoan.port.inbound.reporting.GetDiseasePatternReportUseCase;
import com.benhsoan.port.inbound.reporting.GetDoctorVisitsReportUseCase;
import com.benhsoan.port.inbound.reporting.GetAppointmentEffectivenessReportUseCase;
import com.benhsoan.port.inbound.reporting.GetOperationalSummaryUseCase;
import com.benhsoan.port.inbound.reporting.GetRevenueBreakdownReportUseCase;
import com.benhsoan.port.inbound.reporting.GetTopMedicinesReportUseCase;
import com.benhsoan.port.inbound.reporting.GetOperationalTimelineUseCase;
import com.benhsoan.port.inbound.survey.GetSatisfactionReportUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.authSecurity.LoginAttemptPort;
import com.benhsoan.port.outbound.authSecurity.PasswordEncoderPort;
import com.benhsoan.port.outbound.authSecurity.RefreshTokenGeneratorPort;
import com.benhsoan.port.outbound.authSecurity.TokenHashPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.PermissionRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.benhsoan.domain.auth.Permission;
import com.benhsoan.domain.auth.Role;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.auth.UserSession;

@WebMvcTest(controllers = ReportsController.class)
@Import({
        AopAutoConfiguration.class,
        ReportsSecurityIntegrationTest.AspectTestConfig.class,
        ReportingRestMapper.class,
        GlobalExceptionHandler.class,
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        RequirePermissionAspect.class,
        PermissionEvaluator.class
})
class ReportsSecurityIntegrationTest {

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {
    }

    @Autowired private MockMvc mockMvc;

    @MockitoBean private GetOperationalSummaryUseCase getOperationalSummaryUseCase;
    @MockitoBean private GetOperationalTimelineUseCase getOperationalTimelineUseCase;
    @MockitoBean private GetTopMedicinesReportUseCase getTopMedicinesReportUseCase;
    @MockitoBean private GetDoctorVisitsReportUseCase getDoctorVisitsReportUseCase;
    @MockitoBean private GetDiseasePatternReportUseCase getDiseasePatternReportUseCase;
    @MockitoBean private ExportOperationalReportUseCase exportOperationalReportUseCase;
    @MockitoBean private GetRevenueBreakdownReportUseCase getRevenueBreakdownReportUseCase;
    @MockitoBean private GetAppointmentEffectivenessReportUseCase getAppointmentEffectivenessReportUseCase;
    @MockitoBean private GetSatisfactionReportUseCase getSatisfactionReportUseCase;
    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private RoleRepository roleRepository;
    @MockitoBean private PermissionRepository permissionRepository;
    @MockitoBean private AuditLogRepository auditLogRepository;
    @MockitoBean private CurrentUserPort currentUserPort;
    @MockitoBean private ClockPort clockPort;

    @Test
    void forbidsDoctorWithoutReportingPermission() throws Exception {
        mockMvc.perform(get("/reports/summary")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("DOCTOR", "PATIENT_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getOperationalSummaryUseCase);
    }

    @Test
    void allowsAnyRoleWithReportViewSnapshot() throws Exception {
        when(getOperationalSummaryUseCase.getSummary(any(), any())).thenReturn(new OperationalSummaryResult(
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 3), 10L, new BigDecimal("2000000"), "VND"));
        mockMvc.perform(get("/reports/summary")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("DOCTOR", "REPORT_VIEW")))
                .andExpect(status().isOk());
    }

    @Test
    void allowsManagerWithReportViewPermission() throws Exception {
        when(getOperationalSummaryUseCase.getSummary(any(), any())).thenReturn(new OperationalSummaryResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                10L,
                new BigDecimal("2000000"),
                "VND"
        ));

        mockMvc.perform(get("/reports/summary")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("MANAGER", "REPORT_VIEW")))
                .andExpect(status().isOk());
    }

    @Test
    void forbidsAnyRoleWithoutReportExportSnapshot() throws Exception {
        mockMvc.perform(get("/reports/export")
                        .param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                .with(permission("ADMIN", "REPORT_VIEW")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(exportOperationalReportUseCase);
    }

    @Test
    void allowsExportRegardlessOfRoleNameWhenSnapshotContainsReportExport() throws Exception {
        when(exportOperationalReportUseCase.export(any(), any(), any())).thenReturn(new OperationalReportExportResult(
                ReportType.OPERATIONAL_REPORT, "operational-report.csv", "text/csv", "report".getBytes(StandardCharsets.UTF_8)));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("DOCTOR", "REPORT_EXPORT")))
                .andExpect(status().isOk());
    }

    @Test
    void allowsManagerToReadTopMedicinesReport() throws Exception {
        when(getTopMedicinesReportUseCase.getTopMedicines(any(), any())).thenReturn(new TopMedicinesReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                Instant.parse("2026-08-03T08:00:00Z"),
                List.of()
        ));

        mockMvc.perform(get("/reports/top-medicines")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("MANAGER", "REPORT_VIEW")))
                .andExpect(status().isOk());
    }

    @Test
    void forbidsAdminFromReadingTopMedicinesReport() throws Exception {
        mockMvc.perform(get("/reports/top-medicines")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("ADMIN", "USER_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getTopMedicinesReportUseCase);
    }

    @Test
    void forbidsDoctorFromReadingTopMedicinesReport() throws Exception {
        mockMvc.perform(get("/reports/top-medicines")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("DOCTOR", "PATIENT_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getTopMedicinesReportUseCase);
    }

    @Test
    void allowsManagerToReadDoctorVisitsReport() throws Exception {
        when(getDoctorVisitsReportUseCase.getDoctorVisits(any(), any())).thenReturn(new DoctorVisitsReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 14),
                Instant.parse("2026-08-14T08:00:00Z"),
                List.of()
        ));

        mockMvc.perform(get("/reports/doctor-visits")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-14")
                        .with(permission("MANAGER", "REPORT_VIEW")))
                .andExpect(status().isOk());
    }

    @Test
    void forbidsAdminFromReadingDoctorVisitsReport() throws Exception {
        mockMvc.perform(get("/reports/doctor-visits")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-14")
                        .with(permission("ADMIN", "USER_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getDoctorVisitsReportUseCase);
    }

    @Test
    void forbidsDoctorFromReadingDoctorVisitsReport() throws Exception {
        mockMvc.perform(get("/reports/doctor-visits")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-14")
                        .with(permission("DOCTOR", "PATIENT_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getDoctorVisitsReportUseCase);
    }

    @Test
    void allowsManagerToReadDiseasePatternsReport() throws Exception {
        when(getDiseasePatternReportUseCase.getDiseasePatternReport(any(), any(), any())).thenReturn(new DiseasePatternReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 31),
                null,
                null,
                0L,
                Instant.parse("2026-08-31T08:00:00Z"),
                List.of()
        ));

        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("MANAGER", "REPORT_VIEW")))
                .andExpect(status().isOk());
    }

    @Test
    void forbidsDoctorFromReadingDiseasePatternsReport() throws Exception {
        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("DOCTOR", "PATIENT_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getDiseasePatternReportUseCase);
    }

    @Test
    void forbidsAdminFromReadingDiseasePatternsReport() throws Exception {
        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("ADMIN", "USER_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getDiseasePatternReportUseCase);
    }

    @Test
    void forbidsReceptionistFromReadingDiseasePatternsReportAndAuditsAccessDenied() throws Exception {
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("RECEPTIONIST", "PATIENT_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getDiseasePatternReportUseCase);
        verify(auditLogRepository).save(any());
    }

    @Test
    void returnsForbiddenWhenDiseasePatternsUseCaseDeniesAccess() throws Exception {
        when(getDiseasePatternReportUseCase.getDiseasePatternReport(any(), any(), any()))
                .thenThrow(new org.springframework.security.access.AccessDeniedException("Only managers can view the disease pattern report."));

        mockMvc.perform(get("/reports/disease-patterns")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("DOCTOR", "REPORT_VIEW")))
                .andExpect(status().isForbidden());
    }

    @Test
    void returnsForbiddenWhenExportDiseasePatternUseCaseDeniesAccess() throws Exception {
        when(exportOperationalReportUseCase.export(any(), any(), any()))
                .thenThrow(new org.springframework.security.access.AccessDeniedException("Only managers can export the disease pattern report."));

        mockMvc.perform(get("/reports/export")
                        .param("reportType", "DISEASE_PATTERN_REPORT")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("DOCTOR", "REPORT_EXPORT")))
                .andExpect(status().isForbidden());
    }

    @Test
    void keepsOldTokenPermissionAndAppliesRevocationAfterRefresh() throws Exception {
        Instant now = Instant.parse("2026-08-19T08:00:00Z");
        UUID doctorRoleId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        Role doctorRole = Role.restore(doctorRoleId, "DOCTOR", "Doctor", true, now, now,
                Set.of(Permission.fromCode("REPORT_VIEW"), Permission.fromCode("REPORT_EXPORT")));
        User doctor = User.restore(doctorId, "doctor", "hash", "Doctor", "doctor@example.com", null,
                doctorRoleId, true, null, now);
        User admin = User.restore(adminId, "admin", "hash", "Admin", "admin@example.com", null,
                UUID.randomUUID(), true, null, now);
        AtomicReference<UserSession> session = new AtomicReference<>();
        Map<String, Set<String>> tokenPermissions = new HashMap<>();
        AtomicInteger tokenNumber = new AtomicInteger();

        PasswordEncoderPort passwordEncoder = mock(PasswordEncoderPort.class);
        TokenHashPort tokenHash = mock(TokenHashPort.class);
        RefreshTokenGeneratorPort refreshTokenGenerator = mock(RefreshTokenGeneratorPort.class);
        LoginAttemptPort loginAttempt = mock(LoginAttemptPort.class);
        when(clockPort.now()).thenReturn(now);
        when(passwordEncoder.matches("password", "hash")).thenReturn(true);
        when(loginAttempt.isBlocked("doctor")).thenReturn(false);
        when(refreshTokenGenerator.generate()).thenReturn("refresh-old", "refresh-new");
        when(tokenHash.hash(any())).thenAnswer(invocation -> "hash-" + invocation.getArgument(0));
        when(userRepository.findByUsername("doctor")).thenReturn(Optional.of(doctor));
        when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(roleRepository.findById(doctorRoleId)).thenReturn(Optional.of(doctorRole));
        when(roleRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(userSessionRepository.save(any())).thenAnswer(invocation -> {
            UserSession saved = invocation.getArgument(0);
            session.set(saved);
            return saved;
        });
        when(userSessionRepository.findById(any())).thenAnswer(invocation -> Optional.ofNullable(session.get()));
        when(userSessionRepository.findByRefreshTokenHash("hash-refresh-old"))
                .thenAnswer(invocation -> Optional.ofNullable(session.get()));
        when(jwtTokenPort.generateToken(any(), any(), any(), any(), any())).thenAnswer(invocation -> {
            String token = tokenNumber.incrementAndGet() == 1 ? "access-old" : "access-new";
            tokenPermissions.put(token, Set.copyOf(invocation.getArgument(4)));
            return token;
        });
        when(jwtTokenPort.getExpiredAt(any())).thenReturn(now.plusSeconds(900));
        when(jwtTokenPort.validate(any())).thenReturn(true);
        when(jwtTokenPort.getUserId(any())).thenReturn(doctorId);
        when(jwtTokenPort.getSessionId(any())).thenAnswer(invocation -> session.get().getId());
        when(jwtTokenPort.getUsername(any())).thenReturn("doctor");
        when(jwtTokenPort.getRole(any())).thenReturn("DOCTOR");
        when(jwtTokenPort.getPermissions(any())).thenAnswer(invocation ->
                tokenPermissions.getOrDefault(invocation.getArgument(0), Set.of()));
        when(currentUserPort.getCurrentUserId()).thenReturn(adminId);

        LoginService loginService = new LoginService(userRepository, roleRepository, userSessionRepository,
                passwordEncoder, jwtTokenPort, tokenHash, refreshTokenGenerator, loginAttempt,
                auditLogRepository, clockPort, mock(TwoFactorAuthenticationService.class));
        String oldAccessToken = loginService.login(new LoginCommand("doctor", "password")).accessToken();
        assertEquals(Set.of("REPORT_VIEW", "REPORT_EXPORT"), tokenPermissions.get(oldAccessToken));
        when(exportOperationalReportUseCase.export(any(), any(), any())).thenReturn(new OperationalReportExportResult(
                ReportType.OPERATIONAL_REPORT, "report.csv", "text/csv", "report".getBytes(StandardCharsets.UTF_8)));

        mockMvc.perform(get("/reports/export").param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2026-08-01").param("to", "2026-08-03")
                        .header("Authorization", "Bearer " + oldAccessToken))
                .andExpect(status().isOk());

        when(permissionRepository.findAllByCodes(Set.of("REPORT_VIEW")))
                .thenReturn(List.of(Permission.fromCode("REPORT_VIEW")));
        new UpdateRolePermissionsService(roleRepository, permissionRepository, userRepository, currentUserPort,
                new AdminOperationAuditService(auditLogRepository), clockPort, new RolePermissionsResultMapper())
                .updateRolePermissions(new UpdateRolePermissionsCommand(doctorRoleId, List.of("REPORT_VIEW")));

        mockMvc.perform(get("/reports/export").param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2026-08-01").param("to", "2026-08-03")
                        .header("Authorization", "Bearer " + oldAccessToken))
                .andExpect(status().isOk());

        String refreshedAccessToken = new RefreshTokenService(userRepository, roleRepository, userSessionRepository,
                jwtTokenPort, tokenHash, refreshTokenGenerator, clockPort)
                .refreshToken(new RefreshTokenCommand("refresh-old")).accessToken();
        assertEquals(Set.of("REPORT_VIEW"), tokenPermissions.get(refreshedAccessToken));

        mockMvc.perform(get("/reports/export").param("reportType", "OPERATIONAL_REPORT")
                        .param("from", "2026-08-01").param("to", "2026-08-03")
                        .header("Authorization", "Bearer " + refreshedAccessToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsManagerWithReportViewToAccessRevenueBreakdown() throws Exception {
        when(getRevenueBreakdownReportUseCase.getRevenueBreakdown(any(), any())).thenReturn(new RevenueBreakdownReportResult(
                LocalDate.of(2026, 8, 1),
                LocalDate.of(2026, 8, 3),
                new BigDecimal("500000"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "VND",
                List.of(),
                List.of()
        ));

        mockMvc.perform(get("/reports/revenue-breakdown")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("MANAGER", "REPORT_VIEW")))
                .andExpect(status().isOk());
    }

    @Test
    void forbidsAdminWithoutReportViewToAccessRevenueBreakdownAndAuditsDeniedAttempt() throws Exception {
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        mockMvc.perform(get("/reports/revenue-breakdown")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("ADMIN", "USER_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getRevenueBreakdownReportUseCase);
        org.mockito.Mockito.verify(auditLogRepository).save(any());
    }

    @Test
    void forbidsReceptionistWithoutReportViewToAccessRevenueBreakdownAndAuditsDeniedAttempt() throws Exception {
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        mockMvc.perform(get("/reports/revenue-breakdown")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-03")
                        .with(permission("RECEPTIONIST", "PATIENT_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getRevenueBreakdownReportUseCase);
        org.mockito.Mockito.verify(auditLogRepository).save(any());
    }

    @Test
    void allowsManagerWithReportViewToAccessAppointmentEffectiveness() throws Exception {
        when(getAppointmentEffectivenessReportUseCase.getReport(any(), any(), any(), any()))
                .thenReturn(new AppointmentEffectivenessReportResult(
                        LocalDate.of(2026, 8, 1),
                        LocalDate.of(2026, 8, 31),
                        Instant.parse("2026-08-31T08:00:00Z"),
                        0,
                        List.of()
                ));

        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("MANAGER", "REPORT_VIEW")))
                .andExpect(status().isOk());
    }

    @Test
    void forbidsPharmacistFromAccessingAppointmentEffectiveness() throws Exception {
        when(currentUserPort.getCurrentUserId()).thenReturn(UUID.randomUUID());

        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("PHARMACIST", "PHARMACY_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getAppointmentEffectivenessReportUseCase);
        org.mockito.Mockito.verify(auditLogRepository).save(any());
    }

    @Test
    void forbidsReceptionistFromAccessingAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("RECEPTIONIST", "PATIENT_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getAppointmentEffectivenessReportUseCase);
    }

    @Test
    void forbidsAdminWithoutReportViewFromAccessingAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31")
                        .with(permission("ADMIN", "USER_READ")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(getAppointmentEffectivenessReportUseCase);
    }

    @Test
    void requiresAuthenticationForAppointmentEffectiveness() throws Exception {
        mockMvc.perform(get("/reports/appointment-effectiveness")
                        .param("from", "2026-08-01")
                        .param("to", "2026-08-31"))
                .andExpect(status().isUnauthorized());
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor permission(String role, String code) {
        return user("user").roles(role).authorities(new SimpleGrantedAuthority("PERMISSION_" + code));
    }
}
