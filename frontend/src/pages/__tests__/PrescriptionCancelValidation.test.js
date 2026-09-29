import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESET_CANCEL_REASONS,
  validateCancelPrescriptionReason,
  canCancelPrescription,
  getCancelRestrictionMessage,
} from '../../utils/prescriptionCancelValidation.js'

test('NCL-05-CN-005-TC-01: Lý do hủy hợp lệ (1-500 ký tự) được chấp nhận', () => {
  const result = validateCancelPrescriptionReason('Bệnh nhân thay đổi phác đồ điều trị sang tiêm.')
  assert.equal(result.valid, true)
  assert.equal(result.error, null)
  assert.equal(result.reason, 'Bệnh nhân thay đổi phác đồ điều trị sang tiêm.')

  // Kiểm tra cắt khoảng trắng đầu/cuối (trim)
  const trimmedResult = validateCancelPrescriptionReason('   Kê nhầm liều dùng 2 viên thay vì 1 viên   ')
  assert.equal(trimmedResult.valid, true)
  assert.equal(trimmedResult.reason, 'Kê nhầm liều dùng 2 viên thay vì 1 viên')

  // Kiểm tra độ dài biên: 1 ký tự
  const minResult = validateCancelPrescriptionReason('A')
  assert.equal(minResult.valid, true)

  // Kiểm tra độ dài biên: 500 ký tự
  const maxReason = 'X'.repeat(500)
  const maxResult = validateCancelPrescriptionReason(maxReason)
  assert.equal(maxResult.valid, true)
  assert.equal(maxResult.reason.length, 500)
})

test('NCL-05-CN-005-TC-02: Bắt buộc nhập lý do hủy, từ chối khi để trống, chỉ có khoảng trắng, hoặc quá 500 ký tự', () => {
  // Trống hoàn toàn
  const emptyRes = validateCancelPrescriptionReason('')
  assert.equal(emptyRes.valid, false)
  assert.ok(emptyRes.error.includes('không được để trống'))

  // Chỉ chứa khoảng trắng và xuống dòng
  const spaceRes = validateCancelPrescriptionReason('   \n\t   ')
  assert.equal(spaceRes.valid, false)
  assert.ok(spaceRes.error.includes('không được để trống'))

  // null hoặc undefined
  const nullRes = validateCancelPrescriptionReason(null)
  assert.equal(nullRes.valid, false)
  assert.ok(nullRes.error.includes('Vui lòng nhập lý do hủy'))

  const undefRes = validateCancelPrescriptionReason(undefined)
  assert.equal(undefRes.valid, false)
  assert.ok(undefRes.error.includes('Vui lòng nhập lý do hủy'))

  // Vượt quá 500 ký tự (501 ký tự)
  const tooLongReason = 'L'.repeat(501)
  const tooLongRes = validateCancelPrescriptionReason(tooLongReason)
  assert.equal(tooLongRes.valid, false)
  assert.ok(tooLongRes.error.includes('500 ký tự'))
})

test('NCL-05-CN-005-TC-03: Từ chối hủy đơn khi trạng thái là DISPENSED (hướng dẫn trả thuốc) hoặc CANCELLED', () => {
  // Đơn đã cấp phát DISPENSED
  const dispensedRx = { id: 'rx-1', status: 'DISPENSED', prescriptionCode: 'DT-001' }
  const checkDispensed = canCancelPrescription({
    userRoles: ['doctor'],
    prescription: dispensedRx,
  })
  assert.equal(checkDispensed.allowed, false)
  assert.ok(checkDispensed.reason.includes('Đơn thuốc đã được cấp phát'))
  assert.ok(checkDispensed.reason.includes('trả lại thuốc'))

  const restrictionMsgDispensed = getCancelRestrictionMessage(dispensedRx)
  assert.ok(restrictionMsgDispensed.includes('trả lại thuốc'))

  // Đơn đã hủy CANCELLED
  const cancelledRx = { id: 'rx-2', status: 'CANCELLED', prescriptionCode: 'DT-002' }
  const checkCancelled = canCancelPrescription({
    userRoles: ['doctor'],
    prescription: cancelledRx,
  })
  assert.equal(checkCancelled.allowed, false)
  assert.ok(checkCancelled.reason.includes('đã được hủy trước đó'))

  const restrictionMsgCancelled = getCancelRestrictionMessage(cancelledRx)
  assert.ok(restrictionMsgCancelled.includes('đã được hủy trước đó'))

  // Đơn chờ cấp phát PENDING_DISPENSE hợp lệ
  const pendingRx = { id: 'rx-3', status: 'PENDING_DISPENSE', prescriptionCode: 'DT-003' }
  const checkPending = canCancelPrescription({
    userRoles: ['doctor'],
    prescription: pendingRx,
  })
  assert.equal(checkPending.allowed, true)
  assert.equal(checkPending.reason, null)
  assert.equal(getCancelRestrictionMessage(pendingRx), null)
})

