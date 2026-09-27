package com.benhsoan.infrastructure.pdf;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Component;

import com.benhsoan.port.dto.result.portal.ClinicalResultPrintDocument;
import com.benhsoan.port.outbound.pdf.ClinicalResultPdfRenderer;

@Component
public class PdfBoxClinicalResultPdfRenderer implements ClinicalResultPdfRenderer {

    private static final int IMAGE_WIDTH = 1190;
    private static final int IMAGE_HEIGHT = 1684;
    private static final int LEFT_MARGIN = 100;
    private static final int TOP_MARGIN = 110;
    private static final int LINE_HEIGHT = 32;
    private static final int LINES_PER_PAGE = 48;
    private static final int CONTENT_WIDTH = IMAGE_WIDTH - (LEFT_MARGIN * 2);
    private static final Font CONTENT_FONT = new Font(Font.SANS_SERIF, Font.PLAIN, 22);

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(VIETNAM_ZONE);

    @Override
    public byte[] render(ClinicalResultPrintDocument document) {
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            FontMetrics metrics = createFontMetrics();
            List<List<String>> pages = paginate(buildLines(document, metrics), document, metrics);
            BufferedImage logo = document.showLogo() ? LogoImageLoader.load(document.logoUrl()) : null;
            for (int i = 0; i < pages.size(); i++) {
                List<String> page = pages.get(i);
                BufferedImage pageImage = renderPage(page, i == 0 ? logo : null);
                pdf.addPage(new PDPage(PDRectangle.A4));
                PDImageXObject image = LosslessFactory.createFromImage(pdf, pageImage);
                try (PDPageContentStream content = new PDPageContentStream(
                        pdf, pdf.getPage(pdf.getNumberOfPages() - 1))) {
                    content.drawImage(image, 0, 0, PDRectangle.A4.getWidth(), PDRectangle.A4.getHeight());
                }
            }
            pdf.save(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new PdfRenderingException("Không thể tạo tệp PDF kết quả cận lâm sàng.", ex);
        }
    }

