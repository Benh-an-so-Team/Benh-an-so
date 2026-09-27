package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.DocumentPrintTemplateRestMapper;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.clinic.DocumentPrintTemplateResult;
import com.benhsoan.port.inbound.clinic.GetDocumentPrintTemplatesUseCase;
import com.benhsoan.port.inbound.clinic.PreviewDocumentPrintTemplateUseCase;
import com.benhsoan.port.inbound.clinic.UpdateDocumentPrintTemplateUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

/**
 * Security Integration tests for DocumentPrintTemplateController ensuring that
 * PRINT_TEMPLATE_READ and PRINT_TEMPLATE_UPDATE permissions are strictly enforced.
 */
@WebMvcTest(controllers = DocumentPrintTemplateController.class)
@Import({
        DocumentPrintTemplateRestMapper.class,
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        GlobalExceptionHandler.class,
        RequirePermissionAspect.class,
        PermissionEvaluator.class,
        DocumentPrintTemplateSecurityIntegrationTest.AspectTestConfig.class
})
class DocumentPrintTemplateSecurityIntegrationTest {

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {
    }

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private GetDocumentPrintTemplatesUseCase getDocumentPrintTemplatesUseCase;
    @MockitoBean private UpdateDocumentPrintTemplateUseCase updateDocumentPrintTemplateUseCase;
    @MockitoBean private PreviewDocumentPrintTemplateUseCase previewDocumentPrintTemplateUseCase;
    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private RoleRepository roleRepository;
    @MockitoBean private ClockPort clockPort;
    @MockitoBean private AuditLogRepository auditLogRepository;
    @MockitoBean private CurrentUserPort currentUserPort;

    private DocumentPrintTemplateResult sampleResult() {
        return new DocumentPrintTemplateResult(
                UUID.randomUUID(),
                PrintDocumentType.PRESCRIPTION,
                "Mẫu in đơn thuốc",
                "MẪU IN ĐƠN THUỐC",
                "https://example.com/logo.png",
                "GPKD: 123",
                "Footer",
                true,
                "{}",
                Instant.now(),
                Instant.now()
        );
    }

    @Test
    @DisplayName("Unauthenticated request to /system/print-templates returns 401")
    void unauthenticatedReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/system/print-templates"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("User without PRINT_TEMPLATE_READ gets 403 on GET")
    void getTemplatesWithoutPermissionIsForbidden() throws Exception {
        mockMvc.perform(get("/system/print-templates")
                        .with(user("doctor").roles("DOCTOR")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("User with PRINT_TEMPLATE_READ succeeds on GET")
    void getTemplatesWithPermissionSucceeds() throws Exception {
        when(getDocumentPrintTemplatesUseCase.getAll()).thenReturn(List.of(sampleResult()));

        mockMvc.perform(get("/system/print-templates")
                        .with(user("admin").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_READ"))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("User without PRINT_TEMPLATE_UPDATE gets 403 on PUT")
    void updateTemplateWithoutPermissionIsForbidden() throws Exception {
        String requestJson = """
                {
                    "templateName": "Mẫu đơn mới",
                    "title": "Mẫu đơn mới",
                    "showLogo": true
                }
                """;

        mockMvc.perform(put("/system/print-templates/PRESCRIPTION")
                        .with(user("doctor").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("User with PRINT_TEMPLATE_UPDATE succeeds on PUT")
    void updateTemplateWithPermissionSucceeds() throws Exception {
        when(updateDocumentPrintTemplateUseCase.update(any())).thenReturn(sampleResult());

        String requestJson = """
                {
                    "templateName": "Mẫu đơn mới",
                    "title": "Mẫu đơn mới",
                    "showLogo": true
                }
                """;

        mockMvc.perform(put("/system/print-templates/PRESCRIPTION")
                        .with(user("admin").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Preview requires either PRINT_TEMPLATE_READ or PRINT_TEMPLATE_UPDATE")
    void previewPermissionCheck() throws Exception {
        when(previewDocumentPrintTemplateUseCase.preview(any())).thenReturn("%PDF-1.7".getBytes());

        String requestJson = """
                {
                    "documentType": "PRESCRIPTION",
                    "title": "Preview Đơn thuốc",
                    "showLogo": true
                }
                """;

        // Without permissions: 403
        mockMvc.perform(post("/system/print-templates/preview")
                        .with(user("receptionist").roles("RECEPTIONIST"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isForbidden());

        // With PRINT_TEMPLATE_READ: 200
        mockMvc.perform(post("/system/print-templates/preview")
                        .with(user("admin").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk());
    }
}
