package com.benhsoan.domain.clinic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.shared.exception.ValidationException;

class DocumentPrintTemplateTest {

    private static final Instant NOW = Instant.parse("2026-09-25T08:00:00Z");

    @Test
    void createDocumentPrintTemplate_withValidData_succeeds() {
        DocumentPrintTemplate template = DocumentPrintTemplate.create(
                PrintDocumentType.PRESCRIPTION,
                "Mẫu đơn thuốc chuẩn",
                "ĐƠN THUỐC",
                "http://clinic.com/logo.png",
                "Giấy phép: 123/SYT",
                "Tái khám mang theo đơn",
                true,
                "{\"showDiagnosis\":true}",
                NOW
        );

        assertNotNull(template.getId());
        assertEquals(PrintDocumentType.PRESCRIPTION, template.getDocumentType());
        assertEquals("Mẫu đơn thuốc chuẩn", template.getTemplateName());
        assertEquals("ĐƠN THUỐC", template.getTitle());
        assertEquals("http://clinic.com/logo.png", template.getLogoUrl());
        assertEquals("Giấy phép: 123/SYT", template.getLegalInfo());
        assertEquals("Tái khám mang theo đơn", template.getFooterText());
        assertTrue(template.isShowLogo());
        assertEquals(NOW, template.getCreatedAt());
        assertEquals(NOW, template.getUpdatedAt());
    }

    @Test
    void updateDocumentPrintTemplate_withValidData_updatesFieldsAndTimestamp() {
        DocumentPrintTemplate template = DocumentPrintTemplate.create(
                PrintDocumentType.INVOICE,
                "Mẫu cũ",
                "HÓA ĐƠN",
                null,
                null,
                null,
                false,
                null,
                NOW
        );

        Instant updatedTime = NOW.plusSeconds(3600);
        template.update(
                "Mẫu mới",
                "HÓA ĐƠN THU TIỀN",
                "https://cdn.clinic.com/logo.png",
                "MST: 0102030405",
                "Cảm ơn quý khách",
                true,
                "{\"showPaymentMethod\":true}",
                updatedTime
        );

        assertEquals("Mẫu mới", template.getTemplateName());
        assertEquals("HÓA ĐƠN THU TIỀN", template.getTitle());
        assertEquals("https://cdn.clinic.com/logo.png", template.getLogoUrl());
        assertEquals("MST: 0102030405", template.getLegalInfo());
        assertEquals("Cảm ơn quý khách", template.getFooterText());
        assertTrue(template.isShowLogo());
        assertEquals("{\"showPaymentMethod\":true}", template.getFieldVisibility());
        assertEquals(updatedTime, template.getUpdatedAt());
    }

    @Test
    void createDocumentPrintTemplate_whenTemplateNameIsBlank_throwsValidationException() {
        assertThrows(ValidationException.class, () -> DocumentPrintTemplate.create(
                PrintDocumentType.VISIT_SUMMARY,
                "  ",
                "PHIẾU TÓM TẮT",
                null,
                null,
                null,
                true,
                null,
                NOW
        ));
    }

    @Test
    void createDocumentPrintTemplate_whenTitleIsBlank_throwsValidationException() {
        assertThrows(ValidationException.class, () -> DocumentPrintTemplate.create(
                PrintDocumentType.VISIT_SUMMARY,
                "Mẫu phiếu tóm tắt",
                "",
                null,
                null,
                null,
                true,
                null,
                NOW
        ));
    }

    @Test
    void reconstitute_createsExactState() {
        UUID id = UUID.randomUUID();
        DocumentPrintTemplate template = DocumentPrintTemplate.reconstitute(
                id,
                PrintDocumentType.CLINICAL_RESULT,
                "Mẫu KQ",
                "PHIẾU KẾT QUẢ",
                "logo",
                "legal",
                "footer",
                true,
                "{}",
                NOW,
                NOW
        );

        assertEquals(id, template.getId());
        assertEquals(PrintDocumentType.CLINICAL_RESULT, template.getDocumentType());
    }
}