    FontMetrics createFontMetrics() {
        BufferedImage image = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            return graphics.getFontMetrics(CONTENT_FONT);
        } finally {
            graphics.dispose();
        }
    }

    private BufferedImage renderPage(List<String> lines, BufferedImage logo) {
        BufferedImage image = new BufferedImage(IMAGE_WIDTH, IMAGE_HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(Color.WHITE);
        graphics.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

        if (logo != null) {
            int maxLogoWidth = 140;
            int maxLogoHeight = 70;
            int lw = logo.getWidth();
            int lh = logo.getHeight();
            double scale = Math.min((double) maxLogoWidth / lw, (double) maxLogoHeight / lh);
            int drawW = Math.max(1, (int) (lw * scale));
            int drawH = Math.max(1, (int) (lh * scale));
            int logoX = IMAGE_WIDTH - LEFT_MARGIN - drawW;
            int logoY = TOP_MARGIN - 20;
            graphics.drawImage(logo, logoX, logoY, drawW, drawH, null);
        }

        graphics.setColor(Color.BLACK);
        graphics.setFont(CONTENT_FONT);
        graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
                RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        int y = TOP_MARGIN;
        for (String line : lines) {
            graphics.drawString(line, LEFT_MARGIN, y);
            y += LINE_HEIGHT;
        }
        graphics.dispose();
        return image;
    }

    List<String> buildLines(ClinicalResultPrintDocument doc, FontMetrics metrics) {
        List<String> lines = new ArrayList<>();
        boolean hasLogo = doc.showLogo() && doc.logoUrl() != null && !doc.logoUrl().isBlank();
        int headerWidth = hasLogo ? (CONTENT_WIDTH - 160) : CONTENT_WIDTH;

        String title = doc.title() != null && !doc.title().isBlank()
                ? doc.title()
                : "PHIẾU KẾT QUẢ CẬN LÂM SÀNG";

        List<String> headerLines = new ArrayList<>();
        headerLines.add(title);
        headerLines.add("Phòng khám: " + defaultText(doc.clinicName()));
        headerLines.add("Địa chỉ: " + defaultText(doc.clinicAddress()));
        headerLines.add("Điện thoại: " + defaultText(doc.clinicPhone()));
        if (doc.legalInfo() != null && !doc.legalInfo().isBlank()) {
            headerLines.add("Thông tin pháp lý: " + doc.legalInfo());
        }

        for (String hLine : headerLines) {
            lines.addAll(wrapWithWidth(hLine, metrics, headerWidth));
        }

        lines.add("================================================================================");
        lines.add("");

        lines.add("THÔNG TIN BỆNH NHÂN & LƯỢT KHÁM");
        lines.add("Bệnh nhân: " + defaultText(doc.patientName()) + " (Mã BN: " + defaultText(doc.patientCode()) + ")");
        lines.add("Ngày sinh: " + defaultText(doc.patientDateOfBirth()) + " | Giới tính: " + defaultText(doc.patientGender()) + " | SĐT: " + defaultText(doc.patientPhone()));
        lines.add("Mã lượt khám: " + defaultText(doc.visitCode()) + " | Ngày khám: " + formatDateTime(doc.visitAt()));
        lines.add("Bác sĩ chỉ định: " + defaultText(doc.doctorName()) + " | Chuyên khoa: " + defaultText(doc.specialtyName()));
        if (doc.orderCode() != null && !doc.orderCode().isBlank()) {
            lines.add("Mã chỉ định: " + doc.orderCode());
        }
        if (doc.clinicalReason() != null && !doc.clinicalReason().isBlank()) {
            lines.add("Lý do khám / Chẩn đoán sơ bộ: " + doc.clinicalReason());
        }
        lines.add("");

        boolean showRefRange = PrintFieldVisibilityHelper.isVisible(doc.fieldVisibility(), "showReferenceRange", true);
        lines.add("KẾT QUẢ XÉT NGHIỆM / CẬN LÂM SÀNG");
        if (doc.items() == null || doc.items().isEmpty()) {
            lines.add("   (Không có kết quả cận lâm sàng nào)");
        } else {
            for (var item : doc.items()) {
                lines.add(String.format("%d. %s (Mã: %s)", item.itemIndex(), item.serviceName(), item.serviceCode()));
                String valStr = item.resultValue() != null ? item.resultValue() : "-";
                if (item.unit() != null && !item.unit().isBlank()) {
                    valStr += " " + item.unit();
                }
                String refStr = showRefRange
                        ? ("  |  CSBT: " + (item.referenceRange() != null && !item.referenceRange().isBlank() ? item.referenceRange() : "-"))
                        : "";
                String flagStr = "";
                if (item.abnormalFlag() != null && !"NORMAL".equalsIgnoreCase(item.abnormalFlag()) && !"UNKNOWN".equalsIgnoreCase(item.abnormalFlag())) {
                    flagStr = " [" + mapAbnormalFlag(item.abnormalFlag()) + "]";
                }
                lines.add(String.format("   Kết quả: %s%s%s", valStr, refStr, flagStr));
                if (item.conclusion() != null && !item.conclusion().isBlank()) {
                    lines.add("   Kết luận: " + item.conclusion());
                }
            }
        }
        lines.add("");

        if (doc.overallConclusion() != null && !doc.overallConclusion().isBlank()) {
            lines.add("KẾT LUẬN CHUNG: " + doc.overallConclusion());
            lines.add("");
        }

        if (doc.footerText() != null && !doc.footerText().isBlank()) {
            lines.add("--------------------------------------------------------------------------------");
            lines.add(doc.footerText());
            lines.add("");
        } else {
            lines.add("(Chứng từ điện tử tra cứu từ Cổng bệnh nhân trực tuyến)");
            lines.add("");
        }

        boolean showDoctorSig = PrintFieldVisibilityHelper.isVisible(doc.fieldVisibility(), "showDoctorSignature", true);
        if (showDoctorSig) {
            lines.add("BÁC SĨ CHUYÊN KHOA KÝ TÊN: " + defaultText(doc.doctorName()));
            lines.add("");
        }

        lines.add("Thời gian in: " + formatDateTime(doc.printedAt()));

        return lines.stream().flatMap(line -> wrapWithWidth(line, metrics, CONTENT_WIDTH).stream()).toList();
    }

    List<List<String>> paginate(
            List<String> lines,
            ClinicalResultPrintDocument document,
            FontMetrics metrics
    ) {
        List<List<String>> pages = new ArrayList<>();
        int nextLine = 0;
        while (nextLine < lines.size()) {
            List<String> page = new ArrayList<>();
            if (!pages.isEmpty()) {
                List<String> header = continuationHeader(document, metrics);
                page.addAll(header.subList(0, Math.min(header.size(), LINES_PER_PAGE - 1)));
            }
            while (nextLine < lines.size() && page.size() < LINES_PER_PAGE) {
                page.add(lines.get(nextLine++));
            }
            pages.add(page);
        }
        return pages;
    }

    private List<String> continuationHeader(ClinicalResultPrintDocument document, FontMetrics metrics) {
        return List.of(
                "PHIẾU KẾT QUẢ CẬN LÂM SÀNG (tiếp theo)",
                "Bệnh nhân: " + defaultText(document.patientName()) + " (" + defaultText(document.patientCode()) + ")",
                "Mã lượt khám: " + defaultText(document.visitCode()),
                ""
        ).stream().flatMap(line -> wrap(line, metrics).stream()).toList();
    }

    private List<String> wrap(String line, FontMetrics metrics) {
        return wrapWithWidth(line, metrics, CONTENT_WIDTH);
    }

    private List<String> wrapWithWidth(String line, FontMetrics metrics, int maxWidth) {
        if (line.isEmpty()) {
            return List.of("");
        }
        List<String> wrappedLines = new ArrayList<>();
        for (String paragraph : line.split("\\R", -1)) {
            wrapParagraphWithWidth(paragraph, metrics, wrappedLines, maxWidth);
        }
        return wrappedLines;
    }

    private void wrapParagraphWithWidth(String paragraph, FontMetrics metrics, List<String> wrappedLines, int maxWidth) {
        if (paragraph.isEmpty()) {
            wrappedLines.add("");
            return;
        }
        StringBuilder currentLine = new StringBuilder();
        for (String word : paragraph.split(" ")) {
            String candidate = currentLine.isEmpty() ? word : currentLine + " " + word;
            if (metrics.stringWidth(candidate) <= maxWidth) {
                currentLine.setLength(0);
                currentLine.append(candidate);
                continue;
            }
            if (!currentLine.isEmpty()) {
                wrappedLines.add(currentLine.toString());
                currentLine.setLength(0);
            }
            addLongWordWithWidth(word, metrics, wrappedLines, currentLine, maxWidth);
        }
        if (!currentLine.isEmpty()) {
            wrappedLines.add(currentLine.toString());
        }
    }

    private void addLongWordWithWidth(
            String word,
            FontMetrics metrics,
            List<String> wrappedLines,
            StringBuilder currentLine,
            int maxWidth
    ) {
        for (int index = 0; index < word.length(); index++) {
            currentLine.append(word.charAt(index));
            if (metrics.stringWidth(currentLine.toString()) > maxWidth) {
                char overflow = currentLine.charAt(currentLine.length() - 1);
                currentLine.deleteCharAt(currentLine.length() - 1);
                wrappedLines.add(currentLine.toString());
                currentLine.setLength(0);
                currentLine.append(overflow);
            }
        }
    }

    private String formatDateTime(Instant instant) {
        if (instant == null) {
            return "-";
        }
        return DATE_TIME_FORMATTER.format(instant);
    }

    private String defaultText(String text) {
        return (text == null || text.isBlank()) ? "-" : text.trim();
    }

    private String mapAbnormalFlag(String abnormalFlag) {
        if (abnormalFlag == null) {
            return "Bình thường";
        }
        return switch (abnormalFlag.toUpperCase()) {
            case "HIGH" -> "Cao";
            case "LOW" -> "Thấp";
            case "ABNORMAL" -> "Bất thường";
            case "CRITICAL" -> "Nguy kịch";
            default -> abnormalFlag;
        };
    }
}
