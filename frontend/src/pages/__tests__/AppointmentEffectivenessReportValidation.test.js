import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateDateRange,
  formatStatus,
  formatBookingChannel,
  getStatusColor,
  getChannelColor,
  formatPercentage,
  groupItemsByStatus,
  groupItemsByChannel,
  extractAppointmentKpis,
  getAppointmentEffectivenessErrorMessage,
  MAX_REPORT_RANGE_DAYS,
} from '../../utils/appointmentEffectivenessReportHelpers.js'

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
  // 367 ngày: từ 2025-01-01 đến 2026-01-02
  const res = validateDateRange('2025-01-01', '2026-01-02')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Khoảng thời gian báo cáo không được vượt quá 366 ngày.')
})

test('TC05 - validateDateRange: Chấp nhận khoảng thời gian hợp lệ (kể cả mốc tối đa 366 ngày)', () => {
  // Đúng 366 ngày: 2025-01-01 đến 2026-01-01
  const res366 = validateDateRange('2025-01-01', '2026-01-01')
  assert.equal(res366.valid, true)
  assert.equal(res366.error, '')
  assert.equal(res366.from, '2025-01-01')
  assert.equal(res366.to, '2026-01-01')
  assert.equal(res366.inclusiveDays, 366)

  // Khoảng 1 tháng thông thường
  const resMonth = validateDateRange('2026-08-01', '2026-08-31')
  assert.equal(resMonth.valid, true)
  assert.equal(resMonth.error, '')
  assert.equal(resMonth.inclusiveDays, 31)
})

test('TC06 - formatStatus: Ánh xạ 100% tiếng Việt chuẩn xác cho 7 trạng thái lịch hẹn', () => {
  assert.equal(formatStatus('COMPLETED'), 'Đã khám xong')
  assert.equal(formatStatus('CANCELLED'), 'Đã hủy')
  assert.equal(formatStatus('NO_SHOW'), 'Không đến khám')
  assert.equal(formatStatus('CHECKED_IN'), 'Đã có mặt')
  assert.equal(formatStatus('IN_PROGRESS'), 'Đang khám')
  assert.equal(formatStatus('SCHEDULED'), 'Đã đặt lịch')
  assert.equal(formatStatus('CONFIRMED'), 'Đã xác nhận')
  assert.equal(formatStatus('UNKNOWN'), 'UNKNOWN')
  assert.equal(formatStatus(null), 'Chưa xác định')
})

test('TC07 - formatBookingChannel: Ánh xạ tiếng Việt chuẩn xác cho 2 kênh đặt lịch', () => {
  assert.equal(formatBookingChannel('ONLINE_PORTAL'), 'Cổng bệnh nhân trực tuyến')
  assert.equal(formatBookingChannel('RECEPTION_COUNTER'), 'Đăng ký tại quầy')
  assert.equal(formatBookingChannel('OTHER'), 'OTHER')
  assert.equal(formatBookingChannel(null), 'Chưa xác định')
})

test('TC08 - getStatusColor & getChannelColor: Đảm bảo bảng màu có ý nghĩa nghiệp vụ', () => {
  assert.equal(getStatusColor('COMPLETED'), '#059669') // Xanh lá
  assert.equal(getStatusColor('CANCELLED'), '#dc2626') // Đỏ
  assert.equal(getStatusColor('NO_SHOW'), '#ea580c') // Cam đậm
  assert.equal(getStatusColor('CHECKED_IN'), '#2563eb')
  assert.equal(getStatusColor('IN_PROGRESS'), '#0891b2')
  assert.equal(getStatusColor('SCHEDULED'), '#64748b')
  assert.equal(getStatusColor('CONFIRMED'), '#7c3aed')

  assert.equal(getChannelColor('ONLINE_PORTAL'), '#2563eb')
  assert.equal(getChannelColor('RECEPTION_COUNTER'), '#059669')
})

test('TC09 - formatPercentage: Định dạng hiển thị 2 chữ số thập phân', () => {
  assert.equal(formatPercentage(40), '40.00%')
  assert.equal(formatPercentage(33.333), '33.33%')
  assert.equal(formatPercentage(0), '0.00%')
  assert.equal(formatPercentage(null), '0.00%')
})

