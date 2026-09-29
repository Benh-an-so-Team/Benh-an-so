import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PRESET_REPLACEMENT_REASONS,
  PRESCRIPTION_STATUS_REPLACED,
  REPLACED_STATUS_CONFIG,
  canReplacePrescription,
  validateReplacementReason,
  getReplacementLinkInfo,
  mapReplacementErrorMessage,
} from './prescriptionReplacementHelpers.js'

test('1. canReplacePrescription - kiểm tra đầy đủ các tổ hợp điều kiện', () => {
  const doctorUser = {
    id: 'doc-001',
    role: 'DOCTOR',
    roles: ['DOCTOR'],
    permissions: ['PRESCRIPTION_UPDATE'],
  }

  const validPrescription = {
    id: 'rx-001',
    prescriptionCode: 'RX000001',
    status: 'PENDING_DISPENSE',
    interconnectionStatus: 'SUCCESS',
    interconnectionReceiptCode: 'LT-20260925-0001',
    prescribedBy: 'doc-001',
  }

  // Case 1: Đủ mọi điều kiện -> TRUE
  assert.equal(
    canReplacePrescription(validPrescription, doctorUser),
    true,
    'Bác sĩ kê đơn gốc với đơn SUCCESS + PENDING_DISPENSE phải được phép thay thế',
  )

  // Case 2: Trạng thái không phải PENDING_DISPENSE -> FALSE
  assert.equal(
    canReplacePrescription({ ...validPrescription, status: 'DISPENSED' }, doctorUser),
    false,
    'Đơn đã cấp phát không được thay thế',
  )
  assert.equal(
    canReplacePrescription({ ...validPrescription, status: 'PARTIALLY_DISPENSED' }, doctorUser),
    false,
    'Đơn cấp phát một phần không được thay thế',
  )
  assert.equal(
    canReplacePrescription({ ...validPrescription, status: 'CANCELLED' }, doctorUser),
    false,
    'Đơn đã hủy không được thay thế',
  )
  assert.equal(
    canReplacePrescription({ ...validPrescription, status: 'REPLACED' }, doctorUser),
    false,
    'Đơn đã bị thay thế không được thay thế lần 2',
  )

  // Case 3: Trạng thái liên thông chưa thành công -> FALSE
  assert.equal(
    canReplacePrescription(
      { ...validPrescription, interconnectionStatus: 'NOT_SENT', interconnectionReceiptCode: null },
      doctorUser,
    ),
    false,
    'Đơn chưa liên thông không được thay thế',
  )
  assert.equal(
    canReplacePrescription(
      { ...validPrescription, interconnectionStatus: 'FAILED', interconnectionReceiptCode: null },
      doctorUser,
    ),
    false,
    'Đơn liên thông thất bại không được thay thế',
  )

  // Case 4: Không phải bác sĩ kê đơn gốc (khác ID) -> FALSE
  assert.equal(
    canReplacePrescription(
      validPrescription,
      { ...doctorUser, id: 'doc-999' },
    ),
    false,
    'Bác sĩ khác không được thay thế đơn của đồng nghiệp',
  )

  // Case 5: Quản trị viên (Admin) không phải bác sĩ kê đơn gốc -> FALSE
  const adminUser = {
    id: 'admin-001',
    role: 'ADMIN',
    roles: ['ADMIN'],
    permissions: ['PRESCRIPTION_UPDATE'],
  }
  assert.equal(
    canReplacePrescription(validPrescription, adminUser),
    false,
    'Quản trị viên không được phép thay thế đơn (Backend chặn 403)',
  )

  // Case 6: Dược sĩ -> FALSE
  const pharmacistUser = {
    id: 'pharm-001',
    role: 'PHARMACIST',
    roles: ['PHARMACIST'],
  }
  assert.equal(
    canReplacePrescription(validPrescription, pharmacistUser),
    false,
    'Dược sĩ không được phép thay thế đơn',
  )

  // Case 7: Dữ liệu null / undefined -> FALSE an toàn, không crash
  assert.equal(canReplacePrescription(null, doctorUser), false)
  assert.equal(canReplacePrescription(validPrescription, null), false)
  assert.equal(canReplacePrescription({}, {}), false)
})

test('2. validateReplacementReason - kiểm tra ràng buộc độ dài và ký tự', () => {
  // Null / undefined
  assert.equal(validateReplacementReason(null).valid, false)
  assert.equal(validateReplacementReason(undefined).valid, false)

  // Rỗng hoặc toàn khoảng trắng
  assert.equal(validateReplacementReason('').valid, false)
  assert.equal(validateReplacementReason('   \n  \t ').valid, false)

  // Hợp lệ bình thường
  const validRes = validateReplacementReason('Sai liều lượng thuốc so với chẩn đoán')
  assert.equal(validRes.valid, true)
  assert.equal(validRes.error, null)
  assert.equal(validRes.reason, 'Sai liều lượng thuốc so với chẩn đoán')

  // Biên 500 ký tự: đúng 500 ký tự -> hợp lệ
  const text500 = 'A'.repeat(500)
  assert.equal(validateReplacementReason(text500).valid, true)

  // Biên 501 ký tự -> không hợp lệ
  const text501 = 'A'.repeat(501)
  const invalidRes = validateReplacementReason(text501)
  assert.equal(invalidRes.valid, false)
  assert.ok(invalidRes.error.includes('500 ký tự'))

  // Danh sách preset gợi ý có ít nhất 4 mục
  assert.ok(PRESET_REPLACEMENT_REASONS.length >= 4)
  PRESET_REPLACEMENT_REASONS.forEach((reason) => {
    assert.equal(validateReplacementReason(reason).valid, true)
  })
})

