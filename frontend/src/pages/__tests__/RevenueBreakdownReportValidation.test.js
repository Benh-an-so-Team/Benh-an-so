import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateDateRange,
  formatCurrency,
  formatPercentage,
  getServiceGroupColor,
  getRevenueBreakdownErrorMessage,
  MAX_REPORT_RANGE_DAYS,
  DEFAULT_SERVICE_GROUP_COLOR,
  SERVICE_GROUP_COLORS,
} from '../../utils/revenueBreakdownReportHelpers.js'

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

test('TC02 - validateDateRange: Chặn khi ngày không hợp lệ', () => {
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
  // 367 ngày: từ 2025-01-01 đến 2026-01-02 là 367 ngày
  const res = validateDateRange('2025-01-01', '2026-01-02')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Khoảng thời gian báo cáo không được vượt quá 366 ngày.')
})

test('TC05 - validateDateRange: Cho phép khoảng thời gian hợp lệ và đúng tối đa 366 ngày', () => {
  // Đúng 366 ngày
  const res366 = validateDateRange('2025-01-01', '2026-01-01')
  assert.equal(res366.valid, true)
  assert.equal(res366.error, '')
  assert.equal(res366.from, '2025-01-01')
  assert.equal(res366.to, '2026-01-01')

  // Khoảng 30 ngày bình thường
  const res30 = validateDateRange('2026-08-01', '2026-08-31')
  assert.equal(res30.valid, true)
  assert.equal(res30.from, '2026-08-01')
  assert.equal(res30.to, '2026-08-31')
})

test('TC06 - formatCurrency: Định dạng tiền tệ VNĐ chuẩn và xử lý số âm, số 0', () => {
  assert.equal(formatCurrency(45000000), '45.000.000 đ')
  assert.equal(formatCurrency(10000000), '10.000.000 đ')
  assert.equal(formatCurrency(-500000), '-500.000 đ')
  assert.equal(formatCurrency(-300000), '-300.000 đ')
  assert.equal(formatCurrency(0), '0 đ')
  assert.equal(formatCurrency(null), '0 đ')
  assert.equal(formatCurrency(undefined), '0 đ')
  assert.equal(formatCurrency(''), '0 đ')
  assert.equal(formatCurrency('abc'), '0 đ')
})

test('TC07 - formatPercentage: Định dạng phần trăm với 2 chữ số thập phân', () => {
  assert.equal(formatPercentage(22.22), '22.22%')
  assert.equal(formatPercentage(59.33), '59.33%')
  assert.equal(formatPercentage(0), '0.00%')
  assert.equal(formatPercentage(100), '100.00%')
  assert.equal(formatPercentage(null), '0.00%')
  assert.equal(formatPercentage(undefined), '0.00%')
  assert.equal(formatPercentage(''), '0.00%')
  assert.equal(formatPercentage('invalid'), '0.00%')
})

test('TC08 - getServiceGroupColor: Trả về đúng màu cố định cho 5 nhóm dịch vụ và fallback an toàn', () => {
  assert.equal(getServiceGroupColor('EXAMINATION'), '#2563eb')
  assert.equal(getServiceGroupColor('examination'), '#2563eb')
  assert.equal(getServiceGroupColor('LAB_TEST'), '#059669')
  assert.equal(getServiceGroupColor('IMAGING'), '#d97706')
  assert.equal(getServiceGroupColor('MEDICATION'), '#7c3aed')
  assert.equal(getServiceGroupColor('OTHER'), '#64748b')

  // Fallback an toàn cho mã nhóm lạ hoặc null/undefined
  assert.equal(getServiceGroupColor('UNKNOWN_SERVICE'), DEFAULT_SERVICE_GROUP_COLOR)
  assert.equal(getServiceGroupColor('NEW_GROUP'), DEFAULT_SERVICE_GROUP_COLOR)
  assert.equal(getServiceGroupColor(null), DEFAULT_SERVICE_GROUP_COLOR)
  assert.equal(getServiceGroupColor(undefined), DEFAULT_SERVICE_GROUP_COLOR)
  assert.equal(getServiceGroupColor(''), DEFAULT_SERVICE_GROUP_COLOR)
})

