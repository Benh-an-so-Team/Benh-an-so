import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'
import {
  SERIES_WARNING_LABELS,
  getSeriesWarningLabel,
  getSeriesWarningColor,
  getSeriesStatusTag,
  validateSeriesForm,
  canSubmitSeries,
  buildCreateSeriesPayload,
  mapSeriesErrorMessage,
  canUserCreateSeries,
} from './appointmentSeriesHelpers.js'

test('1. Warning labels: accurately maps all 5 backend conflict codes and handles unknown codes gracefully', () => {
  assert.equal(getSeriesWarningLabel('DOCTOR_NOT_WORKING'), 'Bác sĩ không làm việc/ngoài ca')
  assert.equal(getSeriesWarningLabel('DOCTOR_TIME_OFF'), 'Bác sĩ nghỉ phép')
  assert.equal(getSeriesWarningLabel('APPOINTMENT_CONFLICT'), 'Trùng lịch hẹn khác')
  assert.equal(getSeriesWarningLabel('INTERNAL_CONFLICT'), 'Trùng buổi khác trong liệu trình')
  assert.equal(getSeriesWarningLabel('PAST_TIME'), 'Thời điểm đã qua')
  assert.equal(getSeriesWarningLabel('INVALID_TIME'), 'Thời gian không hợp lệ')

  // Unknown / null codes do not crash
  assert.equal(getSeriesWarningLabel('SOME_UNKNOWN_CODE'), 'Cảnh báo khác (SOME_UNKNOWN_CODE)')
  assert.equal(getSeriesWarningLabel(null), 'Không xác định')
  assert.equal(getSeriesWarningLabel(undefined), 'Không xác định')
  assert.equal(getSeriesWarningLabel(''), 'Không xác định')
})

test('2. Warning colors: assigns error or warning tone correctly', () => {
  assert.equal(getSeriesWarningColor('DOCTOR_NOT_WORKING'), 'orange')
  assert.equal(getSeriesWarningColor('DOCTOR_TIME_OFF'), 'orange')
  assert.equal(getSeriesWarningColor('APPOINTMENT_CONFLICT'), 'error')
  assert.equal(getSeriesWarningColor('INTERNAL_CONFLICT'), 'error')
  assert.equal(getSeriesWarningColor('PAST_TIME'), 'error')
  assert.equal(getSeriesWarningColor('UNKNOWN'), 'warning')
})

test('3. Status tags: maps ACTIVE, COMPLETED, CANCELLED correctly', () => {
  assert.deepEqual(getSeriesStatusTag('ACTIVE'), { label: 'Đang hoạt động', color: 'processing' })
  assert.deepEqual(getSeriesStatusTag('COMPLETED'), { label: 'Đã hoàn thành', color: 'success' })
  assert.deepEqual(getSeriesStatusTag('CANCELLED'), { label: 'Đã hủy', color: 'default' })
  assert.deepEqual(getSeriesStatusTag('OTHER'), { label: 'OTHER', color: 'default' })
})

test('4. Form validation: rejects missing patientId, doctorId, and firstSessionStartTime', () => {
  const result = validateSeriesForm({})
  assert.equal(result.isValid, false)
  assert.equal(result.errors.patientId, 'Vui lòng chọn bệnh nhân.')
  assert.equal(result.errors.doctorId, 'Vui lòng chọn bác sĩ.')
  assert.equal(result.errors.firstSessionStartTime, 'Vui lòng chọn thời gian bắt đầu buổi đầu tiên.')
})

test('5. Form validation: boundary testing for totalSessions (2 to 30)', () => {
  const baseValid = {
    patientId: 'p-1',
    doctorId: 'd-1',
    firstSessionStartTime: dayjs().add(1, 'day').toISOString(),
    intervalDays: 7,
  }

  // Under limit: 1 session
  const under = validateSeriesForm({ ...baseValid, totalSessions: 1 })
  assert.equal(under.isValid, false)
  assert.equal(under.errors.totalSessions, 'Số buổi của liệu trình phải từ 2 trở lên.')

  // Lower boundary: 2 sessions
  const lowerBoundary = validateSeriesForm({ ...baseValid, totalSessions: 2 })
  assert.equal(lowerBoundary.isValid, true)

  // Upper boundary: 30 sessions
  const upperBoundary = validateSeriesForm({ ...baseValid, totalSessions: 30 })
  assert.equal(upperBoundary.isValid, true)

  // Over limit: 31 sessions
  const over = validateSeriesForm({ ...baseValid, totalSessions: 31 })
  assert.equal(over.isValid, false)
  assert.equal(over.errors.totalSessions, 'Số buổi của liệu trình tối đa là 30 buổi.')
})