test('3. getReplacementLinkInfo - trích xuất thông tin chuỗi liên kết đơn thuốc', () => {
  // Đơn độc lập, không liên kết
  assert.equal(getReplacementLinkInfo(null), null)
  assert.equal(getReplacementLinkInfo({}), null)
  assert.equal(getReplacementLinkInfo({ id: 'rx-1', prescriptionCode: 'RX001' }), null)

  // Đơn thay thế (trỏ về đơn gốc)
  const replacementRx = {
    id: 'rx-2',
    prescriptionCode: 'RX000002',
    replacesPrescriptionId: 'rx-1',
    replacesPrescriptionCode: 'RX000001',
    replacementReason: 'Đổi liều Paracetamol',
  }
  const link1 = getReplacementLinkInfo(replacementRx)
  assert.ok(link1)
  assert.equal(link1.type, 'REPLACEMENT')
  assert.equal(link1.isReplacement, true)
  assert.equal(link1.isReplaced, false)
  assert.equal(link1.linkedId, 'rx-1')
  assert.equal(link1.linkedCode, 'RX000001')
  assert.equal(link1.reason, 'Đổi liều Paracetamol')

  // Đơn gốc đã bị thay thế (trỏ sang đơn mới)
  const replacedRx = {
    id: 'rx-1',
    prescriptionCode: 'RX000001',
    status: 'REPLACED',
    replacedByPrescriptionId: 'rx-2',
    replacedByPrescriptionCode: 'RX000002',
  }
  const link2 = getReplacementLinkInfo(replacedRx)
  assert.ok(link2)
  assert.equal(link2.type, 'REPLACED')
  assert.equal(link2.isReplacement, false)
  assert.equal(link2.isReplaced, true)
  assert.equal(link2.linkedId, 'rx-2')
  assert.equal(link2.linkedCode, 'RX000002')
})

test('4. mapReplacementErrorMessage - ánh xạ chuẩn xác từng loại lỗi', () => {
  // 403 không phải bác sĩ gốc
  const err403Owner = { response: { status: 403, data: { code: 'UNAUTHORIZED_PRESCRIPTION_REPLACEMENT' } } }
  assert.ok(mapReplacementErrorMessage(err403Owner).includes('Chỉ bác sĩ trực tiếp kê đơn thuốc gốc'))

  // 403 chung
  const err403General = { response: { status: 403, data: { code: 'ACCESS_DENIED' } } }
  assert.ok(mapReplacementErrorMessage(err403General).includes('không có quyền'))

  // 404 không tìm thấy
  const err404 = { response: { status: 404, data: { code: 'PRESCRIPTION_NOT_FOUND' } } }
  assert.ok(mapReplacementErrorMessage(err404).includes('Không tìm thấy đơn thuốc gốc'))

  // 409 đã cấp phát
  const err409Dispensed = { response: { status: 409, data: { code: 'PRESCRIPTION_ALREADY_DISPENSED' } } }
  assert.ok(mapReplacementErrorMessage(err409Dispensed).includes('đã được cấp phát, không thể thay thế'))

  // 409 đã hủy
  const err409Cancelled = { response: { status: 409, data: { code: 'PRESCRIPTION_ALREADY_CANCELLED' } } }
  assert.ok(mapReplacementErrorMessage(err409Cancelled).includes('đã bị hủy, không thể thay thế'))

  // 409 chưa liên thông
  const err409NotInterconnected = {
    response: {
      status: 409,
      data: {
        code: 'PRESCRIPTION_INVALID_STATUS',
        message: 'Only successfully interconnected prescriptions can be replaced.',
      },
    },
  }
  assert.ok(mapReplacementErrorMessage(err409NotInterconnected).includes('đã liên thông thành công'))

  // 409 đã từng bị thay thế
  const err409AlreadyReplaced = {
    response: {
      status: 409,
      data: {
        code: 'PRESCRIPTION_INVALID_STATUS',
        message: 'Prescription has already been replaced.',
      },
    },
  }
  assert.ok(mapReplacementErrorMessage(err409AlreadyReplaced).includes('đã được thay thế trước đó'))

  // Confirmation required overrides
  assert.ok(mapReplacementErrorMessage({ data: { code: 'INTERACTION_CONFIRMATION_REQUIRED' } }).includes('tương tác thuốc'))
  assert.ok(mapReplacementErrorMessage({ data: { code: 'ALLERGY_CONFIRMATION_REQUIRED' } }).includes('dị ứng'))
  assert.ok(mapReplacementErrorMessage({ data: { code: 'CONTRAINDICATION_CONFIRMATION_REQUIRED' } }).includes('chống chỉ định'))
  assert.ok(mapReplacementErrorMessage({ data: { code: 'MAX_DAILY_DOSE_CONFIRMATION_REQUIRED' } }).includes('liều tối đa'))
  assert.ok(mapReplacementErrorMessage({ data: { code: 'CONTROLLED_MEDICINE_CONFIRMATION_REQUIRED' } }).includes('kiểm soát đặc biệt'))

  // Fallback an toàn
  assert.ok(mapReplacementErrorMessage(null).length > 0)
  assert.ok(mapReplacementErrorMessage({}).length > 0)
})

test('5. REPLACED status config - cấu hình nhãn và trạng thái không gây crash', () => {
  assert.equal(PRESCRIPTION_STATUS_REPLACED, 'REPLACED')
  assert.equal(REPLACED_STATUS_CONFIG.label, 'Đã bị thay thế')
  assert.equal(REPLACED_STATUS_CONFIG.color, 'purple')
})
