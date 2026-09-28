import assert from 'node:assert/strict'
import test from 'node:test'

import {
  validateSpreadsheetFile,
  formatFileSize,
  formatDateTime,
  exportErrorsToCsv,
  getSamplePreviewData,
  getSampleImportResult,
  MAX_IMPORT_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} from '../../utils/patientImportHelpers.js'
import { getNavigationItems } from '../../components/layout/navigationConfig.js'

test('Patient Import - validateSpreadsheetFile rules', () => {
  // 1. Rejects null/undefined file
  const nullCheck = validateSpreadsheetFile(null)
  assert.equal(nullCheck.isValid, false)
  assert.match(nullCheck.error, /chọn tệp/i)

  // 2. Rejects invalid extensions
  const invalidTxt = validateSpreadsheetFile({ name: 'benh_nhan.txt', size: 1024 })
  assert.equal(invalidTxt.isValid, false)
  assert.match(invalidTxt.error, /định dạng tệp không hợp lệ/i)

  const invalidPdf = validateSpreadsheetFile({ name: 'danh_sach.pdf', size: 2048 })
  assert.equal(invalidPdf.isValid, false)

  // 3. Rejects CSV with helpful message to convert to XLSX
  const csvFile = validateSpreadsheetFile({ name: 'danh_sach.csv', size: 1024 })
  assert.equal(csvFile.isValid, false)
  assert.match(csvFile.error, /CSV.*chưa được hỗ trợ trực tiếp.*Excel \(\.xlsx\)/i)

  // 4. Rejects empty file (0 bytes)
  const emptyFile = validateSpreadsheetFile({ name: 'empty.xlsx', size: 0 })
  assert.equal(emptyFile.isValid, false)
  assert.match(emptyFile.error, /0 byte/i)

  // 5. Rejects file exceeding 10MB
  const oversizedFile = validateSpreadsheetFile({
    name: 'heavy.xlsx',
    size: 10 * 1024 * 1024 + 1,
  })
  assert.equal(oversizedFile.isValid, false)
  assert.match(oversizedFile.error, /vượt quá giới hạn tối đa/i)

  // 6. Accepts valid .xlsx within size limit
  const validXlsx = validateSpreadsheetFile({
    name: 'Danh_sach_benh_nhan_2026.xlsx',
    size: 500 * 1024,
  })
  assert.equal(validXlsx.isValid, true)
  assert.equal(validXlsx.error, null)

  // 7. Accepts valid .xls within size limit
  const validXls = validateSpreadsheetFile({
    name: 'benh_nhan_cu.xls',
    size: 2 * 1024 * 1024,
  })
  assert.equal(validXls.isValid, true)
  assert.equal(validXls.error, null)
})

test('Patient Import - formatFileSize helper', () => {
  assert.equal(formatFileSize(null), '—')
  assert.equal(formatFileSize(undefined), '—')
  assert.equal(formatFileSize(0), '0 B')
  assert.equal(formatFileSize(512), '512 B')
  assert.equal(formatFileSize(2048), '2.0 KB')
  assert.equal(formatFileSize(5 * 1024 * 1024), '5.00 MB')
})

test('Patient Import - formatDateTime helper', () => {
  assert.equal(formatDateTime(null), '—')
  assert.equal(formatDateTime('invalid-date'), '—')

  // Fixed test date: 2026-09-23T14:30:45
  const d = new Date(2026, 8, 23, 14, 30, 45) // month is 0-indexed: 8 is September
  const formatted = formatDateTime(d)
  assert.match(formatted, /^23\/09\/2026 14:30:45$/)
})

test('Patient Import - exportErrorsToCsv with UTF-8 BOM', () => {
  const errors = [
    {
      rowNumber: 5,
      errorField: 'Họ và tên',
      errorMessage: 'Dòng 5: Thiếu họ tên bệnh nhân',
      rawData: '; 1990-01-01; Nữ',
    },
    {
      rowNumber: 12,
      errorField: 'Ngày sinh',
      errorMessage: 'Dòng 12: Sai định dạng ngày sinh "31/02/1985"',
      rawData: 'Nguyễn Văn B; 31/02/1985',
    },
  ]

  const csvResult = exportErrorsToCsv(errors, 'test_export.xlsx')

  // Must begin with UTF-8 BOM (\uFEFF)
  assert.ok(csvResult.startsWith('\uFEFF'), 'CSV must contain UTF-8 BOM for Microsoft Excel')

  // Must include header columns
  assert.ok(csvResult.includes('"STT Dòng Trong Tệp","Trường Bị Lỗi","Chi Tiết Lý Do Lỗi","Dữ Liệu Dòng Gốc"'))

  // Must contain row details and Vietnamese diacritics
  assert.ok(csvResult.includes('"5","Họ và tên","Dòng 5: Thiếu họ tên bệnh nhân"'))
  assert.ok(csvResult.includes('"12","Ngày sinh","Dòng 12: Sai định dạng ngày sinh ""31/02/1985"""'))
})

