import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CLOSE_VISIT_OUTCOMES,
  PRESET_CLOSE_REASONS,
  canUserCloseVisit,
  validateCloseVisitForm,
  mapCloseVisitErrorMessage,
} from '../../utils/closeVisitHelpers.js'

test('TC01: Chọn kết thúc sớm (EARLY_ENDED) kèm lý do hợp lệ -> Hợp lệ để submit', () => {
  const result = validateCloseVisitForm({
    outcome: CLOSE_VISIT_OUTCOMES.EARLY_ENDED,
    reason: 'Bệnh nhân xin về sớm do có việc gia đình đột xuất',
    currentStatus: 'IN_PROGRESS',
    isRecordSigned: false,
  })

  assert.equal(result.valid, true)
  assert.equal(result.trimmedReason, 'Bệnh nhân xin về sớm do có việc gia đình đột xuất')
})

test('TC02: Chọn hủy ca khám (CANCELLED) kèm lý do hợp lệ -> Hợp lệ để submit', () => {
  const result = validateCloseVisitForm({
    outcome: CLOSE_VISIT_OUTCOMES.CANCELLED,
    reason: 'Đăng ký nhầm phòng khám chuyên khoa',
    currentStatus: 'IN_PROGRESS',
    isRecordSigned: false,
    hasDispensedPrescriptions: false,
  })

  assert.equal(result.valid, true)
  assert.equal(result.trimmedReason, 'Đăng ký nhầm phòng khám chuyên khoa')
})

test('TC03: Lý do rỗng hoặc chỉ toàn khoảng trắng -> Bị từ chối và yêu cầu nhập lý do', () => {
  const resultBlank = validateCloseVisitForm({
    outcome: CLOSE_VISIT_OUTCOMES.EARLY_ENDED,
    reason: '    ',
    currentStatus: 'IN_PROGRESS',
  })

  assert.equal(resultBlank.valid, false)
  assert.equal(resultBlank.field, 'reason')
  assert.match(resultBlank.message, /bắt buộc/)
})

test('TC04: Lý do vượt quá 500 ký tự -> Bị từ chối để khớp với validation của Backend', () => {
  const longReason = 'a'.repeat(501)
  const resultLong = validateCloseVisitForm({
    outcome: CLOSE_VISIT_OUTCOMES.EARLY_ENDED,
    reason: longReason,
    currentStatus: 'IN_PROGRESS',
  })

  assert.equal(resultLong.valid, false)
  assert.equal(resultLong.field, 'reason')
  assert.match(resultLong.message, /500 ký tự/)
})

test('TC05: Chưa chọn outcome hoặc outcome không hợp lệ -> Bị từ chối', () => {
  const resultNoOutcome = validateCloseVisitForm({
    outcome: null,
    reason: 'Bệnh nhân bỏ về',
    currentStatus: 'IN_PROGRESS',
  })

  assert.equal(resultNoOutcome.valid, false)
  assert.equal(resultNoOutcome.field, 'outcome')
  assert.match(resultNoOutcome.message, /loại kết quả/i)
})

test('TC06: Lượt khám không ở trạng thái IN_PROGRESS -> Bị từ chối', () => {
  const resultWaiting = validateCloseVisitForm({
    outcome: CLOSE_VISIT_OUTCOMES.EARLY_ENDED,
    reason: 'Bệnh nhân xin về',
    currentStatus: 'WAITING',
  })

  assert.equal(resultWaiting.valid, false)
  assert.equal(resultWaiting.field, 'currentStatus')
  assert.match(resultWaiting.message, /IN_PROGRESS/)
})

test('TC07: Bệnh án đã được ký số hoặc khóa nội dung (QTN-18) -> Bị từ chối', () => {
  const resultSigned = validateCloseVisitForm({
    outcome: CLOSE_VISIT_OUTCOMES.EARLY_ENDED,
    reason: 'Bệnh nhân xin về',
    currentStatus: 'IN_PROGRESS',
    isRecordSigned: true,
  })

  assert.equal(resultSigned.valid, false)
  assert.equal(resultSigned.field, 'isRecordSigned')
  assert.match(resultSigned.message, /QTN-18/)
})

test('TC08: Chọn CANCELLED khi đơn thuốc đã phát -> Bị chặn và gợi ý chọn EARLY_ENDED', () => {
  const resultDispensed = validateCloseVisitForm({
    outcome: CLOSE_VISIT_OUTCOMES.CANCELLED,
    reason: 'Nhập nhầm ca',
    currentStatus: 'IN_PROGRESS',
    hasDispensedPrescriptions: true,
  })

  assert.equal(resultDispensed.valid, false)
  assert.equal(resultDispensed.suggestion, CLOSE_VISIT_OUTCOMES.EARLY_ENDED)
  assert.match(resultDispensed.message, /Kết thúc sớm/)
})

