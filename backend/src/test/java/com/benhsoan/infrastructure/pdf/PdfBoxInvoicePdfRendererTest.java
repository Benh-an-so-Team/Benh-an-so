package com.benhsoan.infrastructure.pdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.FontMetrics;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument.InvoicePrintLine;

class PdfBoxInvoicePdfRendererTest {

    @Test
    @DisplayName("Renders valid PDF document with basic lines")
    void rendersValidPdfDocument() throws Exception {
        PdfBoxInvoicePdfRenderer renderer = new PdfBoxInvoicePdfRenderer();

        List<InvoicePrintLine> lines = List.of(
                new InvoicePrintLine(1, "Khám chuyên khoa Nội", "SERVICE", 1, new BigDecimal("150000"), new BigDecimal("150000")),
                new InvoicePrintLine(2, "Paracetamol 500mg", "MEDICINE", 20, new BigDecimal("5000"), new BigDecimal("100000"))
        );

        InvoicePrintDocument document = new InvoicePrintDocument(
                "Phòng khám Đa khoa Hoàn Mỹ",
                "123 Nguyễn Huệ, Q.1, TP.HCM",
                "02838445566",
                "HD-20260921-0001",
                "ORIGINAL",
                null,
                null,
                "BN-20260921-0001",
                "Nguyễn Văn Bệnh Nhân",
                "15/05/1990",
                "MALE",
                "0901234567",
                "KB-20260921-0012",
                Instant.parse("2026-09-21T08:00:00Z"),
                "BS. Trần Văn Bác Sĩ",
                "Khoa Nội",
                Instant.parse("2026-09-21T08:30:00Z"),
                "Lễ tân Nguyễn Thị Lễ Tân",
                lines,
                new BigDecimal("250000"),
                Instant.parse("2026-09-21T08:35:00Z")
        );

        byte[] pdfBytes = renderer.render(document);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);
        String header = new String(pdfBytes, 0, Math.min(pdfBytes.length, 5));
        assertTrue(header.startsWith("%PDF"), "PDF bytes should start with %PDF header");

