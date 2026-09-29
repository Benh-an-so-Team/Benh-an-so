package com.benhsoan.infrastructure.spreadsheet;

import java.io.InputStream;
import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;

import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.spreadsheet.RawPatientRowDto;
import com.benhsoan.port.outbound.spreadsheet.PatientSpreadsheetParserPort;

@Component
public class ExcelPatientSheetParser implements PatientSpreadsheetParserPort {

    private static final int MAX_ALLOWED_ROWS = 5000;

    public List<RawPatientRowDto> parse(InputStream inputStream) {
        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new ValidationException("Tệp bảng tính không có bất kỳ trang tính (sheet) nào.");
            }

            Sheet sheet = workbook.getSheetAt(0);
            int lastRowNum = sheet.getLastRowNum();
            if (lastRowNum < 1) {
                throw new ValidationException("Tệp bảng tính không có dữ liệu để nhập.");
            }

            // Row 0 is header
            List<RawPatientRowDto> rows = new ArrayList<>();
            int dataRowCount = 0;

            for (int r = 1; r <= lastRowNum; r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    continue;
                }

                RawPatientRowDto dto = RawPatientRowDto.builder()
                        .rowNumber(r + 1) // 1-indexed for human readability
                        .fullName(getCellStringValue(row.getCell(0)))
                        .dateOfBirth(getCellDateOrStringValue(row.getCell(1)))
                        .gender(getCellStringValue(row.getCell(2)))
                        .phone(getCellPhoneValue(row.getCell(3)))
                        .identityNumber(getCellIdentityValue(row.getCell(4)))
                        .insuranceNumber(getCellStringValue(row.getCell(5)))
                        .address(getCellStringValue(row.getCell(6)))
                        .email(getCellStringValue(row.getCell(7)))
                        .bloodType(getCellStringValue(row.getCell(8)))
                        .emergencyContact(getCellStringValue(row.getCell(9)))
                        .emergencyRelationship(getCellStringValue(row.getCell(10)))
                        .emergencyPhone(getCellPhoneValue(row.getCell(11)))
                        .guardianName(getCellStringValue(row.getCell(12)))
                        .guardianRelationship(getCellStringValue(row.getCell(13)))
                        .guardianPhone(getCellPhoneValue(row.getCell(14)))
                        .build();

                if (!dto.isEmpty()) {
                    dataRowCount++;
                    if (dataRowCount > MAX_ALLOWED_ROWS) {
                        throw new ValidationException("Tệp bảng tính vượt quá giới hạn " + MAX_ALLOWED_ROWS + " dòng dữ liệu.");
                    }
                    rows.add(dto);
                }
            }

            if (rows.isEmpty()) {
                throw new ValidationException("Tệp bảng tính không chứa dòng dữ liệu nào.");
            }

            return rows;
        } catch (ValidationException e) {
            throw e;
        } catch (Exception e) {
            throw new ValidationException("Không thể đọc tệp bảng tính: " + e.getMessage());
        }
    }

    private String getCellStringValue(Cell cell) {
        if (cell == null) {
            return null;
        }

        CellType cellType = cell.getCellType();
        if (cellType == CellType.FORMULA) {
            cellType = cell.getCachedFormulaResultType();
        }

        return switch (cellType) {
            case STRING -> normalize(cell.getStringCellValue());
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    Date date = cell.getDateCellValue();
                    yield date != null ? new SimpleDateFormat("yyyy-MM-dd").format(date) : null;
                }
                // Avoid scientific notation for phone, numbers
                double numericVal = cell.getNumericCellValue();
                if (numericVal == Math.floor(numericVal)) {
                    yield BigDecimal.valueOf((long) numericVal).toPlainString();
                }
                yield BigDecimal.valueOf(numericVal).toPlainString();
            }
            case BOOLEAN -> Boolean.toString(cell.getBooleanCellValue());
            default -> null;
        };
    }

    private String getCellDateOrStringValue(Cell cell) {
        if (cell == null) {
            return null;
        }

        CellType cellType = cell.getCellType();
        if (cellType == CellType.FORMULA) {
            cellType = cell.getCachedFormulaResultType();
        }

        if (cellType == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            Date date = cell.getDateCellValue();
            return date != null ? new SimpleDateFormat("yyyy-MM-dd").format(date) : null;
        }

        return getCellStringValue(cell);
    }

    private String getCellPhoneValue(Cell cell) {
        String val = getCellStringValue(cell);
        if (val == null) {
            return null;
        }
        String clean = val.replaceAll("[\\s.-]", "");
        // If Excel numeric stripped the leading zero for a 9-digit VN mobile number starting with 3,5,7,8,9
        if (clean.matches("^[35789]\\d{8}$")) {
            return "0" + clean;
        }
        return clean.isEmpty() ? null : clean;
    }

    private String getCellIdentityValue(Cell cell) {
        String val = getCellStringValue(cell);
        if (val == null) {
            return null;
        }
        String clean = val.replaceAll("[\\s.-]", "");
        // If Excel numeric stripped leading zeros:
        // Vietnamese CCCD is 12 digits. If stripped to 10 or 11 digits, restore leading zeros.
        if (clean.matches("^\\d{10,11}$")) {
            return "0".repeat(12 - clean.length()) + clean;
        }
        // Vietnamese CMND is 9 digits. If stripped to 8 digits, restore leading zero.
        if (clean.matches("^\\d{8}$")) {
            return "0" + clean;
        }
        return clean.isEmpty() ? null : clean;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