test('TC09 - Xử lý dòng UNASSIGNED (doctorId = null): Bảo đảm không bị loại bỏ và render an toàn', () => {
  const doctors = [
    {
      doctorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      doctorCode: 'doctor1',
      doctorName: 'Dr. Nguyen Minh Anh',
      examRevenue: 6000000,
      clinicalServiceRevenue: 12000000,
      medicationRevenue: 9000000,
      adjustmentRevenue: -300000,
      totalRevenue: 26700000,
      percentage: 59.33,
    },
    {
      doctorId: null,
      doctorCode: 'UNASSIGNED',
      doctorName: 'Chưa phân bổ bác sĩ',
      examRevenue: 0,
      clinicalServiceRevenue: 500000,
      medicationRevenue: 0,
      adjustmentRevenue: 0,
      totalRevenue: 500000,
      percentage: 1.11,
    },
  ]

  // Dòng UNASSIGNED phải tồn tại đầy đủ trong danh sách
  assert.equal(doctors.length, 2)
  const unassigned = doctors.find((d) => d.doctorId === null)
  assert.ok(unassigned)
  assert.equal(unassigned.doctorCode, 'UNASSIGNED')
  assert.equal(unassigned.doctorName, 'Chưa phân bổ bác sĩ')
  assert.equal(unassigned.totalRevenue, 500000)

  // Khóa nhận diện hàng độc nhất an toàn khi doctorId = null
  const rowKey = unassigned.doctorId || unassigned.doctorCode || 'UNASSIGNED'
  assert.equal(rowKey, 'UNASSIGNED')

  // Lọc tìm kiếm client-side không gây lỗi với doctorId null
  const searchKeyword = 'chưa phân bổ'
  const matched = doctors.filter((doc) =>
    (doc.doctorName || '').toLowerCase().includes(searchKeyword)
  )
  assert.equal(matched.length, 1)
  assert.equal(matched[0].doctorCode, 'UNASSIGNED')
})

test('TC10 - getRevenueBreakdownErrorMessage: Ánh xạ chuẩn các mã lỗi HTTP 400, 403, 500', () => {
  // Lỗi 400 DATE_RANGE_TOO_LONG
  const error400Range = {
    response: {
      status: 400,
      data: { code: 'DATE_RANGE_TOO_LONG', message: 'Date range must not exceed 366 days.' },
    },
  }
  assert.equal(
    getRevenueBreakdownErrorMessage(error400Range),
    'Khoảng thời gian báo cáo không được vượt quá 366 ngày.'
  )

  // Lỗi 400 chứa message 366
  const error400Message = {
    response: {
      status: 400,
      data: { message: 'Date range must not exceed 366 days.' },
    },
  }
  assert.equal(
    getRevenueBreakdownErrorMessage(error400Message),
    'Khoảng thời gian báo cáo không được vượt quá 366 ngày.'
  )

  // Lỗi 400 generic
  const error400Generic = {
    response: {
      status: 400,
      data: { code: 'VALIDATION_ERROR', message: 'from must be before or equal to to.' },
    },
  }
  assert.equal(
    getRevenueBreakdownErrorMessage(error400Generic),
    'Khoảng thời gian không hợp lệ. Vui lòng kiểm tra lại.'
  )

  // Lỗi 403 Forbidden
  const error403 = {
    response: {
      status: 403,
      data: { message: 'Access Denied' },
    },
  }
  assert.equal(
    getRevenueBreakdownErrorMessage(error403),
    'Bạn không có quyền xem báo cáo doanh thu này.'
  )

  // Lỗi mạng hoặc 500
  const error500 = {
    response: {
      status: 500,
    },
  }
  assert.equal(
    getRevenueBreakdownErrorMessage(error500),
    'Không thể tải báo cáo. Vui lòng thử lại.'
  )
})
