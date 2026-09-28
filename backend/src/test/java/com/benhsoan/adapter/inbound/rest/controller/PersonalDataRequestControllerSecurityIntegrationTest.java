package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.PersonalDataRequestRestMapper;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.inbound.personaldata.CompletePersonalDataRequestUseCase;
import com.benhsoan.port.inbound.personaldata.GetPersonalDataRequestUseCase;
import com.benhsoan.port.inbound.personaldata.RecordPersonalDataRequestUseCase;
import com.benhsoan.port.inbound.personaldata.SearchPersonalDataRequestsUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = PersonalDataRequestController.class)
@Import({
        AopAutoConfiguration.class,
        PersonalDataRequestControllerSecurityIntegrationTest.AspectTestConfig.class,
        PersonalDataRequestRestMapper.class,
        GlobalExceptionHandler.class,
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        RequirePermissionAspect.class,
        PermissionEvaluator.class
})
@DisplayName("PersonalDataRequestController Security Integration Tests (NCL-15-CN-006)")
class PersonalDataRequestControllerSecurityIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-09-26T08:00:00Z");

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {
    }

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private RecordPersonalDataRequestUseCase recordUseCase;
    @MockitoBean private CompletePersonalDataRequestUseCase completeUseCase;
    @MockitoBean private GetPersonalDataRequestUseCase getUseCase;
    @MockitoBean private SearchPersonalDataRequestsUseCase searchUseCase;
    @MockitoBean private PatientRepository patientRepository;
    @MockitoBean private CurrentUserPort currentUserPort;
    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private RoleRepository roleRepository;
    @MockitoBean private AuditLogRepository auditLogRepository;
    @MockitoBean private ClockPort clockPort;

    @Test
    @DisplayName("POST /personal-data-requests: 201 Created khi có quyền PERSONAL_DATA_REQUEST_UPDATE")
    void record_returns201WhenAuthorized() throws Exception {
        UUID requestId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        when(recordUseCase.record(any())).thenReturn(result(requestId, patientId));

        mockMvc.perform(post("/personal-data-requests")
                        .with(user("admin").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PERSONAL_DATA_REQUEST_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"patientId":"%s","requestType":"MEDICAL_RECORD_COPY","dueAt":"%s"}
                                """.formatted(patientId, NOW.plusSeconds(86400))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(requestId.toString()))
                .andExpect(jsonPath("$.status").value("RECEIVED"));
    }

    @Test
    @DisplayName("POST /personal-data-requests: 403 Forbidden khi thiếu quyền")
    void record_returns403WithoutPermission() throws Exception {
        UUID patientId = UUID.randomUUID();

        mockMvc.perform(post("/personal-data-requests")
                        .with(user("user_no_perm").authorities(new SimpleGrantedAuthority("PATIENT_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"patientId":"%s","requestType":"MEDICAL_RECORD_COPY","dueAt":"%s"}
                                """.formatted(patientId, NOW.plusSeconds(86400))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /personal-data-requests/{id}: 200 OK khi có quyền READ, 403 khi thiếu")
    void getById_enforcesReadPermission() throws Exception {
        UUID requestId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        when(getUseCase.getById(requestId)).thenReturn(result(requestId, patientId));

        mockMvc.perform(get("/personal-data-requests/{id}", requestId)
                        .with(user("admin").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PERSONAL_DATA_REQUEST_READ"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(requestId.toString()));

        mockMvc.perform(get("/personal-data-requests/{id}", requestId)
                        .with(user("user_no_perm").authorities(new SimpleGrantedAuthority("PATIENT_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PATCH /personal-data-requests/{id}/complete: 200 OK khi có quyền UPDATE")
    void complete_returns200WhenAuthorized() throws Exception {
        UUID requestId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        PersonalDataRequestResult completed = new PersonalDataRequestResult(
                requestId, patientId, "MEDICAL_RECORD_COPY", PersonalDataRequestStatus.COMPLETED,
                null, NOW, NOW.plusSeconds(86400), "Đã xử lý", NOW, UUID.randomUUID(), NOW, NOW, false);
        when(completeUseCase.complete(eq(requestId), any())).thenReturn(completed);

        mockMvc.perform(patch("/personal-data-requests/{id}/complete", requestId)
                        .with(user("admin").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PERSONAL_DATA_REQUEST_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"result\":\"Đã cấp bản sao\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.result").value("Đã xử lý"));
    }

    private PersonalDataRequestResult result(UUID id, UUID patientId) {
        return new PersonalDataRequestResult(
                id, patientId, "MEDICAL_RECORD_COPY", PersonalDataRequestStatus.RECEIVED,
                null, NOW, NOW.plusSeconds(86400), null, null, null, NOW, null, false);
    }
}