test('NCL-05-CN-005-TC-04: Phân quyền - Chỉ Bác sĩ đã kê đơn được phép hủy, Dược sĩ/Admin/Bác sĩ khác bị chặn', () => {
  const pendingRx = { id: 'rx-4', status: 'PENDING_DISPENSE', prescriptionCode: 'DT-004' }

  // 1. Dược sĩ thuần túy (pharmacist) -> Chặn
  const pharmacistCheck = canCancelPrescription({
    userRoles: ['pharmacist'],
    prescription: pendingRx,
  })
  assert.equal(pharmacistCheck.allowed, false)
  assert.ok(pharmacistCheck.reason.includes('Dược sĩ không có quyền hủy đơn thuốc'))

  // 2. Dược sĩ với prefix ROLE_PHARMACIST -> Chặn
  const rolePharmacistCheck = canCancelPrescription({
    userRoles: ['ROLE_PHARMACIST'],
    prescription: pendingRx,
  })
  assert.equal(rolePharmacistCheck.allowed, false)

  // 3. Tiếp tân / Điều dưỡng -> Chặn
  const receptionistCheck = canCancelPrescription({
    userRoles: ['receptionist'],
    prescription: pendingRx,
  })
  assert.equal(receptionistCheck.allowed, false)

  // 4. Quản trị viên (admin) thuần túy không có role DOCTOR -> Chặn (theo chuẩn Backend CancelPrescriptionService)
  const adminCheck = canCancelPrescription({
    userRoles: ['admin'],
    prescription: pendingRx,
  })
  assert.equal(adminCheck.allowed, false)
  assert.ok(adminCheck.reason.includes('Chức năng chỉ dành cho Bác sĩ'))

  // 5. Bác sĩ (doctor) -> Cho phép
  const doctorCheck = canCancelPrescription({
    userRoles: ['doctor'],
    prescription: pendingRx,
  })
  assert.equal(doctorCheck.allowed, true)

  // 6. Bác sĩ khác (không phải người kê đơn) -> Chặn
  const rxByDoc1 = { id: 'rx-5', status: 'PENDING_DISPENSE', prescribedBy: 'doc-user-1' }
  const otherDocCheck = canCancelPrescription({
    userRoles: ['doctor'],
    prescription: rxByDoc1,
    currentUserId: 'doc-user-2',
  })
  assert.equal(otherDocCheck.allowed, false)
  assert.ok(otherDocCheck.reason.includes('Chỉ bác sĩ đã kê đơn'))

  // 7. Đúng bác sĩ đã kê đơn -> Cho phép
  const sameDocCheck = canCancelPrescription({
    userRoles: ['doctor'],
    prescription: rxByDoc1,
    currentUserId: 'doc-user-1',
  })
  assert.equal(sameDocCheck.allowed, true)
})

test('NCL-05-CN-005: Danh mục lý do hủy mẫu (Preset Reasons) đầy đủ và có nghĩa lâm sàng', () => {
  assert.ok(Array.isArray(PRESET_CANCEL_REASONS))
  assert.ok(PRESET_CANCEL_REASONS.length >= 4)
  assert.ok(PRESET_CANCEL_REASONS.some((r) => r.includes('thay đổi phác đồ')))
  assert.ok(PRESET_CANCEL_REASONS.some((r) => r.includes('Kê nhầm')))
  assert.ok(PRESET_CANCEL_REASONS.some((r) => r.includes('từ chối')))
})

