import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REQUEST_TYPE_OPTIONS,
  getRequestTypeLabel,
  getStatusTag,
  getOverdueFlag,
  isUpcomingDue,
  canComplete,
  validateCreateForm,
  validateCompleteForm,
  mapPersonalDataRequestError,
} from './personalDataRequestHelpers.js'

test('REQUEST_TYPE_OPTIONS contains all required types and labels', () => {
  assert.equal(REQUEST_TYPE_OPTIONS.MEDICAL_RECORD_COPY, 'Trích sao bệnh án')
  assert.equal(REQUEST_TYPE_OPTIONS.DATA_ACCESS, 'Truy cập dữ liệu')
  assert.equal(REQUEST_TYPE_OPTIONS.DATA_CORRECTION, 'Đính chính dữ liệu')
  assert.equal(REQUEST_TYPE_OPTIONS.DATA_DELETION, 'Rút lại đồng ý / Xóa dữ liệu')
  assert.equal(REQUEST_TYPE_OPTIONS.RESTRICT_PROCESSING, 'Hạn chế xử lý dữ liệu')
  assert.equal(REQUEST_TYPE_OPTIONS.OTHER, 'Yêu cầu khác')

  assert.equal(getRequestTypeLabel('MEDICAL_RECORD_COPY'), 'Trích sao bệnh án')
  assert.equal(getRequestTypeLabel('UNKNOWN_TYPE'), 'UNKNOWN_TYPE')
  assert.equal(getRequestTypeLabel(null), '---')
})

test('getStatusTag returns correct label and color for RECEIVED and COMPLETED', () => {
  const received = getStatusTag('RECEIVED')
  assert.equal(received.label, 'Chờ xử lý')
  assert.equal(received.color, 'orange')

  const completed = getStatusTag('COMPLETED')
  assert.equal(completed.label, 'Đã hoàn tất')
  assert.equal(completed.color, 'green')

  const unknown = getStatusTag('UNKNOWN')
  assert.equal(unknown.label, 'UNKNOWN')
  assert.equal(unknown.color, 'default')

  const empty = getStatusTag(null)
  assert.equal(empty.label, 'Không xác định')
  assert.equal(empty.color, 'default')
})

test('getOverdueFlag correctly identifies overdue status and handles boundary at dueAt = now', () => {
  const now = new Date('2026-10-01T10:00:00Z')

  // Quá hạn: dueAt < now, status === 'RECEIVED'
  const overdueReq = {
    dueAt: '2026-10-01T09:59:59Z',
    status: 'RECEIVED',
  }
  assert.equal(getOverdueFlag(overdueReq, now), true)

  // Chưa quá hạn: dueAt > now, status === 'RECEIVED'
  const futureReq = {
    dueAt: '2026-10-01T10:00:01Z',
    status: 'RECEIVED',
  }
  assert.equal(getOverdueFlag(futureReq, now), false)

  // Biên đúng lúc dueAt = now: không tính là quá hạn
  const exactNowReq = {
    dueAt: '2026-10-01T10:00:00Z',
    status: 'RECEIVED',
  }
  assert.equal(getOverdueFlag(exactNowReq, now), false)

  // Yêu cầu đã COMPLETED không bao giờ bị flag là quá hạn
  const completedPastReq = {
    dueAt: '2026-09-01T10:00:00Z',
    status: 'COMPLETED',
  }
  assert.equal(getOverdueFlag(completedPastReq, now), false)

  // Dữ liệu rỗng / thiếu
  assert.equal(getOverdueFlag(null, now), false)
  assert.equal(getOverdueFlag({}, now), false)
})

test('isUpcomingDue identifies requests due within 24 hours', () => {
  const now = new Date('2026-10-01T10:00:00Z')

  // Còn 12h nữa đến hạn -> UPCOMING
  const in12Hours = {
    dueAt: '2026-10-01T22:00:00Z',
    status: 'RECEIVED',
  }
  assert.equal(isUpcomingDue(in12Hours, now), true)

  // Còn 24h đúng -> UPCOMING
  const in24Hours = {
    dueAt: '2026-10-02T10:00:00Z',
    status: 'RECEIVED',
  }
  assert.equal(isUpcomingDue(in24Hours, now), true)

  // Còn 25h nữa -> false (chưa vào khung cảnh báo 24h)
  const in25Hours = {
    dueAt: '2026-10-02T11:00:00Z',
    status: 'RECEIVED',
  }
  assert.equal(isUpcomingDue(in25Hours, now), false)

  // Đã quá hạn -> false
  const pastReq = {
    dueAt: '2026-10-01T09:00:00Z',
    status: 'RECEIVED',
  }
  assert.equal(isUpcomingDue(pastReq, now), false)

  // Đã hoàn tất -> false
  const completedReq = {
    dueAt: '2026-10-01T20:00:00Z',
    status: 'COMPLETED',
  }
  assert.equal(isUpcomingDue(completedReq, now), false)
})

test('canComplete allows completion only when status is RECEIVED', () => {
  assert.equal(canComplete({ status: 'RECEIVED' }), true)
  assert.equal(canComplete({ status: 'COMPLETED' }), false)
  assert.equal(canComplete({ status: 'CANCELLED' }), false)
  assert.equal(canComplete(null), false)
  assert.equal(canComplete(undefined), false)
  assert.equal(canComplete({}), false)
})