test('Patient Import - getSamplePreviewData structure and 3-group separation', () => {
  const sample = getSamplePreviewData()

  assert.equal(sample.isDemo, true)
  assert.ok(sample.demoNote.includes('không phải dữ liệu bệnh nhân thật'))

  // Total count matches sum of 3 groups
  assert.equal(sample.totalRows, sample.validCount + sample.errorCount + sample.duplicateCount)
  assert.equal(sample.validRows.length, sample.validCount)
  assert.equal(sample.errors.length, sample.errorCount)
  assert.equal(sample.suspectedDuplicates.length, sample.duplicateCount)

  // Verify group (a): valid records have required fields
  const firstValid = sample.validRows[0]
  assert.ok(firstValid.fullName)
  assert.ok(firstValid.dateOfBirth)
  assert.ok(firstValid.gender)

  // Verify group (b): errors have row number, field, and clear actionable reason
  const firstError = sample.errors[0]
  assert.equal(firstError.rowNumber, 5)
  assert.equal(firstError.errorField, 'Họ và tên')
  assert.match(firstError.errorMessage, /thiếu họ tên/i)

  // Verify group (c): duplicate candidates have matched existing patient details and reason
  const firstDup = sample.suspectedDuplicates[0]
  assert.equal(firstDup.rowNumber, 8)
  assert.ok(firstDup.matchedExistingPatientCode)
  assert.match(firstDup.duplicateReason, /trùng khớp/i)
  assert.equal(firstDup.actionChoice, 'SKIP')
})

test('Patient Import - getSampleImportResult generator', () => {
  const result = getSampleImportResult(5, 2, 3)

  assert.equal(result.successCount, 5)
  assert.equal(result.duplicateCount, 2)
  assert.equal(result.errorCount, 3)
  assert.equal(result.totalRows, 10)
  assert.equal(result.createdPatientCodes.length, 5)
  assert.ok(result.createdPatientCodes[0].startsWith('BN-'))
})

test('Patient Import - Navigation permissions for Receptionist & Admin', () => {
  // 1. Receptionist with PATIENT_IMPORT sees /patients/import
  const recepWithPerm = getNavigationItems(['ROLE_RECEPTIONIST'], ['PATIENT_IMPORT', 'PATIENT_READ'])
  assert.equal(
    recepWithPerm.some((item) => item.key === '/patients/import'),
    true,
    'Receptionist with PATIENT_IMPORT must see /patients/import menu'
  )

  // 2. Admin sees /patients/import
  const adminNav = getNavigationItems(['ROLE_ADMIN'], [])
  assert.equal(
    adminNav.some((item) => item.key === '/patients/import'),
    true,
    'Admin must see /patients/import menu'
  )

  // 3. Doctor does not see /patients/import
  const docNav = getNavigationItems(['ROLE_DOCTOR'], ['MEDICAL_RECORD_READ'])
  assert.equal(
    docNav.some((item) => item.key === '/patients/import'),
    false,
    'Doctor must NOT see /patients/import menu'
  )

  // 4. Pharmacist does not see /patients/import
  const pharmNav = getNavigationItems(['ROLE_PHARMACIST'], ['PHARMACY_READ'])
  assert.equal(
    pharmNav.some((item) => item.key === '/patients/import'),
    false,
    'Pharmacist must NOT see /patients/import menu'
  )
})

test('Patient Import - generateExcelTemplateBlob generates valid 15-column spreadsheet', async () => {
  const { generateExcelTemplateBlob, parseAndValidateSpreadsheet } = await import('../../utils/patientImportHelpers.js')
  const blob = generateExcelTemplateBlob()

  assert.ok(blob, 'Blob must be created')
  assert.ok(blob.size > 0, 'Blob size must be positive')
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

  const arrayBuffer = await blob.arrayBuffer()
  const parsed = await parseAndValidateSpreadsheet(arrayBuffer)

  assert.equal(parsed.isEmpty, false)
  assert.equal(parsed.totalRows, 2)
  assert.equal(parsed.validCount, 2)
  assert.equal(parsed.errorCount, 0)
  assert.equal(parsed.duplicateCount, 0)
  assert.equal(parsed.validRows[0].fullName, 'Nguyễn Văn An')
  assert.equal(parsed.validRows[1].fullName, 'Nguyễn Minh Khang')
})

