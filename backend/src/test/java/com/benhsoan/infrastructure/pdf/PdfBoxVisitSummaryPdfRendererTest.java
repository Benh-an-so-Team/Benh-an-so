package com.benhsoan.infrastructure.pdf;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;

import com.benhsoan.port.dto.result.VisitSummaryPrintDocument;

class PdfBoxVisitSummaryPdfRendererTest {

    @Test
    void rendersVisitSummaryToValidPdf() throws Exception {
        VisitSummaryPrintDocument document = new VisitSummaryPrintDocument(
                "Phòng khám Đa khoa Hoàn Mỹ",
                "123 Hoàng Văn Thụ, Tân Bình, TP.HCM",
                "02838445566",
                "BN-2026-0001",
                "Nguyễn Văn A",
                "1990-05-15",
                "MALE",
                "0901234567",
                "KB-20260820-0001",
                Instant.parse("2026-08-20T08:30:00Z"),
                "BS. Trần Văn B",
                List.of(
                        new VisitSummaryPrintDocument.Diagnosis("J00", "Viêm mũi họng cấp (cảm thường)", true),
                        new VisitSummaryPrintDocument.Diagnosis("R05", "Ho kéo dài", false)
                ),
                List.of(
                        new VisitSummaryPrintDocument.ClinicalOrder("ORD-01", "XQ01", "Chụp X-quang phổi thẳng", "Tư thế đứng thẳng", "COMPLETED"),
                        new VisitSummaryPrintDocument.ClinicalOrder("ORD-02", "XN01", "Tổng phân tích tế bào máu", "Lấy máu lúc sáng", "PENDING")
                ),
                "Nghỉ ngơi tại nhà 3 ngày, uống nhiều nước ấm, tránh dùng đồ lạnh.",
                "Uống thuốc theo đơn chỉ định trong 5 ngày.",
                LocalDate.of(2026, 8, 27),
                "BS. Trần Văn B",
                Instant.parse("2026-08-20T09:15:00Z"),
                "Lễ tân Lê Thị C",
                Instant.parse("2026-08-20T09:30:00Z")
        );

        PdfBoxVisitSummaryPdfRenderer renderer = new PdfBoxVisitSummaryPdfRenderer();
        byte[] pdf = renderer.render(document);

        assertThat(pdf).isNotNull();
        assertThat(pdf).startsWith("%PDF".getBytes(StandardCharsets.US_ASCII));

        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThanOrEqualTo(1);
        }

