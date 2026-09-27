package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.ControlledMedicineRegisterRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.inbound.controlledmedicine.SearchControlledMedicineRegisterUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = ControlledMedicineRegisterController.class)
@Import({ ControlledMedicineRegisterRestMapper.class, AnonymizationModeState.class, SecurityConfig.class,
        JwtAuthenticationFilter.class,
        GlobalExceptionHandler.class, RequirePermissionAspect.class, PermissionEvaluator.class,
        ControlledMedicineRegisterSecurityIntegrationTest.AspectTestConfig.class })
class ControlledMedicineRegisterSecurityIntegrationTest {

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {
    }

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SearchControlledMedicineRegisterUseCase searchUseCase;

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
    void managerWithPermissionCanViewRegister() throws Exception {
        when(searchUseCase.search(any())).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/controlled-medicines/register")
                .with(user("manager")
                        .authorities(new SimpleGrantedAuthority("PERMISSION_CONTROLLED_MEDICINE_REGISTER_READ"))))
                .andExpect(status().isOk());
    }

    @Test
    void pharmacistWithPermissionCanViewRegister() throws Exception {
        when(searchUseCase.search(any())).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/controlled-medicines/register")
                .with(user("pharmacist")
                        .authorities(new SimpleGrantedAuthority("PERMISSION_CONTROLLED_MEDICINE_REGISTER_READ"))))
                .andExpect(status().isOk());
    }

    @Test
    void doctorWithoutPermissionIsForbidden() throws Exception {
        mockMvc.perform(get("/controlled-medicines/register")
                .with(user("doctor").authorities(new SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void receptionistWithoutPermissionIsForbidden() throws Exception {
        mockMvc.perform(get("/controlled-medicines/register")
                .with(user("receptionist").authorities(new SimpleGrantedAuthority("PERMISSION_PATIENT_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedRequestIsUnauthorized() throws Exception {
        mockMvc.perform(get("/controlled-medicines/register"))
                .andExpect(status().isUnauthorized());
    }
}
