package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
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

@WebMvcTest(controllers = DocumentPrintTemplateController.class)
@Import({
        DocumentPrintTemplateRestMapper.class,
        GlobalExceptionHandler.class,
        SecurityConfig.class,
        JwtAuthenticationFilter.class
})
class DocumentPrintTemplateControllerTest {

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

    private DocumentPrintTemplateResult sampleResult(PrintDocumentType type) {
        return new DocumentPrintTemplateResult(
                UUID.randomUUID(),
                type,
                "Mẫu in " + type.getDescription(),
                "MẪU IN " + type.getDescription().toUpperCase(),
                "https://example.com/logo.png",
                "GPKD: 123456789 - SYT",
                "Vui lòng mang theo đơn khi tái khám",
                true,
                "{}",
                Instant.parse("2026-09-25T01:00:00Z"),
                Instant.parse("2026-09-25T01:00:00Z")
        );
    }

    @Test
    @DisplayName("GET /system/print-templates returns 200 and list of templates")
    void getAllTemplates() throws Exception {
        when(getDocumentPrintTemplatesUseCase.getAll()).thenReturn(List.of(
                sampleResult(PrintDocumentType.PRESCRIPTION),
                sampleResult(PrintDocumentType.INVOICE)
        ));

        mockMvc.perform(get("/system/print-templates")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_READ"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].documentType").value("PRESCRIPTION"))
                .andExpect(jsonPath("$[0].title").value("MẪU IN ĐƠN THUỐC"))
                .andExpect(jsonPath("$[1].documentType").value("INVOICE"));
    }

    @Test
    @DisplayName("GET /system/print-templates/{documentType} returns 200 for valid type")
    void getByTypeValid() throws Exception {
        when(getDocumentPrintTemplatesUseCase.getByDocumentType(PrintDocumentType.PRESCRIPTION))
                .thenReturn(sampleResult(PrintDocumentType.PRESCRIPTION));

        mockMvc.perform(get("/system/print-templates/PRESCRIPTION")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_READ"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentType").value("PRESCRIPTION"))
                .andExpect(jsonPath("$.title").value("MẪU IN ĐƠN THUỐC"));
    }

    @Test
    @DisplayName("GET /system/print-templates/{documentType} returns 400 for invalid type")
    void getByTypeInvalid() throws Exception {
        mockMvc.perform(get("/system/print-templates/UNKNOWN_TYPE")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_READ"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /system/print-templates/{documentType} updates and returns 200")
    void updateTemplateSuccess() throws Exception {
        when(updateDocumentPrintTemplateUseCase.update(any()))
                .thenReturn(sampleResult(PrintDocumentType.INVOICE));

        String requestJson = """
                {
                    "templateName": "Mẫu in hóa đơn",
                    "title": "HÓA ĐƠN KHÁM BỆNH VÀ DỊCH VỤ",
                    "logoUrl": "https://example.com/new-logo.png",
                    "legalInfo": "MST: 0102030405",
                    "footerText": "Cảm ơn quý khách",
                    "showLogo": true
                }
                """;

        mockMvc.perform(put("/system/print-templates/INVOICE")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentType").value("INVOICE"));
    }

    @Test
    @DisplayName("PUT /system/print-templates/{documentType} returns 400 on empty title")
    void updateTemplateValidationFailure() throws Exception {
        String requestJson = """
                {
                    "templateName": "Mẫu in hóa đơn",
                    "title": "",
                    "showLogo": true
                }
                """;

        mockMvc.perform(put("/system/print-templates/INVOICE")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /system/print-templates/preview returns PDF bytes")
    void previewTemplateSuccess() throws Exception {
        byte[] mockPdf = "%PDF-1.7 preview content".getBytes();
        when(previewDocumentPrintTemplateUseCase.preview(any())).thenReturn(mockPdf);

        String requestJson = """
                {
                    "documentType": "PRESCRIPTION",
                    "title": "ĐƠN THUỐC MẪU PREVIEW",
                    "logoUrl": "https://example.com/logo.png",
                    "legalInfo": "GPKD: 123",
                    "footerText": "Footer preview",
                    "showLogo": true
                }
                """;

        mockMvc.perform(post("/system/print-templates/preview")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", "inline; filename=\"preview-prescription.pdf\""))
                .andExpect(content().bytes(mockPdf));
    }
}