test('TC09: Phân quyền canUserCloseVisit - Bác sĩ phụ trách vs Bác sĩ khác vs Admin', () => {
  const doctorOwner = {
    id: 'doc-001',
    roles: ['ROLE_DOCTOR'],
    permissions: ['PERMISSION_QUEUE_UPDATE_STATUS'],
  }

  const doctorOther = {
    id: 'doc-999',
    roles: ['ROLE_DOCTOR'],
    permissions: ['PERMISSION_QUEUE_UPDATE_STATUS'],
  }

  const adminUser = {
    id: 'admin-001',
    roles: ['ROLE_ADMIN'],
    permissions: [],
  }

  const doctorNoPerm = {
    id: 'doc-001',
    roles: ['ROLE_DOCTOR'],
    permissions: ['PERMISSION_QUEUE_VIEW'],
  }

  // Bác sĩ phụ trách hàng đợi có quyền
  assert.equal(canUserCloseVisit(doctorOwner, { doctorId: 'doc-001' }), true)
  assert.equal(canUserCloseVisit(doctorOwner, 'doc-001'), true)

  // Bác sĩ khác không phụ trách hàng đợi này -> không có quyền
  assert.equal(canUserCloseVisit(doctorOther, { doctorId: 'doc-001' }), false)

  // Admin luôn có quyền với mọi hàng đợi
  assert.equal(canUserCloseVisit(adminUser, { doctorId: 'doc-001' }), true)

  // Bác sĩ thiếu quyền QUEUE_UPDATE_STATUS -> không có quyền
  assert.equal(canUserCloseVisit(doctorNoPerm, { doctorId: 'doc-001' }), false)

  // Người dùng null -> false
  assert.equal(canUserCloseVisit(null, { doctorId: 'doc-001' }), false)
})

test('TC10: Ánh xạ mã lỗi Backend trả về chính xác từng loại', () => {
  // 1. Lượt khám không còn IN_PROGRESS
  const errInvalidStatus = { response: { data: { code: 'VISIT_INVALID_STATUS' }, status: 409 } }
  const mapped1 = mapCloseVisitErrorMessage(errInvalidStatus, CLOSE_VISIT_OUTCOMES.EARLY_ENDED)
  assert.equal(mapped1.code, 'VISIT_INVALID_STATUS')
  assert.equal(mapped1.shouldRefreshQueue, true)
  assert.match(mapped1.message, /không còn ở trạng thái đang khám/)

  // 2. Bệnh án đã ký số / khóa (QTN-18)
  const errLocked = { response: { data: { code: 'MEDICAL_RECORD_LOCKED' }, status: 409 } }
  const mapped2 = mapCloseVisitErrorMessage(errLocked, CLOSE_VISIT_OUTCOMES.CANCELLED)
  assert.equal(mapped2.code, 'MEDICAL_RECORD_LOCKED')
  assert.match(mapped2.message, /QTN-18/)

  // 3. Đơn thuốc đã phát khi chọn CANCELLED
  const errDispensed = { response: { data: { code: 'PRESCRIPTION_ALREADY_DISPENSED' }, status: 409 } }
  const mapped3 = mapCloseVisitErrorMessage(errDispensed, CLOSE_VISIT_OUTCOMES.CANCELLED)
  assert.equal(mapped3.code, 'PRESCRIPTION_ALREADY_DISPENSED')
  assert.equal(mapped3.suggestEarlyEnded, true)
  assert.match(mapped3.message, /đã được phát/)

  // 4. Không có quyền (403 / UNAUTHORIZED_QUEUE_OPERATION)
  const errForbidden = { response: { data: { code: 'UNAUTHORIZED_QUEUE_OPERATION' }, status: 403 } }
  const mapped4 = mapCloseVisitErrorMessage(errForbidden, CLOSE_VISIT_OUTCOMES.EARLY_ENDED)
  assert.equal(mapped4.code, 'UNAUTHORIZED_QUEUE_OPERATION')
  assert.match(mapped4.message, /không có quyền/)

  // 5. Validation failed (400)
  const errVal = { response: { data: { code: 'VALIDATION_FAILED', message: 'Close reason must not exceed 500 characters.' }, status: 400 } }
  const mapped5 = mapCloseVisitErrorMessage(errVal, CLOSE_VISIT_OUTCOMES.EARLY_ENDED)
  assert.equal(mapped5.code, 'VALIDATION_FAILED')
  assert.match(mapped5.message, /500 ký tự/)
})
