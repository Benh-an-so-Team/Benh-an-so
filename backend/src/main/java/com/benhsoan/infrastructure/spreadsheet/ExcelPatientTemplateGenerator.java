package com.benhsoan.infrastructure.spreadsheet;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormat;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import com.benhsoan.port.outbound.spreadsheet.PatientSpreadsheetTemplatePort;

@Component
public class ExcelPatientTemplateGenerator implements PatientSpreadsheetTemplatePort {

    private static final String[] HEADERS = {
            "Họ và tên (*)",
            "Ngày sinh (*) (dd/MM/yyyy)",
            "Giới tính (*) (Nam/Nữ)",
            "Số điện thoại",
            "Số CCCD/CMND",
            "Số thẻ BHYT",
            "Địa chỉ",
            "Email",
            "Nhóm máu (A/B/AB/O)",
            "Người liên hệ khẩn cấp",
            "Quan hệ người liên hệ",
            "SĐT người liên hệ",
            "Tên người giám hộ (<18t bắt buộc)",
            "Quan hệ người giám hộ (<18t bắt buộc)",
            "SĐT người giám hộ (<18t bắt buộc)"
    };

    public byte[] generateTemplate() {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Danh_sach_benh_nhan");

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Text Style for data columns (explicitly string '@' to prevent Excel from auto-converting to numbers and dropping leading zeros)
            CellStyle textStyle = workbook.createCellStyle();
            DataFormat dataFormat = workbook.createDataFormat();
            textStyle.setDataFormat(dataFormat.getFormat("@"));

            // Create Header Row
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < HEADERS.length; i++) {
                sheet.setDefaultColumnStyle(i, textStyle);
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(HEADERS[i]);
                cell.setCellStyle(headerStyle);
            }

            // Sample Row 1: Adult
            Row sampleRow1 = sheet.createRow(1);
            sampleRow1.createCell(0).setCellValue("Nguyễn Văn An");
            sampleRow1.createCell(1).setCellValue("15/05/1988");
            sampleRow1.createCell(2).setCellValue("Nam");
            sampleRow1.createCell(3).setCellValue("0901234567");
            sampleRow1.createCell(4).setCellValue("001088012345");
            sampleRow1.createCell(5).setCellValue("DN4010123456789");
            sampleRow1.createCell(6).setCellValue("123 Đường Giải Phóng, Hà Nội");
            sampleRow1.createCell(7).setCellValue("nguyenvanan@example.com");
            sampleRow1.createCell(8).setCellValue("O");
            sampleRow1.createCell(9).setCellValue("Trần Thị Bình");
            sampleRow1.createCell(10).setCellValue("Vợ");
            sampleRow1.createCell(11).setCellValue("0912345678");
            sampleRow1.createCell(12).setCellValue("");
            sampleRow1.createCell(13).setCellValue("");
            sampleRow1.createCell(14).setCellValue("");

            // Sample Row 2: Minor (<18 years old, requires guardian QTN-44)
            Row sampleRow2 = sheet.createRow(2);
            sampleRow2.createCell(0).setCellValue("Nguyễn Minh Khang");
            sampleRow2.createCell(1).setCellValue("20/10/2015");
            sampleRow2.createCell(2).setCellValue("Nam");
            sampleRow2.createCell(3).setCellValue("");
            sampleRow2.createCell(4).setCellValue("");
            sampleRow2.createCell(5).setCellValue("");
            sampleRow2.createCell(6).setCellValue("123 Đường Giải Phóng, Hà Nội");
            sampleRow2.createCell(7).setCellValue("");
            sampleRow2.createCell(8).setCellValue("A");
            sampleRow2.createCell(9).setCellValue("");
            sampleRow2.createCell(10).setCellValue("");
            sampleRow2.createCell(11).setCellValue("");
            sampleRow2.createCell(12).setCellValue("Nguyễn Văn An");
            sampleRow2.createCell(13).setCellValue("Bố");
            sampleRow2.createCell(14).setCellValue("0901234567");

            for (int i = 0; i < HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Lỗi khi tạo tệp bảng tính mẫu: " + e.getMessage(), e);
        }
    }
}
