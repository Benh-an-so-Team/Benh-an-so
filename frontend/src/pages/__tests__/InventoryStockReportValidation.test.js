import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateDateRange,
  validateClosingBalance,
  formatQuantity,
  extractFilenameFromHeader,
  calculateStockSummary,
  getInventoryStockReportErrorMessage,
  MAX_REPORT_RANGE_DAYS,
} from '../../utils/inventoryStockReportHelpers.js'
import { getNavigationItems } from '../../components/layout/navigationConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('TC01 - validateDateRange: Chặn khi thiếu ngày bắt đầu hoặc ngày kết thúc', () => {
  const res1 = validateDateRange(null, '2026-08-31')
  assert.equal(res1.valid, false)
  assert.equal(res1.error, 'Vui lòng chọn khoảng thời gian báo cáo.')

  const res2 = validateDateRange('2026-08-01', undefined)
  assert.equal(res2.valid, false)
  assert.equal(res2.error, 'Vui lòng chọn khoảng thời gian báo cáo.')

  const res3 = validateDateRange('', '')
  assert.equal(res3.valid, false)
  assert.equal(res3.error, 'Vui lòng chọn khoảng thời gian báo cáo.')
})

test('TC02 - validateDateRange: Chặn khi chuỗi ngày không hợp lệ', () => {
  const res = validateDateRange('invalid-date', '2026-08-31')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Khoảng thời gian không hợp lệ. Vui lòng kiểm tra lại.')
})

test('TC03 - validateDateRange: Chặn khi ngày bắt đầu lớn hơn ngày kết thúc (from > to)', () => {
  const res = validateDateRange('2026-09-01', '2026-08-01')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Ngày bắt đầu không được lớn hơn ngày kết thúc.')
})

test('TC04 - validateDateRange: Chặn khi khoảng thời gian vượt quá 366 ngày', () => {
  const res = validateDateRange('2025-01-01', '2026-01-02')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Khoảng thời gian báo cáo không được vượt quá 366 ngày.')
})

test('TC05 - validateDateRange: Cho phép khoảng thời gian hợp lệ và mốc tối đa 366 ngày', () => {
  const res366 = validateDateRange('2025-01-01', '2026-01-01')
  assert.equal(res366.valid, true)
  assert.equal(res366.error, '')
  assert.equal(res366.from, '2025-01-01')
  assert.equal(res366.to, '2026-01-01')
  assert.equal(res366.inclusiveDays, 366)

  const resMonth = validateDateRange('2026-08-01', '2026-08-31')
  assert.equal(resMonth.valid, true)
  assert.equal(resMonth.error, '')
  assert.equal(resMonth.inclusiveDays, 31)
})

test('TC06 - validateClosingBalance: Khớp công thức cân đối kho chuẩn mực', () => {
  // 100 + 20 - 30 + 5 + (-2) = 93
  const itemBalanced = {
    medicineCode: 'MED-001',
    medicineName: 'Paracetamol',
    openingQuantity: 100,
    receivedQuantity: 20,
    dispensedQuantity: 30,
    returnedQuantity: 5,
    adjustedQuantity: -2,
    closingQuantity: 93,
  }

  const res = validateClosingBalance(itemBalanced)
  assert.equal(res.hasDiscrepancy, false)
  assert.equal(res.expectedClosing, 93)
  assert.equal(res.actualClosing, 93)
  assert.equal(res.difference, 0)
})

test('TC07 - validateClosingBalance: Phát hiện chính xác khi số liệu bị sai lệch công thức', () => {
  // Kỳ vọng là 93 nhưng dữ liệu backend/mock cố tình bị lệch thành 90
  const itemDiscrepant = {
    medicineCode: 'MED-002',
    medicineName: 'Amoxicillin',
    openingQuantity: 100,
    receivedQuantity: 20,
    dispensedQuantity: 30,
    returnedQuantity: 5,
    adjustedQuantity: -2,
    closingQuantity: 90, // Bị lệch -3
  }

  const res = validateClosingBalance(itemDiscrepant)
  assert.equal(res.hasDiscrepancy, true)
  assert.equal(res.expectedClosing, 93)
  assert.equal(res.actualClosing, 90)
  assert.equal(res.difference, -3)
})

