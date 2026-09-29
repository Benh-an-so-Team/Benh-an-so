import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import documentPrintTemplateApi from '../../api/documentPrintTemplateApi.js'
import { getNavigationItems } from '../../components/layout/navigationConfig.js'
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  MAX_LOGO_SIZE_BYTES,
  ALLOWED_LOGO_TYPES,
  validateLogoFile,
  parseFieldVisibility,
  serializeFieldVisibility,
  buildDefaultTemplateValues,
  compareTemplateDiff,
  DOCUMENT_FIELDS,
} from '../../utils/documentPrintTemplateHelpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '../../..')

test('TC-DPT-01: documentPrintTemplateApi cung cấp đầy đủ các endpoint theo hợp đồng backend', () => {
  assert.equal(typeof documentPrintTemplateApi.getAll, 'function')
  assert.equal(typeof documentPrintTemplateApi.getByType, 'function')
  assert.equal(typeof documentPrintTemplateApi.update, 'function')
  assert.equal(typeof documentPrintTemplateApi.previewPdf, 'function')
  assert.equal(typeof documentPrintTemplateApi.getAuditHistory, 'function')
  assert.equal(typeof documentPrintTemplateApi.uploadLogo, 'function')
})

test('TC-DPT-02: Phân quyền menu: Chỉ Quản trị viên (Admin) mới thấy menu Cấu hình mẫu in chứng từ', () => {
  // Admin được thấy menu
  const adminItems = getNavigationItems(['admin'], [])
  const hasPrintMenuAdmin = adminItems.some((item) => item.key === '/system/print-templates')
  assert.equal(hasPrintMenuAdmin, true, 'Quản trị viên (admin) bắt buộc phải thấy menu Cấu hình mẫu in chứng từ')

  // Bác sĩ KHÔNG thấy
  const doctorItems = getNavigationItems(['doctor'], [])
  const hasPrintMenuDoctor = doctorItems.some((item) => item.key === '/system/print-templates')
  assert.equal(hasPrintMenuDoctor, false, 'Bác sĩ không được thấy menu Cấu hình mẫu in chứng từ')

  // Lễ tân KHÔNG thấy
  const recepItems = getNavigationItems(['receptionist'], [])
  const hasPrintMenuRecep = recepItems.some((item) => item.key === '/system/print-templates')
  assert.equal(hasPrintMenuRecep, false, 'Lễ tân không được thấy menu Cấu hình mẫu in chứng từ')

  // Dược sĩ KHÔNG thấy
  const pharmacistItems = getNavigationItems(['pharmacist'], [])
  const hasPrintMenuPharm = pharmacistItems.some((item) => item.key === '/system/print-templates')
  assert.equal(hasPrintMenuPharm, false, 'Dược sĩ không được thấy menu Cấu hình mẫu in chứng từ')

  // Thu ngân KHÔNG thấy
  const cashierItems = getNavigationItems(['cashier'], [])
  const hasPrintMenuCashier = cashierItems.some((item) => item.key === '/system/print-templates')
  assert.equal(hasPrintMenuCashier, false, 'Thu ngân không được thấy menu Cấu hình mẫu in chứng từ')
})

test('TC-DPT-03: AppRoutes.jsx đăng ký route /system/print-templates và bảo vệ nghiêm ngặt quyền admin', () => {
  const appRoutesContent = fs.readFileSync(
    path.join(frontendDir, 'src/routes/AppRoutes.jsx'),
    'utf-8',
  )

  assert.ok(
    appRoutesContent.includes('DocumentPrintTemplatePage'),
    'AppRoutes.jsx phải lazy import DocumentPrintTemplatePage',
  )
  assert.ok(
    appRoutesContent.includes('path="system/print-templates"'),
    'AppRoutes.jsx phải cấu hình đường dẫn system/print-templates',
  )
  assert.ok(
    appRoutesContent.includes("allowedRoles={['admin']}"),
    'Route /system/print-templates phải được bọc trong PrivateRoute chỉ cho phép admin',
  )
  assert.ok(
    appRoutesContent.includes('path="print-templates"'),
    'AppRoutes.jsx phải hỗ trợ redirect từ print-templates sang /system/print-templates',
  )
})

