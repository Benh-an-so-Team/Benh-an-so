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
} from '../utils/personalDataRequestHelpers.js'

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

test('validateCreateForm: chặn dueAt trước ngày tiếp nhận, reason rỗng/quá dài', () => {
  const receivedAt = new Date('2026-10-01T10:00:00Z')
  const validDueAt = '2026-10-05T10:00:00Z'

  // Chặn dueAt trước ngày tiếp nhận
  const pastDue = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'Lý do hợp lệ', '2026-10-01T09:59:59Z', receivedAt)
  assert.equal(pastDue.isValid, false)
  assert.equal(pastDue.errors.dueAt, 'Hạn xử lý không được trước thời điểm tiếp nhận.')

  // Hợp lệ khi dueAt sau ngày tiếp nhận
  const validDue = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'Lý do hợp lệ', validDueAt, receivedAt)
  assert.equal(validDue.isValid, true)

  // Chặn reason rỗng hoặc chỉ có khoảng trắng
  const emptyReason = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', '', validDueAt, receivedAt)
  assert.equal(emptyReason.isValid, false)
  assert.equal(emptyReason.errors.reason, 'Vui lòng nhập lý do yêu cầu.')

  const whitespaceReason = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', '    ', validDueAt, receivedAt)
  assert.equal(whitespaceReason.isValid, false)
  assert.equal(whitespaceReason.errors.reason, 'Vui lòng nhập lý do yêu cầu.')

  // Chặn reason vượt quá 2000 ký tự
  const tooLongReason = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'X'.repeat(2001), validDueAt, receivedAt)
  assert.equal(tooLongReason.isValid, false)
  assert.equal(tooLongReason.errors.reason, 'Lý do yêu cầu không được vượt quá 2000 ký tự.')

  // Hợp lệ khi reason đúng 2000 ký tự
  const boundaryReason = validateCreateForm('p-uuid-001', 'MEDICAL_RECORD_COPY', 'X'.repeat(2000), validDueAt, receivedAt)
  assert.equal(boundaryReason.isValid, true)
})

test('validateCompleteForm: chặn result rỗng/quá dài', () => {
  // Chặn result rỗng
  const emptyResult = validateCompleteForm('')
  assert.equal(emptyResult.isValid, false)
  assert.equal(emptyResult.errors.result, 'Vui lòng nhập kết quả hoặc bằng chứng xử lý.')

  // Chặn result whitespace
  const wsResult = validateCompleteForm('   \t\n  ')
  assert.equal(wsResult.isValid, false)
  assert.equal(wsResult.errors.result, 'Vui lòng nhập kết quả hoặc bằng chứng xử lý.')

  // Chặn result vượt quá 2000 ký tự
  const tooLong = validateCompleteForm('B'.repeat(2001))
  assert.equal(tooLong.isValid, false)
  assert.equal(tooLong.errors.result, 'Kết quả xử lý không được vượt quá 2000 ký tự.')

  // Hợp lệ khi result hợp lệ và <= 2000 ký tự
  const valid = validateCompleteForm('Đã xử lý trích sao hồ sơ bệnh án và bàn giao cho bệnh nhân.')
  assert.equal(valid.isValid, true)

  const boundary = validateCompleteForm('B'.repeat(2000))
  assert.equal(boundary.isValid, true)
})

test('canComplete: đúng/sai theo status', () => {
  // Chỉ đúng khi RECEIVED
  assert.equal(canComplete({ status: 'RECEIVED' }), true)

  // Sai khi COMPLETED
  assert.equal(canComplete({ status: 'COMPLETED' }), false)

  // Sai khi status khác hoặc rỗng
  assert.equal(canComplete({ status: 'CANCELLED' }), false)
  assert.equal(canComplete(null), false)
  assert.equal(canComplete(undefined), false)
  assert.equal(canComplete({}), false)
})

test('mapPersonalDataRequestError: đủ mã lỗi', () => {
  // 400 dueAt trước ngày tiếp nhận
  const err400Due = {
    response: {
      status: 400,
      data: { message: 'Due date must not be before the received date.' },
    },
  }
  assert.match(mapPersonalDataRequestError(err400Due), /Hạn xử lý không được trước thời điểm tiếp nhận/)

  // 400 reason rỗng hoặc vượt quá 2000 ký tự
  const err400Reason = {
    response: {
      status: 400,
      data: { message: 'reason must not exceed 2000 characters.' },
    },
  }
  assert.match(mapPersonalDataRequestError(err400Reason), /Lý do yêu cầu/)

  // 400 result rỗng hoặc vượt quá 2000 ký tự
  const err400Result = {
    response: {
      status: 400,
      data: { message: 'result is required.' },
    },
  }
  assert.match(mapPersonalDataRequestError(err400Result), /Kết quả xử lý/)

  // 409 PersonalDataRequestAlreadyCompletedException
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
      data: { message: 'Personal data request is already completed: ec0611e0-...' },
    },
  }
  assert.match(mapPersonalDataRequestError(err409Msg), /đã được hoàn tất trước đó/)

  // 403 không phải ADMIN
  const err403 = {
    response: {
      status: 403,
      data: { code: 'FORBIDDEN', message: 'Access Denied' },
    },
  }
  assert.match(mapPersonalDataRequestError(err403), /Quản trị viên \(ADMIN\)/)

  // 404 không tìm thấy yêu cầu / bệnh nhân
  const err404Req = {
    response: {
      status: 404,
      data: { message: 'Personal data request not found: ec0611e0...' },
    },
  }
  assert.match(mapPersonalDataRequestError(err404Req), /yêu cầu dữ liệu cá nhân/)

  const err404Patient = {
    response: {
      status: 404,
      data: { message: 'Patient not found: bbbbbbbb...' },
    },
  }
  assert.match(mapPersonalDataRequestError(err404Patient), /bệnh nhân/)
})