test('TC08 - validateClosingBalance: Xử lý an toàn khi item rỗng hoặc null', () => {
  const res = validateClosingBalance(null)
  assert.equal(res.hasDiscrepancy, false)
  assert.equal(res.expectedClosing, 0)
  assert.equal(res.actualClosing, 0)
})

test('TC09 - formatQuantity: Định dạng số lượng và hiển thị dấu +/- rõ ràng', () => {
  assert.equal(formatQuantity(1500), '1.500')
  assert.equal(formatQuantity(0), '0')
  assert.equal(formatQuantity(null), '0')

  // Có cờ showSign
  assert.equal(formatQuantity(15, { showSign: true }), '+15')
  assert.equal(formatQuantity(-15, { showSign: true }), '-15')
  assert.equal(formatQuantity(0, { showSign: true }), '0')
})

test('TC10 - extractFilenameFromHeader: Trích xuất tên file CSV từ Content-Disposition', () => {
  const header = 'attachment; filename="stock-in-out-report-2026-08-01-to-2026-08-31.csv"'
  assert.equal(
    extractFilenameFromHeader(header),
    'stock-in-out-report-2026-08-01-to-2026-08-31.csv'
  )

  const fallback = extractFilenameFromHeader(null, 'default.csv')
  assert.equal(fallback, 'default.csv')
})

test('TC11 - calculateStockSummary: Tính toán tổng hợp số liệu toàn kỳ chính xác', () => {
  const items = [
    {
      openingQuantity: 100,
      receivedQuantity: 20,
      dispensedQuantity: 30,
      returnedQuantity: 5,
      adjustedQuantity: -2,
      closingQuantity: 93,
    },
    {
      openingQuantity: 50,
      receivedQuantity: 10,
      dispensedQuantity: 15,
      returnedQuantity: 0,
      adjustedQuantity: 0,
      closingQuantity: 45,
    },
  ]

  const summary = calculateStockSummary(items)
  assert.equal(summary.totalMedicines, 2)
  assert.equal(summary.totalOpening, 150)
  assert.equal(summary.totalReceived, 30)
  assert.equal(summary.totalDispensed, 45)
  assert.equal(summary.totalReturned, 5)
  assert.equal(summary.totalAdjusted, -2)
  assert.equal(summary.totalClosing, 138)
  assert.equal(summary.discrepancyCount, 0)
  assert.equal(summary.hasAnyDiscrepancy, false)
})

test('TC12 - calculateStockSummary: Đếm đúng số lượng thuốc bị sai lệch công thức', () => {
  const items = [
    {
      openingQuantity: 100,
      receivedQuantity: 20,
      dispensedQuantity: 30,
      returnedQuantity: 5,
      adjustedQuantity: -2,
      closingQuantity: 90, // Lệch
    },
    {
      openingQuantity: 50,
      receivedQuantity: 10,
      dispensedQuantity: 15,
      returnedQuantity: 0,
      adjustedQuantity: 0,
      closingQuantity: 45, // Đúng
    },
  ]

  const summary = calculateStockSummary(items)
  assert.equal(summary.discrepancyCount, 1)
  assert.equal(summary.hasAnyDiscrepancy, true)
})

test('TC13 - calculateStockSummary: Xử lý kỳ trống (items = [])', () => {
  const summary = calculateStockSummary([])
  assert.equal(summary.totalMedicines, 0)
  assert.equal(summary.totalOpening, 0)
  assert.equal(summary.totalClosing, 0)
  assert.equal(summary.discrepancyCount, 0)
  assert.equal(summary.hasAnyDiscrepancy, false)
})