test('TC-DPT-04: Kiểm tra validateLogoFile - định dạng hợp lệ và giới hạn kích thước 2MB', () => {
  // Không chọn tệp
  const emptyCheck = validateLogoFile(null)
  assert.equal(emptyCheck.isValid, false)
  assert.ok(emptyCheck.error.includes('Vui lòng chọn tệp ảnh logo'))

  // Định dạng không được phép (PDF, GIF, TXT)
  const pdfFile = { name: 'document.pdf', type: 'application/pdf', size: 100 * 1024 }
  const gifFile = { name: 'animation.gif', type: 'image/gif', size: 200 * 1024 }
  assert.equal(validateLogoFile(pdfFile).isValid, false)
  assert.equal(validateLogoFile(gifFile).isValid, false)
  assert.ok(validateLogoFile(pdfFile).error.includes('Định dạng ảnh không hợp lệ'))

  // Dung lượng vượt quá 2MB
  const oversizedFile = { name: 'logo-large.png', type: 'image/png', size: 2.5 * 1024 * 1024 }
  const oversizeCheck = validateLogoFile(oversizedFile)
  assert.equal(oversizeCheck.isValid, false)
  assert.ok(oversizeCheck.error.includes('vượt quá giới hạn tối đa cho phép (2MB)'))

  // Tệp hợp lệ (PNG, JPG, SVG, WEBP <= 2MB)
  const validPng = { name: 'clinic-logo.png', type: 'image/png', size: 500 * 1024 }
  const validJpg = { name: 'clinic-logo.jpg', type: 'image/jpeg', size: 1024 * 1024 }
  const validSvg = { name: 'clinic-logo.svg', type: 'image/svg+xml', size: 50 * 1024 }
  const validWebp = { name: 'clinic-logo.webp', type: 'image/webp', size: 800 * 1024 }

  assert.equal(validateLogoFile(validPng).isValid, true)
  assert.equal(validateLogoFile(validJpg).isValid, true)
  assert.equal(validateLogoFile(validSvg).isValid, true)
  assert.equal(validateLogoFile(validWebp).isValid, true)
})

test('TC-DPT-05: parseFieldVisibility và serializeFieldVisibility xử lý chính xác JSON và toggle', () => {
  const docType = DOCUMENT_TYPES.PRESCRIPTION
  const allFields = DOCUMENT_FIELDS[docType]

  // Mặc định khi chưa có dữ liệu JSON
  const defaultVisibility = parseFieldVisibility(null, docType)
  allFields.forEach((field) => {
    assert.equal(defaultVisibility[field.key], true, `Mặc định trường ${field.key} phải là true`)
  })

  // Khi có một số trường bị tắt (false)
  const customJson = JSON.stringify({
    showDoctorSignature: false,
    showBarcode: false,
    showDiagnosis: true,
  })
  const parsed = parseFieldVisibility(customJson, docType)
  assert.equal(parsed.showDoctorSignature, false)
  assert.equal(parsed.showBarcode, false)
  assert.equal(parsed.showDiagnosis, true)
  assert.equal(parsed.showPatientPhone, true) // fallback default true

  // Serialize lại thành chuỗi
  const serialized = serializeFieldVisibility(parsed)
  assert.ok(serialized.includes('"showDoctorSignature":false'))
  assert.ok(serialized.includes('"showBarcode":false'))
})

test('TC-DPT-06: buildDefaultTemplateValues kế thừa đúng thông tin phòng khám và thiết lập giá trị chuẩn', () => {
  const clinicConfig = {
    clinicName: 'Phòng khám Đa khoa Ánh Sáng',
    address: '456 Lê Lợi, TP. Đà Nẵng',
    phone: '0905 123 456',
    openingTime: '07:00',
    closingTime: '20:00',
  }

  // Đơn thuốc
  const rxTemplate = buildDefaultTemplateValues(DOCUMENT_TYPES.PRESCRIPTION, clinicConfig)
  assert.equal(rxTemplate.documentType, DOCUMENT_TYPES.PRESCRIPTION)
  assert.equal(rxTemplate.title, 'ĐƠN THUỐC')
  assert.ok(rxTemplate.legalInfo.includes('Phòng khám Đa khoa Ánh Sáng'))
  assert.ok(rxTemplate.legalInfo.includes('456 Lê Lợi, TP. Đà Nẵng'))
  assert.ok(rxTemplate.legalInfo.includes('0905 123 456'))
  assert.ok(rxTemplate.legalInfo.includes('07:00 - 20:00'))
  assert.ok(rxTemplate.footerText.includes('Đơn thuốc có giá trị mua'))

  // Hóa đơn
  const invTemplate = buildDefaultTemplateValues(DOCUMENT_TYPES.INVOICE, clinicConfig)
  assert.equal(invTemplate.documentType, DOCUMENT_TYPES.INVOICE)
  assert.equal(invTemplate.title, 'HÓA ĐƠN THU TIỀN KHÁM CHỮA BỆNH')
  assert.ok(invTemplate.footerText.includes('Cảm ơn Quý khách'))

  // Phiếu khám
  const visitTemplate = buildDefaultTemplateValues(DOCUMENT_TYPES.VISIT_SUMMARY, clinicConfig)
  assert.equal(visitTemplate.documentType, DOCUMENT_TYPES.VISIT_SUMMARY)
  assert.equal(visitTemplate.title, 'PHIẾU TỔNG KẾT LƯỢT KHÁM')
})