test('6. Form validation: boundary testing for intervalDays (1 to 90)', () => {
  const baseValid = {
    patientId: 'p-1',
    doctorId: 'd-1',
    firstSessionStartTime: dayjs().add(1, 'day').toISOString(),
    totalSessions: 5,
  }

  // Under limit: 0 days
  const under = validateSeriesForm({ ...baseValid, intervalDays: 0 })
  assert.equal(under.isValid, false)
  assert.equal(under.errors.intervalDays, 'Khoảng cách giữa các buổi phải từ 1 ngày trở lên.')

  // Lower boundary: 1 day
  const lowerBoundary = validateSeriesForm({ ...baseValid, intervalDays: 1 })
  assert.equal(lowerBoundary.isValid, true)

  // Upper boundary: 90 days
  const upperBoundary = validateSeriesForm({ ...baseValid, intervalDays: 90 })
  assert.equal(upperBoundary.isValid, true)

  // Over limit: 91 days
  const over = validateSeriesForm({ ...baseValid, intervalDays: 91 })
  assert.equal(over.isValid, false)
  assert.equal(over.errors.intervalDays, 'Khoảng cách giữa các buổi tối đa là 90 ngày.')
})

test('7. Form validation: rejects past start time', () => {
  const pastTime = dayjs().subtract(1, 'hour').toISOString()
  const result = validateSeriesForm({
    patientId: 'p-1',
    doctorId: 'd-1',
    firstSessionStartTime: pastTime,
    totalSessions: 3,
    intervalDays: 2,
  })
  assert.equal(result.isValid, false)
  assert.equal(result.errors.firstSessionStartTime, 'Thời gian bắt đầu buổi đầu tiên không được ở trong quá khứ.')
})

test('8. Form validation: validates title and notes length limits', () => {
  const baseValid = {
    patientId: 'p-1',
    doctorId: 'd-1',
    firstSessionStartTime: dayjs().add(2, 'hour').toISOString(),
    totalSessions: 3,
    intervalDays: 3,
  }

  const longTitle = 'a'.repeat(256)
  const longNotes = 'b'.repeat(1001)

  const resTitle = validateSeriesForm({ ...baseValid, title: longTitle })
  assert.equal(resTitle.isValid, false)
  assert.equal(resTitle.errors.title, 'Tiêu đề liệu trình không được vượt quá 255 ký tự.')

  const resNotes = validateSeriesForm({ ...baseValid, notes: longNotes })
  assert.equal(resNotes.isValid, false)
  assert.equal(resNotes.errors.notes, 'Ghi chú liệu trình không được vượt quá 1000 ký tự.')
})

test('9. canSubmitSeries: correctly enables/disables Create button based on conflicts', () => {
  // Empty or invalid preview
  assert.equal(canSubmitSeries(null), false)
  assert.equal(canSubmitSeries({ sessions: [] }), false)

  // Has conflict count
  assert.equal(
    canSubmitSeries({
      totalSessions: 3,
      intervalDays: 2,
      allAvailable: false,
      conflictCount: 1,
      sessions: [
        { sequenceNumber: 1, status: 'AVAILABLE' },
        { sequenceNumber: 2, status: 'DOCTOR_NOT_WORKING' },
        { sequenceNumber: 3, status: 'AVAILABLE' },
      ],
    }),
    false,
  )

  // allAvailable is false
  assert.equal(
    canSubmitSeries({
      totalSessions: 2,
      intervalDays: 2,
      allAvailable: false,
      conflictCount: 0,
      sessions: [
        { sequenceNumber: 1, status: 'AVAILABLE' },
        { sequenceNumber: 2, status: 'AVAILABLE' },
      ],
    }),
    false,
  )

  // Clean preview without conflicts
  assert.equal(
    canSubmitSeries({
      totalSessions: 3,
      intervalDays: 2,
      allAvailable: true,
      conflictCount: 0,
      sessions: [
        { sequenceNumber: 1, status: 'AVAILABLE' },
        { sequenceNumber: 2, status: 'AVAILABLE' },
        { sequenceNumber: 3, status: 'AVAILABLE' },
      ],
    }),
    true,
  )
})