test('TC10 - groupItemsByStatus: Gộp items theo trạng thái và tính lại tỷ lệ phần trăm', () => {
  // Dữ liệu mẫu chuẩn từ Backend contract (mỗi dòng là một cặp channel-status riêng biệt)
  const items = [
    { bookingChannel: 'RECEPTION_COUNTER', status: 'COMPLETED', count: 40, percentage: 40.00 },
    { bookingChannel: 'ONLINE_PORTAL', status: 'COMPLETED', count: 10, percentage: 10.00 },
    { bookingChannel: 'RECEPTION_COUNTER', status: 'CANCELLED', count: 30, percentage: 30.00 },
    { bookingChannel: 'ONLINE_PORTAL', status: 'NO_SHOW', count: 20, percentage: 20.00 },
  ]
  const total = 100

  const grouped = groupItemsByStatus(items, total)

  // COMPLETED có 2 dòng (40 tại quầy + 10 online) -> tổng = 50, percentage = 50.00%
  const completedGroup = grouped.find((g) => g.status === 'COMPLETED')
  assert.ok(completedGroup)
  assert.equal(completedGroup.count, 50)
  assert.equal(completedGroup.percentage, 50.00)
  assert.equal(completedGroup.channels.length, 2)
  // Kênh con giữ nguyên percentage gốc từ backend
  assert.equal(completedGroup.channels[0].bookingChannel, 'ONLINE_PORTAL')
  assert.equal(completedGroup.channels[0].count, 10)
  assert.equal(completedGroup.channels[0].percentage, 10.00)
  assert.equal(completedGroup.channels[1].bookingChannel, 'RECEPTION_COUNTER')
  assert.equal(completedGroup.channels[1].count, 40)
  assert.equal(completedGroup.channels[1].percentage, 40.00)

  // NO_SHOW có 1 dòng (20) -> tổng = 20, percentage = 20.00%
  const noShowGroup = grouped.find((g) => g.status === 'NO_SHOW')
  assert.ok(noShowGroup)
  assert.equal(noShowGroup.count, 20)
  assert.equal(noShowGroup.percentage, 20.00)

  // CANCELLED có 1 dòng (30) -> tổng = 30, percentage = 30.00%
  const cancelledGroup = grouped.find((g) => g.status === 'CANCELLED')
  assert.ok(cancelledGroup)
  assert.equal(cancelledGroup.count, 30)
  assert.equal(cancelledGroup.percentage, 30.00)
})

test('TC11 - groupItemsByChannel: Gộp items theo kênh đặt lịch và tính lại tỷ lệ phần trăm', () => {
  const items = [
    { bookingChannel: 'RECEPTION_COUNTER', status: 'COMPLETED', count: 40, percentage: 40.00 },
    { bookingChannel: 'ONLINE_PORTAL', status: 'COMPLETED', count: 10, percentage: 10.00 },
    { bookingChannel: 'RECEPTION_COUNTER', status: 'CANCELLED', count: 30, percentage: 30.00 },
    { bookingChannel: 'ONLINE_PORTAL', status: 'NO_SHOW', count: 20, percentage: 20.00 },
  ]
  const total = 100

  const grouped = groupItemsByChannel(items, total)
  assert.equal(grouped.length, 2)

  // Kênh ONLINE_PORTAL: 10 (COMPLETED) + 20 (NO_SHOW) = 30 (30.00%)
  const onlineGroup = grouped.find((g) => g.bookingChannel === 'ONLINE_PORTAL')
  assert.ok(onlineGroup)
  assert.equal(onlineGroup.count, 30)
  assert.equal(onlineGroup.percentage, 30.00)
  assert.equal(onlineGroup.statuses.length, 2)

  // Kênh RECEPTION_COUNTER: 40 (COMPLETED) + 30 (CANCELLED) = 70 (70.00%)
  const counterGroup = grouped.find((g) => g.bookingChannel === 'RECEPTION_COUNTER')
  assert.ok(counterGroup)
  assert.equal(counterGroup.count, 70)
  assert.equal(counterGroup.percentage, 70.00)
  assert.equal(counterGroup.statuses.length, 2)
})

