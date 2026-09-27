package com.benhsoan.application.ucservice.clinic;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.infrastructure.pdf.PdfBoxInvoicePdfRenderer;
import com.benhsoan.infrastructure.pdf.PdfBoxPrescriptionPdfRenderer;
import com.benhsoan.infrastructure.pdf.PdfBoxVisitSummaryPdfRenderer;
import com.benhsoan.port.dto.command.clinic.PreviewDocumentPrintTemplateCommand;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.time.ClockPort;

class PreviewDocumentPrintTemplateServiceTest {

    private final ClinicConfigurationRepository clinicConfigurationRepository = mock(
            ClinicConfigurationRepository.class);
    private final ClockPort clockPort = mock(ClockPort.class);
    private final PdfBoxPrescriptionPdfRenderer prescriptionPdfRenderer = new PdfBoxPrescriptionPdfRenderer();
    private final PdfBoxVisitSummaryPdfRenderer visitSummaryPdfRenderer = new PdfBoxVisitSummaryPdfRenderer();
    private final PdfBoxInvoicePdfRenderer invoicePdfRenderer = new PdfBoxInvoicePdfRenderer();

    private PreviewDocumentPrintTemplateService service;

    @BeforeEach
    void setUp() {
        System.setProperty("java.awt.headless", "true");
        when(clockPort.now()).thenReturn(Instant.parse("2026-09-25T08:00:00Z"));
        when(clinicConfigurationRepository.find()).thenReturn(Optional.empty());

        service = new PreviewDocumentPrintTemplateService(
                clinicConfigurationRepository,
                prescriptionPdfRenderer,
                visitSummaryPdfRenderer,
                invoicePdfRenderer,
                clockPort);
    }

    @Test
    void previewPrescription_returnsValidPdfBytes() {
        PreviewDocumentPrintTemplateCommand command = new PreviewDocumentPrintTemplateCommand(
                PrintDocumentType.PRESCRIPTION,
                "Mẫu đơn thuốc mới",
                "ĐƠN THUỐC ĐIỆN TỬ",
                null,
                "Giấy phép hoạt động số 12345/SYT",
                "Chân trang mẫu: Uống thuốc đúng giờ",
                true,
                "{}");

        byte[] pdf = service.preview(command);

        assertNotNull(pdf);
        assertTrue(pdf.length > 0);
        String header = new String(pdf, 0, Math.min(pdf.length, 5));
        assertTrue(header.startsWith("%PDF"));
    }

    @Test
    void previewInvoice_returnsValidPdfBytes() {
        PreviewDocumentPrintTemplateCommand command = new PreviewDocumentPrintTemplateCommand(
                PrintDocumentType.INVOICE,
                "Mẫu hóa đơn mới",
                "PHIẾU THU TIỀN DỊCH VỤ",
                null,
                "Mã số thuế: 999999999",
                "Chân trang mẫu: Xin cảm ơn quý khách",
                true,
                "{}");

        byte[] pdf = service.preview(command);

        assertNotNull(pdf);
        assertTrue(pdf.length > 0);
        String header = new String(pdf, 0, Math.min(pdf.length, 5));
        assertTrue(header.startsWith("%PDF"));
    }

    @Test
    void previewVisitSummary_returnsValidPdfBytes() {
        PreviewDocumentPrintTemplateCommand command = new PreviewDocumentPrintTemplateCommand(
                PrintDocumentType.VISIT_SUMMARY,
                "Mẫu phiếu tóm tắt mới",
                "TỔNG KẾT BỆNH ÁN NGOẠI TRÚ",
                null,
                "Phòng khám Đa khoa Tiêu chuẩn",
                "Hẹn tái khám đúng lịch",
                true,
                "{}");

        byte[] pdf = service.preview(command);

        assertNotNull(pdf);
        assertTrue(pdf.length > 0);
        String header = new String(pdf, 0, Math.min(pdf.length, 5));
        assertTrue(header.startsWith("%PDF"));
    }

    @Test
    void previewClinicalResult_returnsValidPdfBytes() {
        PreviewDocumentPrintTemplateCommand command = new PreviewDocumentPrintTemplateCommand(
                PrintDocumentType.CLINICAL_RESULT,
                "Mẫu phiếu kết quả CLS",
                "PHIẾU KẾT QUẢ XÉT NGHIỆM",
                null,
                "Phòng khám Đa khoa Tiêu chuẩn",
                "Kết quả có giá trị trong vòng 30 ngày",
                true,
                "{\"showClinicalReason\":true,\"showReferenceRange\":true}");

        byte[] pdf = service.preview(command);

        assertNotNull(pdf);
        assertTrue(pdf.length > 0);
        String header = new String(pdf, 0, Math.min(pdf.length, 5));
        assertTrue(header.startsWith("%PDF"));
    }
}