test('10. buildCreateSeriesPayload: constructs exact payload required by backend', () => {
  const form = {
    patientId: 'patient-uuid',
    doctorId: 'doctor-uuid',
    medicalRecordId: 'mr-uuid',
    title: '  Liệu trình vật lý trị liệu  ',
    notes: '  Tập phục hồi chức năng  ',
    totalSessions: '3',
    intervalDays: '2',
  }
  const previewSessions = [
    { sequenceNumber: 1, startTime: '2026-10-01T08:00:00.000Z', endTime: '2026-10-01T08:30:00.000Z' },
    { sequenceNumber: 2, startTime: '2026-10-03T08:00:00.000Z', endTime: '2026-10-03T08:30:00.000Z' },
    { sequenceNumber: 3, startTime: '2026-10-05T08:00:00.000Z', endTime: '2026-10-05T08:30:00.000Z' },
  ]

  const payload = buildCreateSeriesPayload(form, previewSessions)
  assert.deepEqual(payload, {
    patientId: 'patient-uuid',
    doctorId: 'doctor-uuid',
    medicalRecordId: 'mr-uuid',
    title: 'Liệu trình vật lý trị liệu',
    notes: 'Tập phục hồi chức năng',
    totalSessions: 3,
    intervalDays: 2,
    sessions: [
      { sequenceNumber: 1, startTime: '2026-10-01T08:00:00.000Z', endTime: '2026-10-01T08:30:00.000Z' },
      { sequenceNumber: 2, startTime: '2026-10-03T08:00:00.000Z', endTime: '2026-10-03T08:30:00.000Z' },
      { sequenceNumber: 3, startTime: '2026-10-05T08:00:00.000Z', endTime: '2026-10-05T08:30:00.000Z' },
    ],
  })
})

test('11. mapSeriesErrorMessage: maps 400, 403, 409, 404 cleanly', () => {
  const err403 = { response: { status: 403 } }
  assert.match(mapSeriesErrorMessage(err403), /không có quyền/)

  const err409WithConflicts = {
    response: {
      status: 409,
      data: {
        code: 'APPOINTMENT_SERIES_CONFLICT',
        details: { conflicts: [{}, {}] },
      },
    },
  }
  assert.match(mapSeriesErrorMessage(err409WithConflicts), /Có 2 buổi khám bị xung đột/)

  const err400 = { response: { status: 400, data: { message: 'Khoảng cách giữa các buổi không hợp lệ.' } } }
  assert.equal(mapSeriesErrorMessage(err400), 'Khoảng cách giữa các buổi không hợp lệ.')

  const err404 = { response: { status: 404 } }
  assert.match(mapSeriesErrorMessage(err404), /Không tìm thấy/)
})

test('12. canUserCreateSeries: checks Admin and Receptionist permissions accurately', () => {
  // Admin with APPOINTMENT_CREATE
  assert.equal(canUserCreateSeries({ roles: ['ADMIN'], permissions: ['APPOINTMENT_CREATE'] }), true)

  // Receptionist with APPOINTMENT_CREATE
  assert.equal(canUserCreateSeries({ roles: ['RECEPTIONIST'], permissions: ['APPOINTMENT_CREATE'] }), true)

  // Doctor with APPOINTMENT_CREATE (Backend blocks Doctor for series preview/create)
  assert.equal(canUserCreateSeries({ roles: ['DOCTOR'], permissions: ['APPOINTMENT_CREATE'] }), false)

  // Receptionist WITHOUT APPOINTMENT_CREATE
  assert.equal(canUserCreateSeries({ roles: ['RECEPTIONIST'], permissions: ['APPOINTMENT_READ'] }), false)

  // Null user
  assert.equal(canUserCreateSeries(null), false)
})