test('TC-DPT-07: compareTemplateDiff so sánh chuẩn xác giá trị trước và sau khi thay đổi', () => {
  const before = {
    templateName: 'Mẫu cũ',
    title: 'ĐƠN THUỐC CŨ',
    showLogo: true,
    logoUrl: 'https://example.com/old-logo.png',
    legalInfo: 'Địa chỉ cũ',
    footerText: 'Chân trang cũ',
    fieldVisibility: { showBarcode: true, showDoctorSignature: true },
  }

  const after = {
    templateName: 'Mẫu mới cập nhật',
    title: 'ĐƠN THUỐC ĐIỆN TỬ',
    showLogo: false,
    logoUrl: 'https://example.com/new-logo.png',
    legalInfo: 'Địa chỉ cũ', // Giữ nguyên
    footerText: 'Chân trang mới',
    fieldVisibility: { showBarcode: false, showDoctorSignature: true },
  }

  const diffs = compareTemplateDiff(before, after)

  // Trường không đổi (legalInfo) không được nằm trong diff
  assert.equal(diffs.some((d) => d.field === 'legalInfo'), false)

  // Các trường thay đổi phải có chi tiết
  const nameDiff = diffs.find((d) => d.field === 'templateName')
  assert.ok(nameDiff)
  assert.equal(nameDiff.beforeVal, 'Mẫu cũ')
  assert.equal(nameDiff.afterVal, 'Mẫu mới cập nhật')

  const logoDiff = diffs.find((d) => d.field === 'showLogo')
  assert.ok(logoDiff)
  assert.equal(logoDiff.beforeVal, 'Có bật')
  assert.equal(logoDiff.afterVal, 'Tắt')

  const fieldDiff = diffs.find((d) => d.field === 'fieldVisibility')
  assert.ok(fieldDiff)
  assert.ok(fieldDiff.beforeVal.includes('"showBarcode":true'))
  assert.ok(fieldDiff.afterVal.includes('"showBarcode":false'))
})

test('TC-DPT-08: DocumentPrintTemplatePage.jsx đáp ứng đầy đủ yêu cầu nghiệp vụ và cấu trúc màn hình', () => {
  const pageContent = fs.readFileSync(
    path.join(frontendDir, 'src/pages/DocumentPrintTemplatePage.jsx'),
    'utf-8',
  )

  // Bố cục 2 cột Form và Live Preview
  assert.ok(
    pageContent.includes('print-template-form-col') && pageContent.includes('print-template-preview-col'),
    'Giao diện phải có cấu trúc 2 cột: Cột trái form cấu hình, cột phải live preview',
  )

  // Watermark minh họa dữ liệu mẫu
  assert.ok(
    pageContent.includes('DỮ LIỆU MẪU MINH HỌA'),
    'Khung xem trước phải đánh dấu rõ watermark DỮ LIỆU MẪU MINH HỌA',
  )

  // Cảnh báo phạm vi ảnh hưởng khi áp dụng mẫu
  assert.ok(
    pageContent.includes('MỌI lần in sau đó') ||
    pageContent.includes('in lại chứng từ cũ') ||
    pageContent.includes('bao gồm in lại chứng từ cũ'),
    'Phải có cảnh báo rõ ràng về việc mẫu in mới có hiệu lực ngay cho toàn bộ các lần in sau đó',
  )

  // Xác nhận lưu với Popconfirm
  assert.ok(
    pageContent.includes('Popconfirm'),
    'Thao tác Áp dụng mẫu phải có Popconfirm xác nhận cẩn trọng',
  )

  // Tab Lịch sử thay đổi mẫu in
  assert.ok(
    pageContent.includes('Lịch sử thay đổi mẫu in'),
    'Phải có tab/mục Lịch sử thay đổi mẫu in',
  )

  // Xử lý cảnh báo khi rời trang có thay đổi chưa lưu
  assert.ok(
    pageContent.includes('beforeunload') || pageContent.includes('isDirty'),
    'Phải có cơ chế phát hiện thay đổi chưa áp dụng để nhắc người dùng trước khi rời trang',
  )
})

test('TC-DPT-09: Khắc phục triệt để lỗi console và validation (CONFIGURATION & App.useApp)', () => {
  const apiFileContent = fs.readFileSync(
    path.join(frontendDir, 'src/api/documentPrintTemplateApi.js'),
    'utf-8',
  )
  assert.ok(
    apiFileContent.includes("resourceType: 'CONFIGURATION'"),
    'documentPrintTemplateApi phải dùng resourceType: CONFIGURATION khớp với enum backend',
  )
  assert.equal(
    apiFileContent.includes("resourceType: 'SYSTEM_CONFIG'"),
    false,
    'documentPrintTemplateApi không được dùng SYSTEM_CONFIG vì gây lỗi 400',
  )

  const pageContent = fs.readFileSync(
    path.join(frontendDir, 'src/pages/DocumentPrintTemplatePage.jsx'),
    'utf-8',
  )
  assert.ok(
    pageContent.includes('App.useApp()'),
    'DocumentPrintTemplatePage phải dùng App.useApp() để loại bỏ warning antd message/Modal',
  )
  assert.ok(
    pageContent.includes("current.logoUrl.startsWith('data:')"),
    'DocumentPrintTemplatePage phải chặn dữ liệu Base64 thô trước khi gửi PUT lên backend',
  )
  assert.ok(
    pageContent.includes('current.logoUrl.length > 1000'),
    'DocumentPrintTemplatePage phải kiểm tra giới hạn 1000 ký tự cho logoUrl',
  )
})