test('validateCreateForm correctly validates input fields', () => {
  const receivedAt = new Date('2026-10-01T10:00:00Z')
  const validDueAt = '2026-10-05T10:00:00Z'

  // Trường hợp hợp lệ
  const validResult = validateCreateForm(
    'p-uuid-001',
    'MEDICAL_RECORD_COPY',
    'Xin trích sao bệnh án điều trị',
    validDueAt,
    receivedAt
  )
  assert.equal(validResult.isValid, true)
  assert.deepEqual(validResult.errors, {})

  // Thiếu bệnh nhân
  const noPatient = validateCreateForm('', 'MEDICAL_RECORD_COPY', 'Lý do', validDueAt, receivedAt)
  assert.equal(noPatient.isValid, false)
  assert.ok(noPatient.errors.patientId)

  // Thiếu loại yêu cầu
  const noType = validateCreateForm('p-uuid-001', '', 'Lý do', validDueAt, receivedAt)
  assert.equal(noType.isValid, false)
  assert.ok(noType.errors.requestType)

  // Loại yêu cầu quá 50 ký tự
  const longType = validateCreateForm('p-uuid-001', 'A'.repeat(51), 'Lý do', validDueAt, receivedAt)
  assert.equal(longType.isValid, false)
  assert.ok(longType.errors.requestType)

  // Lý do rỗng hoặc chỉ có khoảng trắng
  const emptyReason = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', '   ', validDueAt, receivedAt)
  assert.equal(emptyReason.isValid, false)
  assert.ok(emptyReason.errors.reason)

  // Lý do vượt quá 2000 ký tự
  const longReason = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'A'.repeat(2001), validDueAt, receivedAt)
  assert.equal(longReason.isValid, false)
  assert.ok(longReason.errors.reason)

  // Lý do đúng 2000 ký tự -> hợp lệ
  const exactReason = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'A'.repeat(2000), validDueAt, receivedAt)
  assert.equal(exactReason.isValid, true)

  // Thiếu hạn xử lý
  const noDue = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'Lý do', null, receivedAt)
  assert.equal(noDue.isValid, false)
  assert.ok(noDue.errors.dueAt)

  // Hạn xử lý trước thời điểm tiếp nhận -> CHẶN
  const pastDue = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'Lý do', '2026-10-01T09:59:59Z', receivedAt)
  assert.equal(pastDue.isValid, false)
  assert.equal(pastDue.errors.dueAt, 'Hạn xử lý không được trước thời điểm tiếp nhận.')

  // Hạn xử lý bằng thời điểm tiếp nhận -> hợp lệ
  const sameDue = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'Lý do', '2026-10-01T10:00:00Z', receivedAt)
  assert.equal(sameDue.isValid, true)
})

test('validateCompleteForm validates result content and length', () => {
  // Hợp lệ
  const valid = validateCompleteForm('Đã sao bệnh án và bàn giao cho người bệnh.')
  assert.equal(valid.isValid, true)
  assert.deepEqual(valid.errors, {})

  // Kết quả rỗng
  const empty = validateCompleteForm('')
  assert.equal(empty.isValid, false)
  assert.ok(empty.errors.result)

  // Kết quả chỉ có khoảng trắng
  const whitespace = validateCompleteForm('   \n  \t ')
  assert.equal(whitespace.isValid, false)
  assert.ok(whitespace.errors.result)

  // Kết quả vượt quá 2000 ký tự
  const tooLong = validateCompleteForm('A'.repeat(2001))
  assert.equal(tooLong.isValid, false)
  assert.equal(tooLong.errors.result, 'Kết quả xử lý không được vượt quá 2000 ký tự.')

  // Kết quả đúng 2000 ký tự
  const exact = validateCompleteForm('A'.repeat(2000))
  assert.equal(exact.isValid, true)
})

test('mapPersonalDataRequestError maps domain errors accurately', () => {
  // 409 Conflict: đã hoàn tất
  const err409Code = {
    response: {
      status: 409,
      data: { code: 'PERSONAL_DATA_REQUEST_ALREADY_COMPLETED' },
    },
  }
  assert.match(mapPersonalDataRequestError(err409Code), /đã được hoàn tất trước đó/)

  const err409Msg = {
    response: {
      status: 409,
      data: { message: 'Personal data request is already completed: ec0611e0...' },
    },
  }
  assert.match(mapPersonalDataRequestError(err409Msg), /đã được hoàn tất trước đó/)

  // 403 Forbidden: không có quyền (không phải ADMIN)
  const err403 = {
    response: {
      status: 403,
      data: { code: 'FORBIDDEN', message: 'Access Denied' },
    },
  }
  assert.match(mapPersonalDataRequestError(err403), /Quản trị viên \(ADMIN\)/)

  // 404 Not Found: không tìm thấy bệnh nhân
  const err404Patient = {
    response: {
      status: 404,
      data: { message: 'Patient not found: bbbbbbbb...' },
    },
  }
  assert.match(mapPersonalDataRequestError(err404Patient), /bệnh nhân/)

  // 404 Not Found: không tìm thấy yêu cầu
  const err404Req = {
    response: {
      status: 404,
      data: { message: 'Personal data request not found: ec0611e0...' },
    },
  }
  assert.match(mapPersonalDataRequestError(err404Req), /yêu cầu dữ liệu cá nhân/)

  // 400 Bad Request: hạn xử lý trước ngày tiếp nhận
  const err400Due = {
    response: {
      status: 400,
      data: { message: 'Due date must not be before the received date.' },
    },
  }
  assert.match(mapPersonalDataRequestError(err400Due), /Hạn xử lý không được trước thời điểm tiếp nhận/)

  // 400 Bad Request: result rỗng hoặc vượt quá 2000 ký tự
  const err400Result = {
    response: {
      status: 400,
      data: { message: 'result is required.' },
    },
  }
  assert.match(mapPersonalDataRequestError(err400Result), /Kết quả xử lý/)

  // Default fallback
  assert.equal(mapPersonalDataRequestError(null), 'Có lỗi xảy ra khi xử lý yêu cầu dữ liệu cá nhân.')
})