        try (PDDocument loaded = Loader.loadPDF(pdfBytes)) {
            assertEquals(1, loaded.getNumberOfPages());
        }
    }

    @Test
    @DisplayName("F-03: Renders PDF with complex Vietnamese Unicode diacritics in headless mode")
    void rendersInvoicePdf_withComplexVietnameseUnicode_inHeadlessMode() throws Exception {
        System.setProperty("java.awt.headless", "true");
        PdfBoxInvoicePdfRenderer renderer = new PdfBoxInvoicePdfRenderer();

        List<InvoicePrintLine> lines = List.of(
                new InvoicePrintLine(1, "Nội soi thực quản - dạ dày - tá tràng có gây mê (kèm sinh thiết)",
                        "SERVICE", 1, new BigDecimal("1500000"), new BigDecimal("1500000")),
                new InvoicePrintLine(2, "Chụp cắt lớp vi tính lồng ngực không cản quang (CT Scanner)",
                        "SERVICE", 1, new BigDecimal("2000000"), new BigDecimal("2000000")),
                new InvoicePrintLine(3, "Thuốc bột pha hỗn dịch uống Cefixim 100mg (Hộp 10 gói)",
                        "MEDICINE", 2, new BigDecimal("50000"), new BigDecimal("100000"))
        );

        InvoicePrintDocument document = new InvoicePrintDocument(
                "Phòng khám Đa khoa Quốc tế Hoàn Mỹ Sài Gòn",
                "Số 123 Đường Hoàng Văn Thụ, Phường 8, Quận Phú Nhuận, Thành phố Hồ Chí Minh",
                "02838445566",
                "HD-20260921-0099",
                "ADJUSTMENT",
                "HD-20260921-0001",
                "Điều chỉnh giảm chi phí do bảo hiểm y tế chi trả bổ sung cho người bệnh",
                "BN-20260921-9999",
                "Nguyễn Trần Khánh Đan",
                "30/12/1985",
                "FEMALE",
                "0909888777",
                "KB-20260921-9999",
                Instant.parse("2026-09-21T08:00:00Z"),
                "BS.CKII. Vũ Hoàng Điệp",
                "Khoa Khám bệnh & Chẩn đoán hình ảnh",
                Instant.parse("2026-09-21T08:30:00Z"),
                "Lễ tân Đỗ Nguyễn Quỳnh Như",
                lines,
                new BigDecimal("3600000"),
                Instant.parse("2026-09-21T08:35:00Z")
        );

        byte[] pdfBytes = renderer.render(document);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 1000);

        try (PDDocument loaded = Loader.loadPDF(pdfBytes)) {
            assertTrue(loaded.getNumberOfPages() >= 1);
        }

        // Verify that the built lines preserve the full Vietnamese Unicode text
        FontMetrics metrics = renderer.createFontMetrics();
        List<String> renderedLines = renderer.buildLines(document, metrics);

        assertTrue(renderedLines.stream().anyMatch(l -> l.contains("HÓA ĐƠN ĐIỀU CHỈNH THU TIỀN")));
        assertTrue(renderedLines.stream().anyMatch(l -> l.contains("Phòng khám Đa khoa Quốc tế Hoàn Mỹ Sài Gòn")));
        assertTrue(renderedLines.stream().anyMatch(l -> l.contains("Nguyễn Trần Khánh Đan")));
        assertTrue(renderedLines.stream().anyMatch(l -> l.contains("BS.CKII. Vũ Hoàng Điệp")));
        assertTrue(renderedLines.stream().anyMatch(l -> l.contains("Nội soi thực quản - dạ dày - tá tràng có gây mê")));
        assertTrue(renderedLines.stream().anyMatch(l -> l.contains("TỔNG TIỀN THANH TOÁN: 3.600.000 đ")));
    }

    @Test
    @DisplayName("F-04: Renders multi-page invoice without data loss or duplication")
    void rendersInvoicePdf_withManyLines_createsMultiplePagesWithoutDataLossOrDuplication() throws Exception {
        PdfBoxInvoicePdfRenderer renderer = new PdfBoxInvoicePdfRenderer();

        int totalItems = 75;
        List<InvoicePrintLine> manyLines = new ArrayList<>();
        BigDecimal unitPrice = new BigDecimal("10000");
        for (int i = 1; i <= totalItems; i++) {
            manyLines.add(new InvoicePrintLine(
                    i,
                    "Khoản mục chi phí xét nghiệm kiểm tra số " + i,
                    "SERVICE",
                    1,
                    unitPrice,
                    unitPrice
            ));
        }
        BigDecimal expectedTotal = unitPrice.multiply(BigDecimal.valueOf(totalItems));

        InvoicePrintDocument document = new InvoicePrintDocument(
                "Phòng khám Đa khoa Hoàn Mỹ",
                "123 Nguyễn Huệ, Q.1, TP.HCM",
                "02838445566",
                "HD-20260921-0002",
                "ADJUSTMENT",
                "HD-20260921-0001",
                "Điều chỉnh giảm tiền khám do áp dụng voucher giảm giá",
                "BN-20260921-0001",
                "Nguyễn Văn Bệnh Nhân",
                "15/05/1990",
                "MALE",
                "0901234567",
                "KB-20260921-0012",
                Instant.parse("2026-09-21T08:00:00Z"),
                "BS. Trần Văn Bác Sĩ",
                "Khoa Nội",
                Instant.parse("2026-09-21T09:00:00Z"),
                "Lễ tân Nguyễn Thị Lễ Tân",
                manyLines,
                expectedTotal,
                Instant.parse("2026-09-21T09:05:00Z")
        );

        byte[] pdfBytes = renderer.render(document);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 0);

        try (PDDocument loaded = Loader.loadPDF(pdfBytes)) {
            assertTrue(loaded.getNumberOfPages() >= 2,
                    "Document with " + totalItems + " items must produce at least 2 pages");
        }

        // White-box pagination verification: ensure all 75 items are present, in order, without duplicates
        FontMetrics metrics = renderer.createFontMetrics();
        List<String> allLines = renderer.buildLines(document, metrics);
        List<List<String>> pages = renderer.paginate(allLines, document, metrics);

        assertTrue(pages.size() >= 2, "Paginated structure must have at least 2 pages");

        // Page 2 must have continuation header
        assertTrue(pages.get(1).stream().anyMatch(l -> l.contains("HÓA ĐƠN THU TIỀN (tiếp theo)")),
                "Second page must contain continuation header");

        // Verify all 75 items appear exactly once across all pages
        for (int i = 1; i <= totalItems; i++) {
            final String itemPrefix = i + ". Khoản mục chi phí xét nghiệm kiểm tra số " + i;
            int count = 0;
            for (List<String> page : pages) {
                for (String line : page) {
                    if (line.startsWith(itemPrefix)) {
                        count++;
                    }
                }
            }
            assertEquals(1, count, "Item " + i + " must appear exactly once across all pages");
        }

        // Verify final page contains total amount
        List<String> lastPage = pages.get(pages.size() - 1);
        assertTrue(lastPage.stream().anyMatch(l -> l.contains("TỔNG TIỀN THANH TOÁN: 750.000 đ")),
                "Last page must contain total amount");
    }

    @Test
    @DisplayName("F-04: Boundary check - single-page invoice does not create empty continuation page")
    void rendersInvoicePdf_atBoundary_doesNotCreateBlankPage() throws Exception {
        PdfBoxInvoicePdfRenderer renderer = new PdfBoxInvoicePdfRenderer();

        List<InvoicePrintLine> lines = List.of(
                new InvoicePrintLine(1, "Công khám ban đầu", "SERVICE", 1, new BigDecimal("100000"), new BigDecimal("100000"))
        );

        InvoicePrintDocument document = new InvoicePrintDocument(
                "Phòng khám Đa khoa Hoàn Mỹ", "123 Nguyễn Huệ, Q.1", "02838445566",
                "HD-20260921-0003", "ORIGINAL", null, null,
                "BN-0001", "Trần Văn A", "01/01/1990", "MALE", "0901112233",
                "KB-0001", Instant.parse("2026-09-21T08:00:00Z"), "BS. B", "Nội",
                Instant.parse("2026-09-21T08:30:00Z"), "Lễ tân C",
                lines, new BigDecimal("100000"), Instant.parse("2026-09-21T08:35:00Z")
        );

        byte[] pdfBytes = renderer.render(document);
        try (PDDocument loaded = Loader.loadPDF(pdfBytes)) {
            assertEquals(1, loaded.getNumberOfPages(), "Single item invoice should result in exactly 1 page");
        }
    }

    @Test
    @DisplayName("F-02: InvoicePrintDocument throws ValidationException when totalAmount does not match lines sum")
    void invoicePrintDocument_whenTotalAmountDoesNotMatchSumOfLines_throwsValidationException() {
        List<InvoicePrintLine> lines = List.of(
                new InvoicePrintLine(1, "Khám chuyên khoa", "SERVICE", 1, new BigDecimal("150000"), new BigDecimal("150000")),
                new InvoicePrintLine(2, "Thuốc hạ sốt", "MEDICINE", 1, new BigDecimal("50000"), new BigDecimal("50000"))
        );
        // lines sum = 200,000 but totalAmount is 250,000 (mismatch)
        BigDecimal mismatchedTotal = new BigDecimal("250000");

        ValidationException ex = assertThrows(ValidationException.class, () ->
                new InvoicePrintDocument(
                        "Phòng khám A", "Địa chỉ", "0123",
                        "HD-001", "ORIGINAL", null, null,
                        "BN-001", "Nguyễn Văn A", "01/01/1990", "MALE", "0900",
                        "KB-001", Instant.now(), "Bác sĩ", "Khoa",
                        Instant.now(), "Lễ tân", lines, mismatchedTotal, Instant.now()
                )
        );

        assertTrue(ex.getMessage().contains("Tổng tiền hóa đơn không khớp với tổng các dòng chi phí"));
    }

    @Test
    @DisplayName("F-02: InvoicePrintDocument accepts matching lines sum and totalAmount")
    void invoicePrintDocument_whenTotalAmountMatchesSumOfLines_succeeds() {
        List<InvoicePrintLine> lines = List.of(
                new InvoicePrintLine(1, "Khám chuyên khoa", "SERVICE", 1, new BigDecimal("150000"), new BigDecimal("150000")),
                new InvoicePrintLine(2, "Thuốc hạ sốt", "MEDICINE", 1, new BigDecimal("50000"), new BigDecimal("50000"))
        );
        BigDecimal matchingTotal = new BigDecimal("200000");

        InvoicePrintDocument doc = new InvoicePrintDocument(
                "Phòng khám A", "Địa chỉ", "0123",
                "HD-001", "ORIGINAL", null, null,
                "BN-001", "Nguyễn Văn A", "01/01/1990", "MALE", "0900",
                "KB-001", Instant.now(), "Bác sĩ", "Khoa",
                Instant.now(), "Lễ tân", lines, matchingTotal, Instant.now()
        );

        assertEquals(matchingTotal, doc.totalAmount());
        assertEquals(2, doc.lines().size());
    }

    @Test
    @DisplayName("Renders invoice with logo and fieldVisibility")
    void rendersInvoiceWithLogoAndFieldVisibility() throws Exception {
        String base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        List<InvoicePrintLine> lines = List.of(
                new InvoicePrintLine(1, "Khám chuyên khoa", "SERVICE", 1, new BigDecimal("150000"), new BigDecimal("150000"))
        );
        InvoicePrintDocument doc = new InvoicePrintDocument(
                "Phòng khám Đa khoa Tiêu chuẩn có tên phòng khám rất dài nhằm kiểm tra tính năng wrap header",
                "123 Đường Sức Khỏe, Quận Trung Tâm",
                "02838999999",
                "HD-20260925-001",
                "ORIGINAL",
                null,
                null,
                "BN-2026-0001",
                "Nguyễn Văn Người Bệnh",
                "15/06/1990",
                "NAM",
                "0912345678",
                "KB-20260925-001",
                Instant.now(),
                "BS. Trần Văn Bác Sĩ",
                "Khoa Nội",
                Instant.now(),
                "Lễ tân Thu Ngân",
                lines,
                new BigDecimal("150000"),
                Instant.now(),
                "HÓA ĐƠN THU TIỀN VIỆN PHÍ ĐIỆN TỬ",
                base64Png,
                "MST: 0100000000 - Cục Thuế TP.HCM",
                "Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ",
                true,
                1,
                "{\"showPatientCode\":false,\"showDoctor\":false}"
        );

        PdfBoxInvoicePdfRenderer renderer = new PdfBoxInvoicePdfRenderer();
        byte[] pdf = renderer.render(doc);

        assertNotNull(pdf);
        assertTrue(pdf.length > 0);
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertTrue(loaded.getNumberOfPages() == 1);
        }
    }
}