test('TC12 - extractAppointmentKpis: Tính toán chỉ số then chốt và cảnh báo NO_SHOW', () => {
  const items = [
    { bookingChannel: 'RECEPTION_COUNTER', status: 'COMPLETED', count: 40, percentage: 40.00 },
    { bookingChannel: 'ONLINE_PORTAL', status: 'COMPLETED', count: 10, percentage: 10.00 },
    { bookingChannel: 'RECEPTION_COUNTER', status: 'CANCELLED', count: 30, percentage: 30.00 },
    { bookingChannel: 'ONLINE_PORTAL', status: 'NO_SHOW', count: 20, percentage: 20.00 },
  ]
  const total = 100

  const kpis = extractAppointmentKpis(items, total)
  assert.equal(kpis.total, 100)
  assert.equal(kpis.noShowCount, 20)
  assert.equal(kpis.noShowPercentage, 20.00)
  assert.equal(kpis.completedCount, 50)
  assert.equal(kpis.completedPercentage, 50.00)
  assert.equal(kpis.cancelledCount, 30)
  assert.equal(kpis.cancelledPercentage, 30.00)
  assert.equal(kpis.isNoShowWarning, true) // 20% > 15% nên bật cờ cảnh báo
})

test('TC13 - Xử lý kỳ báo cáo trống (Empty period: total = 0, items = [])', () => {
  const groupedStatus = groupItemsByStatus([], 0)
  assert.deepEqual(groupedStatus, [])

  const groupedChannel = groupItemsByChannel([], 0)
  assert.deepEqual(groupedChannel, [])

  const kpis = extractAppointmentKpis([], 0)
  assert.equal(kpis.total, 0)
  assert.equal(kpis.noShowCount, 0)
  assert.equal(kpis.noShowPercentage, 0)
  assert.equal(kpis.isNoShowWarning, false)
})

test('TC14 - getAppointmentEffectivenessErrorMessage: Ánh xạ chuẩn mực các mã lỗi HTTP', () => {
  // Lỗi vượt quá 366 ngày
  const err366 = {
    response: {
      status: 400,
      data: { message: 'Date range must not exceed 366 days.', code: 'VALIDATION_ERROR' },
    },
  }
  assert.equal(
    getAppointmentEffectivenessErrorMessage(err366),
    'Khoảng thời gian báo cáo không được vượt quá 366 ngày.'
  )

  // Lỗi ngày bắt đầu lớn hơn kết thúc
  const errFromAfterTo = {
    response: {
      status: 400,
      data: { message: 'from must be before or equal to to.', code: 'VALIDATION_ERROR' },
    },
  }
  assert.equal(
    getAppointmentEffectivenessErrorMessage(errFromAfterTo),
    'Ngày bắt đầu không được lớn hơn ngày kết thúc.'
  )

  // Lỗi thiếu ngày
  const errMissing = {
    response: {
      status: 400,
      data: { message: 'from is required.', code: 'MISSING_PARAMETER' },
    },
  }
  assert.equal(
    getAppointmentEffectivenessErrorMessage(errMissing),
    'Vui lòng chọn đầy đủ khoảng thời gian báo cáo.'
  )

  // Lỗi phân quyền 403
  const err403 = { response: { status: 403, data: { message: 'Access Denied' } } }
  assert.equal(
    getAppointmentEffectivenessErrorMessage(err403),
    'Bạn không có quyền xem báo cáo này.'
  )

  // Lỗi 401
  const err401 = { response: { status: 401 } }
  assert.equal(
    getAppointmentEffectivenessErrorMessage(err401),
    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  )

  // Lỗi mạng hoặc lỗi server
  const err500 = { response: { status: 500 } }
  assert.equal(
    getAppointmentEffectivenessErrorMessage(err500),
    'Không thể tải báo cáo. Vui lòng thử lại.'
  )
})