test('Patient Import - parseAndValidateSpreadsheet handles empty template with guidance error', async () => {
  const { parseAndValidateSpreadsheet } = await import('../../utils/patientImportHelpers.js')
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([['Họ và tên (*)', 'Ngày sinh (*)', 'Giới tính (*)']])
  XLSX.utils.book_append_sheet(wb, ws, 'EmptySheet')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const result = await parseAndValidateSpreadsheet(buffer)

  assert.equal(result.isEmpty, true)
  assert.equal(result.totalRows, 0)
  assert.match(result.error, /chưa có dòng dữ liệu.*dòng số 2/i)
})

test('Patient Import - parseAndValidateSpreadsheet validates fields and flags errors properly', async () => {
  const { parseAndValidateSpreadsheet } = await import('../../utils/patientImportHelpers.js')
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const rows = [
    ['Họ và tên (*)', 'Ngày sinh (*)', 'Giới tính (*)', 'Số điện thoại', 'Số CCCD/CMND'],
    ['', '15/05/1990', 'Nam', '0912345678', ''], // Missing full name
    ['Lê Văn B', '31/02/1990', 'Nam', '0912345678', ''], // Invalid calendar date
    ['Bé C', '01/01/2020', 'Nam', '', ''], // Minor (<18) missing guardian
    ['Trần D', '01/01/1995', 'Nam', '0912345678', '001095123456'], // Valid
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'ValidationSheet')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const result = await parseAndValidateSpreadsheet(buffer)

  assert.equal(result.totalRows, 4)
  assert.equal(result.validCount, 1)
  assert.equal(result.errorCount, 3)
  assert.equal(result.validRows[0].fullName, 'Trần D')
  assert.equal(result.errors[0].errorField, 'Họ và tên')
  assert.equal(result.errors[1].errorField, 'Ngày sinh')
  assert.equal(result.errors[2].errorField, 'Người giám hộ')
})

test('Patient Import - parseAndValidateSpreadsheet identifies intra-file and database duplicates', async () => {
  const { parseAndValidateSpreadsheet } = await import('../../utils/patientImportHelpers.js')
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const rows = [
    ['Họ và tên (*)', 'Ngày sinh (*)', 'Giới tính (*)', 'Số điện thoại', 'Số CCCD/CMND'],
    ['Nguyễn Văn A', '01/01/1990', 'Nam', '0912345678', '001090123456'],
    ['Nguyễn Văn A (trùng CCCD)', '02/02/1992', 'Nam', '0987654321', '001090123456'],
    ['Nguyễn Văn B (trùng DB)', '05/05/1985', 'Nam', '0933333333', '001085999999'],
  ]
  const existingPatients = [
    { patientCode: 'BN-00010', fullName: 'Nguyễn Văn B', dateOfBirth: '1985-05-05', phone: '0933333333' },
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'DupSheet')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const result = await parseAndValidateSpreadsheet(buffer, existingPatients)

  assert.equal(result.duplicateCount, 2)
  assert.match(result.suspectedDuplicates[0].duplicateReason, /cùng tệp/i)
  assert.match(result.suspectedDuplicates[1].duplicateReason, /BN-00010/i)
})

test('Patient Import - parseAndValidateSpreadsheet restores leading zero for numeric phone and CCCD', async () => {
  const { parseAndValidateSpreadsheet } = await import('../utils/patientImportHelpers.js')
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const rows = [
    ['Họ và tên (*)', 'Ngày sinh (*)', 'Giới tính (*)', 'Số điện thoại', 'Số CCCD/CMND'],
    // Phone 345678910 (number without leading 0) and CCCD 1088012346 (number without leading 00)
    ['Nguyễn Văn Tuấn', '15/05/2005', 'Nam', 345678910, 1088012346],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'NumSheet')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const result = await parseAndValidateSpreadsheet(buffer)

  assert.equal(result.totalRows, 1)
  assert.equal(result.errorCount, 0)
  assert.equal(result.validCount, 1)
  assert.equal(result.validRows[0].phone, '0345678910')
  assert.equal(result.validRows[0].identityNumber, '001088012346')
})


