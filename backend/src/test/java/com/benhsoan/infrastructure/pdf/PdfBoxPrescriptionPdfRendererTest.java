package com.benhsoan.infrastructure.pdf;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.port.dto.result.PrescriptionPrintDocument;

class PdfBoxPrescriptionPdfRendererTest {

    @Test
    void rendersLongClinicAndInstructionTextAcrossMultiplePages() throws Exception {
        String longText = "Hướng dẫn sử dụng thuốc sau bữa ăn và theo dõi phản ứng của cơ thể. ".repeat(12);
        PrescriptionPrintDocument document = new PrescriptionPrintDocument(
                "Phòng khám A", longText, "0900000000", "RX-LONG", UUID.randomUUID(), "PAT-001",
                "Nguyễn Văn A", UUID.randomUUID(), "Bác sĩ B", Instant.parse("2026-08-20T03:00:00Z"),
                java.util.stream.IntStream.range(0, 24)
                        .mapToObj(index -> new PrescriptionPrintDocument.Item(
                                "Thuốc " + index, "500 mg", "viên", "1 viên", 2, 7,
                                AdministrationRoute.ORAL, 14, longText
                        ))
                        .toList()
        );

        byte[] pdf = new PdfBoxPrescriptionPdfRenderer().render(document);

        assertThat(pdf).startsWith("%PDF".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isGreaterThan(1);
        }
    }

    @Test
    void rendersWithLogoAndFieldVisibility() throws Exception {
        String base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        PrescriptionPrintDocument document = new PrescriptionPrintDocument(
                "Phòng khám Đa khoa Quốc tế có tên rất dài để kiểm tra việc wrap văn bản khi có logo",
                "Số 123 Đường Y Dược, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh",
                "028-12345678",
                "RX-2026-001",
                UUID.randomUUID(),
                "PAT-001",
                "Nguyễn Văn A",
                UUID.randomUUID(),
                "BS. Bác Sĩ",
                Instant.parse("2026-08-20T03:00:00Z"),
                java.util.List.of(
                        new PrescriptionPrintDocument.Item(
                                "Paracetamol 500mg", "500 mg", "viên", "1 viên", 2, 5,
                                AdministrationRoute.ORAL, 10, "Uống khi sốt"
                        )
                ),
                "ĐƠN THUỐC ĐIỆN TỬ",
                base64Png,
                "GPKD: 12345/SYT",
                "Cảm ơn quý khách",
                true,
                "{\"showPatientCode\":false,\"showDoctor\":true,\"showInstructions\":false}"
        );

        byte[] pdf = new PdfBoxPrescriptionPdfRenderer().render(document);

        assertThat(pdf).startsWith("%PDF".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        try (PDDocument loaded = Loader.loadPDF(pdf)) {
            assertThat(loaded.getNumberOfPages()).isEqualTo(1);
        }
    }
}
