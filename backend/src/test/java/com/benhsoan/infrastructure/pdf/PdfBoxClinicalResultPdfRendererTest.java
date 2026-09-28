package com.benhsoan.infrastructure.pdf;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.benhsoan.port.dto.result.portal.ClinicalResultPrintDocument;
import com.benhsoan.port.dto.result.portal.ClinicalResultPrintDocument.ClinicalResultPrintItem;

class PdfBoxClinicalResultPdfRendererTest {

    @Test
    @DisplayName("Renders valid PDF document with basic clinical result items")
    void rendersValidPdfDocument() throws Exception {
        PdfBoxClinicalResultPdfRenderer renderer = new PdfBoxClinicalResultPdfRenderer();

        List<ClinicalResultPrintItem> items = List.of(
                new ClinicalResultPrintItem(1, "XN-MAU-01", "Tổng phân tích tế bào máu ngoại vi", "NUMBER", "14.2", "g/dL", "12.0 - 16.5", "NORMAL", "Bình thường"),
                new ClinicalResultPrintItem(2, "XN-GLU-01", "Glucose máu", "NUMBER", "7.5", "mmol/L", "3.9 - 6.4", "HIGH", "Tăng nhẹ")
        );

        ClinicalResultPrintDocument document = new ClinicalResultPrintDocument(
                "Phòng khám Đa khoa Hoàn Mỹ",
                "123 Nguyễn Huệ, Q.1, TP.HCM",
                "02838445566",
                "BN-20260921-0001",
                "Nguyễn Văn Bệnh Nhân",
                "15/05/1990",
                "Nam",
                "0901234567",
                "KB-20260921-0012",
                Instant.parse("2026-09-21T08:00:00Z"),
                "BS. Trần Văn Bác Sĩ",
                "Khoa Khám bệnh",
                "CD-20260921-0005",
                "Kiểm tra sức khỏe định kỳ",
                items,
                "Các chỉ số cơ bản ổn định, theo dõi đường huyết",
                Instant.parse("2026-09-21T09:30:00Z")
        );

        byte[] pdfBytes = renderer.render(document);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);

        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            assertTrue(doc.getNumberOfPages() >= 1);
        }
    }

    @Test
    @DisplayName("Paginates cleanly across multiple pages when items are large")
    void paginatesAcrossMultiplePages() throws Exception {
        PdfBoxClinicalResultPdfRenderer renderer = new PdfBoxClinicalResultPdfRenderer();

        List<ClinicalResultPrintItem> items = new ArrayList<>();
        for (int i = 1; i <= 60; i++) {
            items.add(new ClinicalResultPrintItem(
                    i,
                    "XN-" + i,
                    "Xét nghiệm chỉ số sinh hóa số " + i,
                    "NUMBER",
                    String.valueOf(10 + i),
                    "mg/dL",
                    "10 - 50",
                    "NORMAL",
                    "Bình thường"
            ));
        }

        ClinicalResultPrintDocument document = new ClinicalResultPrintDocument(
                "Phòng khám Đa khoa",
                "Hà Nội",
                "0241234567",
                "BN-001",
                "Lê Văn Thử Nghiệm",
                "01/01/1985",
                "Nam",
                "0987654321",
                "KB-001",
                Instant.now(),
                "BS. Nguyễn",
                "Khoa Nội",
                "CD-001",
                "Khám nhiều chỉ số",
                items,
                "Đánh giá tổng quát",
                Instant.now()
        );

        byte[] pdfBytes = renderer.render(document);

        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            assertTrue(doc.getNumberOfPages() > 1);
        }
    }

    @Test
    @DisplayName("Renders with custom template properties, logo and fieldVisibility")
    void rendersWithTemplateCustomizationAndFieldVisibility() throws Exception {
        PdfBoxClinicalResultPdfRenderer renderer = new PdfBoxClinicalResultPdfRenderer();
        String base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

        List<ClinicalResultPrintItem> items = List.of(
                new ClinicalResultPrintItem(1, "XN-01", "Glucose máu", "NUMBER", "5.2", "mmol/L", "3.9 - 6.4", "NORMAL", "Bình thường")
        );

        ClinicalResultPrintDocument document = new ClinicalResultPrintDocument(
                "Phòng khám Đa khoa Tiêu chuẩn có tên dài để kiểm tra độ rộng cột thông tin phòng khám",
                "123 Đường Sức Khỏe, Quận Trung Tâm",
                "02838999999",
                "BN-2026-0001",
                "Nguyễn Văn Người Bệnh",
                "15/06/1990",
                "NAM",
                "0912345678",
                "KB-20260925-001",
                Instant.parse("2026-09-25T08:00:00Z"),
                "BS. Trần Văn Bác Sĩ",
                "Khoa Xét Nghiệm",
                "XN-20260925-001",
                "Kiểm tra định kỳ tổng quát",
                items,
                "Các chỉ số cơ bản ổn định.",
                Instant.parse("2026-09-25T08:30:00Z"),
                "PHIẾU KẾT QUẢ XÉT NGHIỆM ĐIỆN TỬ",
                base64Png,
                "GPKD: 99999/SYT - MST: 0100000000",
                "Lưu ý: Kết quả có giá trị trong vòng 30 ngày kể từ ngày xét nghiệm.",
                true,
                "{\"showPatientCode\":true,\"showPhone\":false,\"showDoctor\":true,\"showClinicalReason\":false}"
        );

        byte[] pdfBytes = renderer.render(document);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            assertTrue(doc.getNumberOfPages() == 1);
        }
    }
}