        // Verify content formatting: Vietnam timezone (08:30Z -> 15:30 VN), serviceCode, and Vietnamese status
        List<String> lines = renderer.buildLines(document, renderer.createFontMetrics());
        assertThat(lines).anyMatch(l -> l.contains("15:30")); // 08:30Z + 7h = 15:30
        assertThat(lines).anyMatch(l -> l.contains("(Mã: XQ01)"));
        assertThat(lines).anyMatch(l -> l.contains("[Đã có kết quả]"));
        assertThat(lines).anyMatch(l -> l.contains("[Chờ thực hiện]"));
    }

    @Test
    void rendersVisitSummary_withoutOrdersAndRevisitDate() throws Exception {
        VisitSummaryPrintDocument document = new VisitSummaryPrintDocument(
                "Phòng khám A",
                "Hà Nội",
                "0900000000",
                "BN-002",
                "Trần Thị B",
                "1995-10-20",
                "FEMALE",
                "0987654321",
                "KB-002",
                Instant.parse("2026-08-20T08:30:00Z"),
                "BS. C",
                List.of(),
                List.of(),
                null,
                null,
                null,
                "BS. C",
                Instant.parse("2026-08-20T09:00:00Z"),
                "BS. C",
                Instant.parse("2026-08-20T09:05:00Z")
        );

        byte[] pdf = new PdfBoxVisitSummaryPdfRenderer().render(document);

        assertThat(pdf).isNotNull();
        assertThat(pdf).startsWith("%PDF".getBytes(StandardCharsets.US_ASCII));
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isEqualTo(1);
        }
    }

    @Test
    void rendersVisitSummary_withComplexVietnameseDiacritics_inHeadlessMode() throws Exception {
        System.setProperty("java.awt.headless", "true");

        VisitSummaryPrintDocument document = new VisitSummaryPrintDocument(
                "Phòng khám Đa khoa Quốc tế Hoàn Mỹ Sài Gòn",
                "Số 123 Đường Hoàng Văn Thụ, Phường 8, Quận Phú Nhuận, Thành phố Hồ Chí Minh",
                "02838445566",
                "BN-2026-9999",
                "Nguyễn Trần Khánh Đan",
                "1985-12-30",
                "FEMALE",
                "0909888777",
                "KB-20260820-9999",
                Instant.parse("2026-08-20T08:30:00Z"),
                "BS.CKII. Vũ Hoàng Điệp",
                List.of(
                        new VisitSummaryPrintDocument.Diagnosis("J00", "Viêm mũi họng cấp tính (cảm cúm thông thường)", true),
                        new VisitSummaryPrintDocument.Diagnosis("K29.0", "Viêm dạ dày xuất huyết cấp do dùng thuốc chống viêm", false)
                ),
                List.of(
                        new VisitSummaryPrintDocument.ClinicalOrder("ORD-99", "NS01", "Nội soi thực quản - dạ dày - tá tràng có gây mê", "Nhịn ăn uống trước 6 tiếng", "COMPLETED")
                ),
                "Nghỉ ngơi tĩnh dưỡng, uống thuốc theo toa, tái khám ngay nếu có dấu hiệu nôn ra máu hoặc đau quặn bụng.",
                "Điều trị nội khoa kết hợp theo dõi chức năng tiêu hóa.",
                LocalDate.of(2026, 9, 5),
                "BS.CKII. Vũ Hoàng Điệp",
                Instant.parse("2026-08-20T09:15:00Z"),
                "Lễ tân Nguyễn Hoàng Yến",
                Instant.parse("2026-08-20T09:30:00Z")
        );

        PdfBoxVisitSummaryPdfRenderer renderer = new PdfBoxVisitSummaryPdfRenderer();
        byte[] pdf = renderer.render(document);

        assertThat(pdf).isNotNull();
        assertThat(pdf.length).isGreaterThan(1000);
        assertThat(pdf.length).isLessThan(1_500_000);

        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThanOrEqualTo(1);
        }

        List<String> lines = renderer.buildLines(document, renderer.createFontMetrics());
        assertThat(lines).anyMatch(l -> l.contains("PHIẾU TÓM TẮT LƯỢT KHÁM"));
        assertThat(lines).anyMatch(l -> l.contains("3. CHẨN ĐOÁN"));
        assertThat(lines).anyMatch(l -> l.contains("Viêm mũi họng cấp tính"));
    }

    @Test
    void rendersWithLogoAndFieldVisibility() throws Exception {
        String base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        VisitSummaryPrintDocument document = new VisitSummaryPrintDocument(
                "Phòng khám Đa khoa Tiêu chuẩn có tên rất dài để kiểm tra độ rộng wrap header",
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
                List.of(
                        new VisitSummaryPrintDocument.Diagnosis("J02", "Viêm họng cấp", true)
                ),
                List.of(
                        new VisitSummaryPrintDocument.ClinicalOrder("CLS-001", "XN-MAU", "Tổng phân tích tế bào máu", "Lấy máu buổi sáng", "COMPLETED")
                ),
                "Uống thuốc đầy đủ theo đơn, nghỉ ngơi hợp lý.",
                "Điều trị nội khoa ngoại trú.",
                LocalDate.of(2026, 10, 2),
                "BS. Trần Văn Bác Sĩ",
                Instant.parse("2026-09-25T08:30:00Z"),
                "BS. Trần Văn Bác Sĩ",
                Instant.parse("2026-09-25T08:35:00Z"),
                "PHIẾU TỔNG KẾT KHÁM BỆNH VÀ ĐIỀU TRỊ",
                base64Png,
                "GPKD: 99999/SYT",
                "Lưu ý giữ phiếu khi tái khám",
                true,
                "{\"showPatientCode\":false,\"showInstructions\":false}"
        );

        PdfBoxVisitSummaryPdfRenderer renderer = new PdfBoxVisitSummaryPdfRenderer();
        byte[] pdf = renderer.render(document);

        assertThat(pdf).isNotNull();
        assertThat(pdf).startsWith("%PDF".getBytes(StandardCharsets.US_ASCII));
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isEqualTo(1);
        }
    }
}
