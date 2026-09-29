import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateDateRange,
  mapDoctorVisitResponse,
  calculateDoctorVisitStats,
  calculateDoctorContributionPercentage,
} from '../../utils/doctorVisitReportHelpers.js'

test('TC04 — Validate Khoảng thời gian: từ ngày > đến ngày chặn request & báo lỗi', () => {
  const result = validateDateRange('2026-08-10', '2026-08-01')
  assert.equal(result.valid, false)
  assert.equal(result.error, 'Ngày bắt đầu không được lớn hơn ngày kết thúc.')
})

test('TC03 — Validate Khoảng thời gian hợp lệ: fromDate <= toDate', () => {
  const result = validateDateRange('2026-08-01', '2026-08-10')
  assert.equal(result.valid, true)
  assert.equal(result.error, '')
})

test('Validate Khoảng thời gian thiếu ngày bắt đầu hoặc ngày kết thúc', () => {
  const res1 = validateDateRange('', '2026-08-10')
  assert.equal(res1.valid, false)
  assert.equal(res1.error, 'Từ ngày và đến ngày là bắt buộc.')

  const res2 = validateDateRange('2026-08-01', null)
  assert.equal(res2.valid, false)
  assert.equal(res2.error, 'Từ ngày và đến ngày là bắt buộc.')
})

test('TC07 & TC08 & XVII — Map Response DTO Backend & giữ đúng doctorId (không gộp sai bác sĩ trùng tên)', () => {
  const mockBackendResponse = {
    from: '2026-08-01',
    to: '2026-08-14',
    generatedAt: '2026-08-14T10:00:00Z',
    items: [
      {
        rank: 1,
        doctorId: 'doc-uuid-001',
        doctorCode: 'DOC001',
        doctorName: 'Bác sĩ Nguyễn Văn A',
        totalVisits: 18,
      },
      {
        rank: 2,
        doctorId: 'doc-uuid-002',
        doctorCode: 'DOC002',
        doctorName: 'Bác sĩ Nguyễn Văn A',
        totalVisits: 12,
      },
      {
        rank: 3,
        doctorId: 'doc-uuid-003',
        doctorCode: 'DOC003',
        doctorName: 'Bác sĩ Trần Quang Huy',
        totalVisits: 25,
      },
    ],
  }

  const mapped = mapDoctorVisitResponse(mockBackendResponse)

  assert.equal(mapped.items.length, 3)
  assert.equal(mapped.items[0].doctorId, 'doc-uuid-003')
  assert.equal(mapped.items[0].totalVisits, 25)

  const sameNameDoctors = mapped.items.filter(
    (item) => item.doctorName === 'Bác sĩ Nguyễn Văn A',
  )
  assert.equal(sameNameDoctors.length, 2)
  assert.notEqual(sameNameDoctors[0].doctorId, sameNameDoctors[1].doctorId)
})

test('TC05 & XIV — Trường hợp không có dữ liệu (Empty state)', () => {
  const emptyResponse = {
    from: '2026-08-01',
    to: '2026-08-14',
    generatedAt: '2026-08-14T10:00:00Z',
    items: [],
  }

  const mapped = mapDoctorVisitResponse(emptyResponse)
  assert.equal(mapped.items.length, 0)

  const stats = calculateDoctorVisitStats(mapped.items)
  assert.equal(stats.totalVisitsAll, 0)
  assert.equal(stats.doctorCount, 0)
  assert.equal(stats.avgVisits, '0.0')
  assert.equal(stats.topDoctor, null)
})

test('XI — Tính toán Thống kê Tổng quan (Tổng lượt, Số bác sĩ, Trung bình, Bác sĩ nhiều lượt nhất)', () => {
  const items = [
    { doctorId: 'd1', doctorName: 'Dr A', totalVisits: 20 },
    { doctorId: 'd2', doctorName: 'Dr B', totalVisits: 10 },
    { doctorId: 'd3', doctorName: 'Dr C', totalVisits: 30 },
  ]

  const stats = calculateDoctorVisitStats(items)

  assert.equal(stats.totalVisitsAll, 60)
  assert.equal(stats.doctorCount, 3)
  assert.equal(stats.avgVisits, '20.0')
  assert.equal(stats.topDoctor.doctorId, 'd3')
  assert.equal(stats.topDoctor.totalVisits, 30)
})

test('XII — Tính Tỷ lệ Đóng góp (%) Lượt khám', () => {
  assert.equal(calculateDoctorContributionPercentage(15, 60), '25.0%')
  assert.equal(calculateDoctorContributionPercentage(30, 60), '50.0%')
  assert.equal(calculateDoctorContributionPercentage(0, 60), '0.0%')
  assert.equal(calculateDoctorContributionPercentage(10, 0), '0.0%')
})
