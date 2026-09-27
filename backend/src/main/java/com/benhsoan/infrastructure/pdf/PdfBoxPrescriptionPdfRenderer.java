package com.benhsoan.infrastructure.pdf;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
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

import com.benhsoan.port.dto.result.PrescriptionPrintDocument;
import com.benhsoan.port.outbound.pdf.PrescriptionPdfRenderer;

@Component
public class PdfBoxPrescriptionPdfRenderer implements PrescriptionPdfRenderer {

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
    public byte[] render(PrescriptionPrintDocument prescription) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            FontMetrics metrics = createFontMetrics();
            List<List<String>> pages = paginate(buildLines(prescription, metrics), prescription, metrics);
            BufferedImage logo = prescription.showLogo() ? LogoImageLoader.load(prescription.logoUrl()) : null;

            for (int i = 0; i < pages.size(); i++) {
                List<String> page = pages.get(i);
                BufferedImage pageImage = renderPage(page, i == 0 ? logo : null);
                document.addPage(new PDPage(PDRectangle.A4));
                PDImageXObject image = LosslessFactory.createFromImage(document, pageImage);
                try (PDPageContentStream content = new PDPageContentStream(
                        document, document.getPage(document.getNumberOfPages() - 1))) {
                    content.drawImage(image, 0, 0, PDRectangle.A4.getWidth(), PDRectangle.A4.getHeight());
                }
            }
            document.save(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new PdfRenderingException("Unable to generate prescription PDF.", ex);
        }
    }

    private FontMetrics createFontMetrics() {
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

    private List<String> buildLines(PrescriptionPrintDocument prescription, FontMetrics metrics) {
        List<String> lines = new ArrayList<>();
        boolean hasLogo = prescription.showLogo() && prescription.logoUrl() != null && !prescription.logoUrl().isBlank();
        int headerWidth = hasLogo ? (CONTENT_WIDTH - 160) : CONTENT_WIDTH;

        String title = prescription.title() != null && !prescription.title().isBlank()
                ? prescription.title()
                : "ĐƠN THUỐC";

        // Header lines wrapped with headerWidth to avoid overlapping logo in top-right
        List<String> headerLines = new ArrayList<>();
        headerLines.add(title);
        headerLines.add("Phòng khám: " + nvl(prescription.clinicName()));
        headerLines.add("Địa chỉ: " + nvl(prescription.clinicAddress()));
        headerLines.add("Điện thoại: " + nvl(prescription.clinicPhone()));
        if (prescription.legalInfo() != null && !prescription.legalInfo().isBlank()) {
            headerLines.add("Thông tin pháp lý: " + prescription.legalInfo());
        }

        for (String hLine : headerLines) {
            lines.addAll(wrapWithWidth(hLine, metrics, headerWidth));
        }

        lines.add("================================================================================");
        lines.add("");

        lines.add("THÔNG TIN ĐƠN THUỐC & BỆNH NHÂN");
        lines.add("- Mã đơn thuốc: " + nvl(prescription.prescriptionCode()));
        lines.add("- Bệnh nhân: " + nvl(prescription.patientName()) + " (" + nvl(prescription.patientCode()) + ")");
        lines.add("- Bác sĩ kê đơn: " + nvl(prescription.doctorName()));
        lines.add("- Thời gian kê đơn: " + (prescription.prescribedAt() == null ? "-" : DATE_TIME_FORMATTER.format(prescription.prescribedAt())));
        lines.add("");

        lines.add("DANH SÁCH THUỐC ĐIỀU TRỊ");
        if (prescription.items() == null || prescription.items().isEmpty()) {
            lines.add("   (Không có thuốc trong đơn)");
        } else {
            for (int index = 0; index < prescription.items().size(); index++) {
                PrescriptionPrintDocument.Item item = prescription.items().get(index);
                lines.add((index + 1) + ". " + item.medicineName() + " - " + item.strength() + " " + item.unit());
                lines.add("   Liều dùng: " + item.dosage() + "; Tần suất: " + item.frequency()
                        + " lần/ngày; Số ngày: " + item.durationDays() + " ngày; Đường dùng: " + item.route());
                lines.add("   Số lượng: " + item.quantity() + "; Lời dặn: "
                        + (item.instructions() == null ? "-" : item.instructions()));
            }
        }
        lines.add("");

        if (prescription.footerText() != null && !prescription.footerText().isBlank()) {
            lines.add("--------------------------------------------------------------------------------");
            lines.add(prescription.footerText());
            lines.add("");
        }

        boolean showDoctorSig = PrintFieldVisibilityHelper.isVisible(prescription.fieldVisibility(), "showDoctorSignature", true);
        if (showDoctorSig) {
            lines.add("BÁC SĨ ĐIỀU TRỊ: " + nvl(prescription.doctorName()));
        }

        return lines.stream().flatMap(line -> wrapWithWidth(line, metrics, CONTENT_WIDTH).stream()).toList();
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
            if (metrics.stringWidth(candidate) <= maxWidth) {
                currentLine = new StringBuilder(candidate);
                continue;
            }
            if (!currentLine.isEmpty()) {
                wrappedLines.add(currentLine.toString());
                currentLine = new StringBuilder();
            }
            if (metrics.stringWidth(token) <= maxWidth) {
                currentLine.append(token);
                continue;
            }
            for (String subWord : splitLongWord(token, metrics)) {
                if (currentLine.isEmpty()) {
                    currentLine.append(subWord);
                    continue;
                }
                String nextCandidate = currentLine + " " + subWord;
                if (metrics.stringWidth(nextCandidate) <= maxWidth) {
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

    private List<List<String>> paginate(
            List<String> lines,
            PrescriptionPrintDocument prescription,
            FontMetrics metrics
    ) {
        List<List<String>> pages = new ArrayList<>();
        int nextLine = 0;
        while (nextLine < lines.size()) {
            List<String> page = new ArrayList<>();
            if (!pages.isEmpty()) {
                List<String> header = continuationHeader(prescription, metrics);
                page.addAll(header.subList(0, Math.min(header.size(), LINES_PER_PAGE - 1)));
            }
            while (nextLine < lines.size() && page.size() < LINES_PER_PAGE) {
                page.add(lines.get(nextLine++));
            }
            pages.add(page);
        }
        return pages;
    }

    private List<String> continuationHeader(PrescriptionPrintDocument prescription, FontMetrics metrics) {
        String title = prescription.title() != null && !prescription.title().isBlank()
                ? prescription.title()
                : "ĐƠN THUỐC";
        return List.of(
                title + " (tiếp theo)",
                "Mã đơn thuốc: " + nvl(prescription.prescriptionCode()),
                "Bệnh nhân: " + nvl(prescription.patientName()) + " (" + nvl(prescription.patientCode()) + ")",
                "Bác sĩ kê đơn: " + nvl(prescription.doctorName()),
                "--------------------------------------------------------------------------------"
        ).stream().flatMap(line -> wrap(line, metrics).stream()).toList();
    }

    private List<String> wrap(String line, FontMetrics metrics) {
        if (line.isEmpty()) {
            return List.of("");
        }
        List<String> wrappedLines = new ArrayList<>();
        for (String paragraph : line.split("\\R", -1)) {
            wrapParagraph(paragraph, metrics, wrappedLines);
        }
        return wrappedLines;
    }

    private void wrapParagraph(String paragraph, FontMetrics metrics, List<String> wrappedLines) {
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