test('TC14 - getInventoryStockReportErrorMessage: Ánh xạ chuẩn mực các mã lỗi HTTP', () => {
  const err366 = { response: { status: 400, data: { message: 'Date range must not exceed 366 days.' } } }
  assert.equal(
    getInventoryStockReportErrorMessage(err366),
    'Khoảng thời gian không hợp lệ. Khoảng cách giữa hai ngày tối đa là 366 ngày.'
  )

  const errBefore = { response: { status: 400, data: { message: 'from must be before or equal to to.' } } }
  assert.equal(
    getInventoryStockReportErrorMessage(errBefore),
    'Ngày bắt đầu không được lớn hơn ngày kết thúc.'
  )

  const errMissing = { response: { status: 400, data: { code: 'MISSING_PARAMETER' } } }
  assert.equal(
    getInventoryStockReportErrorMessage(errMissing),
    'Vui lòng chọn đầy đủ khoảng thời gian báo cáo.'
  )

  const err403 = { response: { status: 403 } }
  assert.equal(
    getInventoryStockReportErrorMessage(err403),
    'Bạn không có quyền xem báo cáo xuất nhập tồn kho dược.'
  )

  const err401 = { response: { status: 401 } }
  assert.equal(
    getInventoryStockReportErrorMessage(err401),
    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  )

  const err500 = { response: { status: 500 } }
  assert.equal(
    getInventoryStockReportErrorMessage(err500),
    'Không thể tải báo cáo xuất nhập tồn. Vui lòng thử lại sau.'
  )
})

test('TC15 - Phân quyền Navigation: Hiển thị cho Pharmacist, Manager, Admin; Chặn Doctor, Receptionist', () => {
  const pharmNav = getNavigationItems(['ROLE_PHARMACIST'], ['PHARMACY_READ'])
  assert.equal(pharmNav.some((i) => i.key === '/inventory/stock-report'), true, 'Dược sĩ phải thấy menu')

  const mgrNav = getNavigationItems(['ROLE_MANAGER'], [])
  assert.equal(mgrNav.some((i) => i.key === '/inventory/stock-report'), true, 'Quản lý phải thấy menu')

  const adminNav = getNavigationItems(['ROLE_ADMIN'], [])
  assert.equal(adminNav.some((i) => i.key === '/inventory/stock-report'), true, 'Quản trị viên phải thấy menu')

  const docNav = getNavigationItems(['ROLE_DOCTOR'], ['MEDICAL_RECORD_READ'])
  assert.equal(docNav.some((i) => i.key === '/inventory/stock-report'), false, 'Bác sĩ không được thấy menu')

  const recepNav = getNavigationItems(['ROLE_RECEPTIONIST'], ['PATIENT_READ'])
  assert.equal(recepNav.some((i) => i.key === '/inventory/stock-report'), false, 'Lễ tân không được thấy menu')
})

test('TC16 - Route Security: AppRoutes.jsx đăng ký /inventory/stock-report và TUYỆT ĐỐI KHÔNG DÙNG disallowAdmin', () => {
  const appRoutesPath = path.resolve(__dirname, '../../routes/AppRoutes.jsx')
  const content = fs.readFileSync(appRoutesPath, 'utf8')

  // Xác nhận route tồn tại
  assert.equal(
    content.includes('path="inventory/stock-report"'),
    true,
    'AppRoutes phải cấu hình route inventory/stock-report'
  )

  // Tách dòng định nghĩa route để kiểm tra không có disallowAdmin
  const routeLine = content.split('\n').find((line) => line.includes('path="inventory/stock-report"')) || ''
  assert.equal(
    routeLine.includes('disallowAdmin'),
    false,
    'Route inventory/stock-report TUYỆT ĐỐI KHÔNG ĐƯỢC dùng disallowAdmin (Admin có quyền xem)'
  )

  // Kiểm tra quyền INVENTORY_REPORT_VIEW
  assert.equal(
    routeLine.includes('INVENTORY_REPORT_VIEW'),
    true,
    'Route phải yêu cầu quyền INVENTORY_REPORT_VIEW'
  )
})

test('TC17 - Tích hợp ReportsPage: Tab inventory-stock được khai báo trong VALID_TABS', () => {
  const reportsPagePath = path.resolve(__dirname, '../ReportsPage.jsx')
  const content = fs.readFileSync(reportsPagePath, 'utf8')

  assert.equal(
    content.includes("'inventory-stock'"),
    true,
    'ReportsPage phải khai báo tab inventory-stock trong VALID_TABS'
  )
  assert.equal(
    content.includes('InventoryStockReportPage'),
    true,
    'ReportsPage phải import và render InventoryStockReportPage'
  )
})

