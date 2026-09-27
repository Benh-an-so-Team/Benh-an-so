package com.benhsoan.infrastructure.pdf;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
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

import com.benhsoan.port.dto.result.VisitSummaryPrintDocument;
import com.benhsoan.port.outbound.pdf.VisitSummaryPdfRenderer;

@Component
public class PdfBoxVisitSummaryPdfRenderer implements VisitSummaryPdfRenderer {

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
    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Override
    public byte[] render(VisitSummaryPrintDocument document) {
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
            throw new PdfRenderingException("Unable to generate visit summary PDF.", ex);
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
        graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        int y = TOP_MARGIN;
        for (String line : lines) {
            graphics.drawString(line, LEFT_MARGIN, y);
            y += LINE_HEIGHT;
        }
        graphics.dispose();
        return image;
    }

    List<String> buildLines(VisitSummaryPrintDocument d, FontMetrics metrics) {
        List<String> lines = new ArrayList<>();
        boolean hasLogo = d.showLogo() && d.logoUrl() != null && !d.logoUrl().isBlank();
        int headerWidth = hasLogo ? (CONTENT_WIDTH - 160) : CONTENT_WIDTH;

        String title = d.title() != null && !d.title().isBlank()
                ? d.title()
                : "PHIẾU TÓM TẮT LƯỢT KHÁM";

        List<String> headerLines = new ArrayList<>();
        headerLines.add(title);
        headerLines.add("PHÒNG KHÁM: " + nvl(d.clinicName()));
        headerLines.add("Địa chỉ: " + nvl(d.clinicAddress()));
        headerLines.add("Điện thoại: " + nvl(d.clinicPhone()));
        if (d.legalInfo() != null && !d.legalInfo().isBlank()) {
            headerLines.add("Thông tin pháp lý: " + d.legalInfo());
        }

        for (String hLine : headerLines) {
            lines.addAll(wrapWithWidth(hLine, metrics, headerWidth));
        }

        lines.add("================================================================================");
        lines.add("");

        lines.add("1. THÔNG TIN BỆNH NHÂN");
        lines.add("- Mã bệnh nhân: " + nvl(d.patientCode()) + "  |  Họ và tên: " + nvl(d.patientName()));
        lines.add("- Ngày sinh: " + nvl(d.patientDateOfBirth()) + "  |  Giới tính: " + nvl(d.patientGender()) + "  |  SĐT: " + nvl(d.patientPhone()));
        lines.add("");

        lines.add("2. THÔNG TIN LƯỢT KHÁM");
        lines.add("- Mã lượt khám: " + nvl(d.visitCode()));
        lines.add("- Thời gian khám: " + (d.visitAt() == null ? "-" : DATE_TIME_FORMATTER.format(d.visitAt())));
        lines.add("- Bác sĩ khám: " + nvl(d.doctorName()));
        lines.add("");

        boolean showDiagnosis = PrintFieldVisibilityHelper.isVisible(d.fieldVisibility(), "showDiagnosis", true);
        if (showDiagnosis) {
            lines.add("3. CHẨN ĐOÁN");
            if (d.diagnoses() == null || d.diagnoses().isEmpty()) {
                lines.add("- Chưa ghi nhận chẩn đoán");
            } else {
                for (VisitSummaryPrintDocument.Diagnosis diagnosis : d.diagnoses()) {
                    String type = diagnosis.isPrimary() ? "(Chẩn đoán chính)" : "(Chẩn đoán kèm theo)";
                    lines.add("- [" + nvl(diagnosis.code()) + "] " + nvl(diagnosis.name()) + " " + type);
                }
            }
            lines.add("");
        }

        boolean showOrders = PrintFieldVisibilityHelper.isVisible(d.fieldVisibility(), "showClinicalOrders", true);
        if (showOrders) {
            lines.add("4. CHỈ ĐỊNH CẬN LÂM SÀNG");
            if (d.clinicalOrders() == null || d.clinicalOrders().isEmpty()) {
                lines.add("- Không có chỉ định cận lâm sàng trong lượt khám");
            } else {
                int idx = 1;
                for (VisitSummaryPrintDocument.ClinicalOrder order : d.clinicalOrders()) {
                    String instruction = (order.instruction() != null && !order.instruction().isBlank())
                            ? " - Ghi chú: " + order.instruction() : "";
                    String status = formatOrderStatus(order.status());
                    String codeStr = (order.serviceCode() != null && !order.serviceCode().isBlank())
                            ? " (Mã: " + order.serviceCode() + ")" : "";
                    lines.add(idx++ + ". " + nvl(order.serviceName()) + codeStr + instruction + status);
                }
            }
            lines.add("");
        }

        lines.add("5. KẾ HOẠCH ĐIỀU TRỊ & LỜI DẶN CỦA BÁC SĨ");
        lines.add("- Hướng điều trị: " + (d.treatmentPlan() != null && !d.treatmentPlan().isBlank() ? d.treatmentPlan() : "Theo dõi ngoại trú"));
        lines.add("- Lời dặn: " + (d.doctorInstructions() != null && !d.doctorInstructions().isBlank() ? d.doctorInstructions() : "Tuân thủ hướng dẫn dùng thuốc và tái khám đúng hẹn"));
        lines.add("");

        boolean showRevisit = PrintFieldVisibilityHelper.isVisible(d.fieldVisibility(), "showRevisitDate", true);
        if (showRevisit) {
            lines.add("6. HẸN TÁI KHÁM");
            lines.add("- Mốc tái khám: " + formatRevisitDate(d.revisitDate()));
            lines.add("");
        }

        if (d.footerText() != null && !d.footerText().isBlank()) {
            lines.add("--------------------------------------------------------------------------------");
            lines.add(d.footerText());
            lines.add("");
        }

        lines.add("================================================================================");
        boolean showDoctorSig = PrintFieldVisibilityHelper.isVisible(d.fieldVisibility(), "showDoctorSignature", true);
        if (showDoctorSig) {
            lines.add("BÁC SĨ PHỤ TRÁCH LƯỢT KHÁM: " + nvl(d.signedByName()) + " (Đã ký xác nhận điện tử: "
                    + (d.signedAt() == null ? "-" : DATE_TIME_FORMATTER.format(d.signedAt())) + ")");
        }
        lines.add("Người in: " + nvl(d.printedByName()) + "  |  Thời điểm in: "
                + (d.printedAt() == null ? "-" : DATE_TIME_FORMATTER.format(d.printedAt())));

        return lines.stream().flatMap(line -> wrapWithWidth(line, metrics, CONTENT_WIDTH).stream()).toList();
    }

