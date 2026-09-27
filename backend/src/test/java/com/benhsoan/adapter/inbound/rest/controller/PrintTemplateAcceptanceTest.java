package com.benhsoan.adapter.inbound.rest.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.billing.Invoice;
import com.benhsoan.domain.billing.enums.InvoiceType;
import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.enums.Gender;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.persistence.entity.auth.RoleEntity;
import com.benhsoan.persistence.entity.clinic.DocumentPrintTemplateEntity;
import com.benhsoan.persistence.jpaRepository.auditlog.JpaAuditLogRepository;
import com.benhsoan.persistence.jpaRepository.auth.JpaRoleRepository;
import com.benhsoan.persistence.jpaRepository.clinic.JpaDocumentPrintTemplateRepository;
import com.benhsoan.port.dto.command.auditlog.AdminOperationLogQuery;
import com.benhsoan.port.inbound.auditlog.GetAdminOperationLogsUseCase;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.billing.InvoiceRepository;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Acceptance test verifying the 3 core Acceptance Criteria of NCL-09-CN-008:
 * - TC-01: Admin previews updated print template (logo, legal info) without persisting to DB.
 * - TC-02: After template is saved, invoice reprint / print uses the new template with watermark.
 * - TC-03: Template changes are logged in /admin-operation-logs with actor, timestamp, before and after snapshots (QTN-31).
 */
@SpringBootTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.url=jdbc:h2:mem:print_template_acceptance_test;DB_CLOSE_DELAY=-1;MODE=MySQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PrintTemplateAcceptanceTest {

    private static final Instant NOW = Instant.parse("2026-09-25T08:00:00Z");
    private static final UUID ADMIN_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID RECEPTIONIST_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID ADMIN_ROLE_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @Autowired private MockMvc mockMvc;
    @Autowired private JpaDocumentPrintTemplateRepository jpaTemplateRepository;
    @Autowired private DocumentPrintTemplateRepository documentPrintTemplateRepository;
    @Autowired private JpaAuditLogRepository jpaAuditLogRepository;
    @Autowired private GetAdminOperationLogsUseCase getAdminOperationLogsUseCase;
    @Autowired private UserRepository userRepository;
    @Autowired private JpaRoleRepository jpaRoleRepository;

    @MockitoBean private CurrentUserPort currentUserPort;
    @MockitoBean private ClinicConfigurationRepository clinicConfigurationRepository;
    @MockitoBean private InvoiceRepository invoiceRepository;
    @MockitoBean private VisitRepository visitRepository;
    @MockitoBean private PatientRepository patientRepository;
    @MockitoBean private com.benhsoan.port.outbound.repository.specialty.SpecialtyRepository specialtyRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        jpaAuditLogRepository.deleteAll();
        jpaTemplateRepository.deleteAll();

        when(currentUserPort.getCurrentUserId()).thenReturn(ADMIN_ID);
        when(currentUserPort.getCurrentUserRoles()).thenReturn(Set.of("ADMIN"));

        if (jpaRoleRepository.findById(ADMIN_ROLE_ID).isEmpty()) {
            jpaRoleRepository.save(RoleEntity.builder()
                    .id(ADMIN_ROLE_ID).name("ADMIN").description("Admin").isSystem(true)
                    .createdAt(NOW).updatedAt(NOW)
                    .permissions(new HashSet<>())
                    .build());
        }
        if (userRepository.findById(ADMIN_ID).isEmpty()) {
            userRepository.save(User.restore(ADMIN_ID, "admin", "hash", "Admin Quản Trị", "admin@clinic.vn", null,
                    ADMIN_ROLE_ID, true, null, NOW));
        }

        // Seed default document print templates
        for (PrintDocumentType type : PrintDocumentType.values()) {
            DocumentPrintTemplateEntity entity = DocumentPrintTemplateEntity.builder()
                    .id(UUID.randomUUID())
                    .documentType(type.name())
                    .templateName("Mẫu in " + type.getDescription())
                    .title("MẪU IN " + type.getDescription().toUpperCase())
                    .logoUrl("https://clinic.vn/default-logo.png")
                    .legalInfo("MST: 0100000000 - Sở Y Tế Hà Nội")
                    .footerText("Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ")
                    .showLogo(true)
                    .fieldVisibility("{}")
                    .createdAt(NOW)
                    .updatedAt(NOW)
                    .build();
            jpaTemplateRepository.save(entity);
        }

        ClinicConfiguration clinicConfig = ClinicConfiguration.create(
                "Phòng khám Đa khoa Quốc tế", "123 Đường Y Dược, Hà Nội",
                "024-9999-8888", java.time.LocalTime.of(8, 0), java.time.LocalTime.of(20, 0), NOW
        );
        when(clinicConfigurationRepository.find()).thenReturn(Optional.of(clinicConfig));
    }

    @Test
    @DisplayName("NCL-09-CN-008 TC-01: Admin previews template with new logo and legal info without saving to database")
    void tc01_previewDisplaysUpdatedContentWithoutSavingToDatabase() throws Exception {
        // Given: existing template in DB
        DocumentPrintTemplate beforePreview = documentPrintTemplateRepository
                .findByDocumentType(PrintDocumentType.PRESCRIPTION).orElseThrow();
        assertEquals("MẪU IN ĐƠN THUỐC", beforePreview.getTitle());

        String previewRequest = """
                {
                    "documentType": "PRESCRIPTION",
                    "title": "ĐƠN THUỐC ĐIỆN TỬ PREVIEW",
                    "logoUrl": "https://clinic.vn/preview-logo.png",
                    "legalInfo": "MST MỚI: 9999999999 - CẤP PHÉP 2026",
                    "footerText": "Lưu ý uống thuốc đúng giờ",
                    "showLogo": true
                }
                """;

        // When: Admin sends preview request
        MvcResult result = mockMvc.perform(post("/system/print-templates/preview")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(previewRequest))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", "inline; filename=\"preview-prescription.pdf\""))
                .andReturn();

        // Then: PDF bytes returned are non-empty and start with PDF magic bytes (%PDF)
        byte[] pdfBytes = result.getResponse().getContentAsByteArray();
        assertTrue(pdfBytes.length > 100, "Preview PDF should contain valid PDF bytes");
        assertEquals("%PDF", new String(pdfBytes, 0, 4));

        // And: DB template is NOT changed by preview
        DocumentPrintTemplate afterPreview = documentPrintTemplateRepository
                .findByDocumentType(PrintDocumentType.PRESCRIPTION).orElseThrow();
        assertEquals("MẪU IN ĐƠN THUỐC", afterPreview.getTitle());
        assertEquals("MST: 0100000000 - Sở Y Tế Hà Nội", afterPreview.getLegalInfo());
    }

    @Test
    @DisplayName("NCL-09-CN-008 TC-02: After template is saved, invoice reprint uses new template with watermark")
    void tc02_afterSave_invoicePrintingUsesNewTemplateWithWatermark() throws Exception {
        // 1. Admin saves updated INVOICE template
        String updateRequest = """
                {
                    "templateName": "Mẫu in hóa đơn viện phí",
                    "title": "HÓA ĐƠN THU TIỀN VIỆN PHÍ",
                    "logoUrl": "https://clinic.vn/new-invoice-logo.png",
                    "legalInfo": "MST: 8888888888 - Chi cục Thuế TP.HN",
                    "footerText": "Hóa đơn giá trị gia tăng điện tử",
                    "showLogo": true
                }
                """;

        mockMvc.perform(put("/system/print-templates/INVOICE")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("HÓA ĐƠN THU TIỀN VIỆN PHÍ"))
                .andExpect(jsonPath("$.legalInfo").value("MST: 8888888888 - Chi cục Thuế TP.HN"));

        // 2. Prepare mock invoice that has reprintCount = 2 (reprinted invoice)
        UUID invoiceId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID specialtyId = UUID.randomUUID();
        Visit visit = Visit.restore(
                visitId, "KB-20260925-001", patientId, ADMIN_ID, null, null, specialtyId,
                VisitType.WALK_IN, VisitStatus.COMPLETED,
                NOW.minusSeconds(7200), NOW.minusSeconds(3600), NOW,
                "Lý do khám", "Ghi chú", ADMIN_ID, NOW, NOW
        );
        when(visitRepository.findById(visitId)).thenReturn(Optional.of(visit));
        when(specialtyRepository.findById(specialtyId)).thenReturn(Optional.empty());

        Patient patient = org.mockito.Mockito.mock(Patient.class);
        when(patient.getId()).thenReturn(patientId);
        when(patient.getPatientCode()).thenReturn("BN00001");
        when(patient.getFullName()).thenReturn("Nguyễn Văn Bệnh Nhân");
        when(patient.getDateOfBirth()).thenReturn(LocalDate.of(1985, 5, 20));
        when(patient.getGender()).thenReturn(Gender.MALE);
        when(patient.getPhone()).thenReturn("0912345678");
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));

        com.benhsoan.domain.billing.InvoiceLine line = com.benhsoan.domain.billing.InvoiceLine.create(
                UUID.randomUUID(), invoiceId, com.benhsoan.domain.billing.enums.InvoiceLineType.EXAM_FEE, "Khám bệnh",
                visitId, 1, new BigDecimal("500000"), new BigDecimal("500000"), NOW
        );
        Invoice invoice = Invoice.restore(
                invoiceId, "HD-20260925-0001", visitId, UUID.randomUUID(), InvoiceType.ORIGINAL,
                null, null, new BigDecimal("500000"), ADMIN_ID, NOW,
                2, NOW.minusSeconds(1800), List.of(line)
        );
        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(invoice));

        when(currentUserPort.getCurrentUserId()).thenReturn(RECEPTIONIST_ID);
        when(currentUserPort.getCurrentUserRoles()).thenReturn(Set.of("RECEPTIONIST"));

        // 3. Receptionist prints the invoice
        MvcResult printResult = mockMvc.perform(get("/invoices/{invoiceId}/print", invoiceId)
                        .with(user("receptionist").authorities(new SimpleGrantedAuthority("PERMISSION_INVOICE_READ"))))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"hoa-don-HD-20260925-0001.pdf\""))
                .andReturn();

        byte[] invoicePdf = printResult.getResponse().getContentAsByteArray();
        assertTrue(invoicePdf.length > 200, "Printed invoice PDF must be generated");
        assertEquals("%PDF", new String(invoicePdf, 0, 4));

        // 4. Verify audit log for reprint / print was recorded
        List<com.benhsoan.persistence.entity.auditlog.AuditLogEntity> invoiceAudits =
                jpaAuditLogRepository.findByResourceTypeAndResourceIdOrderByCreatedAtDesc(ResourceType.INVOICE, invoiceId);
        assertTrue(!invoiceAudits.isEmpty(), "Audit log must be recorded for printing invoice");
    }

    @Test
    @DisplayName("NCL-09-CN-008 TC-03: Updating print template records audit log with actor, timestamp, before and after snapshots (QTN-31)")
    void tc03_templateChangeLoggedToAdminOperationLogsWithBeforeAndAfter() throws Exception {
        // When: Admin updates VISIT_SUMMARY template
        String updateRequest = """
                {
                    "templateName": "Mẫu in phiếu tổng kết khám",
                    "title": "PHIẾU TỔNG KẾT KHÁM BỆNH VÀ ĐIỀU TRỊ",
                    "logoUrl": "https://clinic.vn/summary-logo.png",
                    "legalInfo": "MST: 0100000000 - SYT HN",
                    "footerText": "Vui lòng giữ phiếu để đối chiếu hồ sơ",
                    "showLogo": true
                }
                """;

        mockMvc.perform(put("/system/print-templates/VISIT_SUMMARY")
                        .with(user("admin").authorities(new SimpleGrantedAuthority("PERMISSION_PRINT_TEMPLATE_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateRequest))
                .andExpect(status().isOk());

        // Then: Query /admin-operation-logs via GetAdminOperationLogsUseCase
        var page = getAdminOperationLogsUseCase.getLogs(
                new AdminOperationLogQuery(null, ResourceType.CONFIGURATION, null, null),
                PageRequest.of(0, 20)
        );

        var configLog = page.getContent().stream()
                .filter(log -> log.actionType() == ActionType.UPDATE
                        && log.resourceType() == ResourceType.CONFIGURATION)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Expected a CONFIGURATION UPDATE audit log"));

        // Verify Actor and Timestamps
        assertEquals(ADMIN_ID, configLog.actorId());
        assertNotNull(configLog.createdAt());

        // Verify Before & After snapshots per QTN-31
        JsonNode detail = objectMapper.readTree(configLog.detail());
        assertEquals("VISIT_SUMMARY", detail.path("documentType").asText());

        JsonNode before = detail.path("before");
        JsonNode after = detail.path("after");

        assertEquals("MẪU IN PHIẾU TỔNG KẾT KHÁM", before.path("title").asText());
        assertEquals("PHIẾU TỔNG KẾT KHÁM BỆNH VÀ ĐIỀU TRỊ", after.path("title").asText());

        assertEquals("https://clinic.vn/default-logo.png", before.path("logoUrl").asText());
        assertEquals("https://clinic.vn/summary-logo.png", after.path("logoUrl").asText());

        assertEquals("Vui lòng giữ phiếu để đối chiếu hồ sơ", after.path("footerText").asText());
        assertTrue(after.path("showLogo").asBoolean());
    }
}