    private String formatOrderStatus(String status) {
        if (status == null || status.isBlank()) {
            return "";
        }
        if ("COMPLETED".equalsIgnoreCase(status.trim())) {
            return " [Đã có kết quả]";
        }
        if ("PENDING".equalsIgnoreCase(status.trim())) {
            return " [Chờ thực hiện]";
        }
        return " [" + status + "]";
    }

    private String formatRevisitDate(LocalDate revisitDate) {
        if (revisitDate == null) {
            return "Tái khám khi có dấu hiệu bất thường hoặc theo hướng dẫn của bác sĩ.";
        }
        return DATE_FORMATTER.format(revisitDate);
    }

    private List<List<String>> paginate(
            List<String> lines,
            VisitSummaryPrintDocument document,
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

    private List<String> continuationHeader(VisitSummaryPrintDocument document, FontMetrics metrics) {
        String title = document.title() != null && !document.title().isBlank()
                ? document.title()
                : "PHIẾU TÓM TẮT LƯỢT KHÁM";
        return List.of(
                title + " (tiếp theo)",
                "Bệnh nhân: " + nvl(document.patientName()) + " (" + nvl(document.patientCode()) + ")",
                "--------------------------------------------------------------------------------"
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
        for (String token : splitTokens(paragraph)) {
            String candidate = currentLine.isEmpty() ? token : currentLine + " " + token;
            if (metrics.stringWidth(candidate) <= CONTENT_WIDTH) {
                currentLine = new StringBuilder(candidate);
                continue;
            }
            if (!currentLine.isEmpty()) {
                wrappedLines.add(currentLine.toString());
                currentLine = new StringBuilder();
            }
            if (metrics.stringWidth(token) <= CONTENT_WIDTH) {
                currentLine.append(token);
                continue;
            }
            for (String subWord : splitLongWord(token, metrics)) {
                if (currentLine.isEmpty()) {
                    currentLine.append(subWord);
                    continue;
                }
                String nextCandidate = currentLine + " " + subWord;
                if (metrics.stringWidth(nextCandidate) <= CONTENT_WIDTH) {
                    currentLine = new StringBuilder(nextCandidate);
                } else {
                    wrappedLines.add(currentLine.toString());
                    currentLine = new StringBuilder(subWord);
                }
            }
        }
        if (!currentLine.isEmpty()) {
            wrappedLines.add(currentLine.toString());
        }
    }

    private List<String> splitTokens(String paragraph) {
        return List.of(paragraph.split("\\s+"));
    }

    private List<String> splitLongWord(String word, FontMetrics metrics) {
        List<String> parts = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (char ch : word.toCharArray()) {
            String candidate = current.toString() + ch;
            if (metrics.stringWidth(candidate) <= CONTENT_WIDTH) {
                current.append(ch);
            } else {
                if (!current.isEmpty()) {
                    parts.add(current.toString());
                }
                current = new StringBuilder().append(ch);
            }
        }
        if (!current.isEmpty()) {
            parts.add(current.toString());
        }
        return parts;
    }

    private String nvl(String val) {
        return val != null ? val : "-";
    }
}
