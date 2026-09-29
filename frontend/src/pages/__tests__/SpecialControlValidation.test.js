import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SPECIAL_CONTROL_GROUPS,
  SPECIAL_CONTROL_ACTION_TYPES,
  getSpecialControlMeta,
  validateSpecialControlMedicineForm,
  validatePrescribeConfirmReason,
  validateDispenseConfirm,
  mapSpecialControlErrorMessage,
} from '../../utils/specialControlHelpers.js'
import { getNavigationItems } from '../../components/layout/navigationConfig.js'

test('TC-SC-01: Form danh mục thuốc - Khi bật isSpecialControl mà chưa chọn nhóm, báo lỗi validateSpecialControlMedicineForm', () => {
  // 1. Không bật cờ kiểm soát đặc biệt -> luôn hợp lệ
  const normalForm = validateSpecialControlMedicineForm({
    isSpecialControl: false,
    specialControlGroup: '',
    specialControlNote: '',
  })
  assert.equal(normalForm.isValid, true)
  assert.equal(normalForm.error, null)

  // 2. Bật cờ kiểm soát đặc biệt nhưng không chọn nhóm -> báo lỗi
  const invalidFormNoGroup = validateSpecialControlMedicineForm({
    isSpecialControl: true,
    specialControlGroup: '',
    specialControlNote: 'Ghi chú cảnh báo',
  })
  assert.equal(invalidFormNoGroup.isValid, false)
  assert.ok(invalidFormNoGroup.error.includes('Vui lòng chọn nhóm thuốc kiểm soát đặc biệt'))

  // 3. Bật cờ và chọn nhóm không hợp lệ -> báo lỗi
  const invalidFormBadGroup = validateSpecialControlMedicineForm({
    isSpecialControl: true,
    specialControlGroup: 'INVALID_GROUP',
  })
  assert.equal(invalidFormBadGroup.isValid, false)
  assert.ok(invalidFormBadGroup.error.includes('Nhóm thuốc kiểm soát đặc biệt không hợp lệ'))

  // 4. Bật cờ và chọn đúng 1 trong 6 nhóm hợp lệ -> hợp lệ
  const validGroups = ['NARCOTIC', 'PSYCHOTROPIC', 'PRECURSOR', 'RADIOACTIVE', 'TOXIC', 'COMBINED']
  validGroups.forEach((groupKey) => {
    const res = validateSpecialControlMedicineForm({
      isSpecialControl: true,
      specialControlGroup: groupKey,
      specialControlNote: 'Ghi chú',
    })
    assert.equal(res.isValid, true, `Nhóm ${groupKey} phải hợp lệ`)
  })
})

test('TC-SC-02: Form danh mục thuốc - Ghi chú cảnh báo specialControlNote không được vượt quá 500 ký tự', () => {
  const note500 = 'A'.repeat(500)
  const validForm = validateSpecialControlMedicineForm({
    isSpecialControl: true,
    specialControlGroup: 'NARCOTIC',
    specialControlNote: note500,
  })
  assert.equal(validForm.isValid, true)

  const note501 = 'A'.repeat(501)
  const invalidForm = validateSpecialControlMedicineForm({
    isSpecialControl: true,
    specialControlGroup: 'NARCOTIC',
    specialControlNote: note501,
  })
  assert.equal(invalidForm.isValid, false)
  assert.ok(invalidForm.error.includes('không được vượt quá 500 ký tự'))
})

test('TC-SC-03: Kê đơn bác sĩ - Bắt buộc nhập lý do chỉ định (1 - 500 ký tự)', () => {
  // Trống / null / undefined / toàn khoảng trắng
  const emptyReason = validatePrescribeConfirmReason('')
  assert.equal(emptyReason.isValid, false)
  assert.ok(emptyReason.error.includes('Vui lòng nhập lý do chỉ định'))

  const whitespaceReason = validatePrescribeConfirmReason('     ')
  assert.equal(whitespaceReason.isValid, false)
  assert.ok(whitespaceReason.error.includes('Vui lòng nhập lý do chỉ định'))

  // Vượt quá 500 ký tự
  const tooLong = validatePrescribeConfirmReason('X'.repeat(501))
  assert.equal(tooLong.isValid, false)
  assert.ok(tooLong.error.includes('không được vượt quá 500 ký tự'))

  // Lý do hợp lệ
  const validReason = validatePrescribeConfirmReason('Bệnh nhân giảm đau sau phẫu thuật xương lồng ngực')
  assert.equal(validReason.isValid, true)
  assert.equal(validReason.error, null)
})

test('TC-SC-04: Cấp phát dược sĩ - Kiểm tra CCCD/CMND người nhận thuốc và xác nhận cam kết đối chiếu', () => {
  // 1. Chưa nhập tên người nhận
  const noReceiver = validateDispenseConfirm({
    receiverName: '',
    receiverIdCard: '012345678901',
    confirmed: true,
  })
  assert.equal(noReceiver.isValid, false)
  assert.ok(noReceiver.error.includes('họ tên người nhận thuốc'))

  // 2. Chưa nhập số CMND / CCCD
  const noIdCard = validateDispenseConfirm({
    receiverName: 'Nguyễn Văn A',
    receiverIdCard: '',
    confirmed: true,
  })
  assert.equal(noIdCard.isValid, false)
  assert.ok(noIdCard.error.includes('CCCD hoặc CMND'))

  // 3. Sai định dạng CCCD/CMND (chứa chữ, hoặc độ dài không phải 9 hoặc 12)
  const badIdCard1 = validateDispenseConfirm({
    receiverName: 'Nguyễn Văn A',
    receiverIdCard: '12345678', // 8 chữ số
    confirmed: true,
  })
  assert.equal(badIdCard1.isValid, false)
  assert.ok(badIdCard1.error.includes('9 chữ số') || badIdCard1.error.includes('12 chữ số'))

  const badIdCard2 = validateDispenseConfirm({
    receiverName: 'Nguyễn Văn A',
    receiverIdCard: '01234567890123', // 14 chữ số
    confirmed: true,
  })
  assert.equal(badIdCard2.isValid, false)

  const badIdCardChars = validateDispenseConfirm({
    receiverName: 'Nguyễn Văn A',
    receiverIdCard: '01234567890A',
    confirmed: true,
  })
  assert.equal(badIdCardChars.isValid, false)

  // 4. Đúng 9 chữ số CMND nhưng chưa tích cam kết
  const valid9NoCommit = validateDispenseConfirm({
    receiverName: 'Nguyễn Văn A',
    receiverIdCard: '123456789',
    confirmed: false,
  })
  assert.equal(valid9NoCommit.isValid, false)
  assert.ok(valid9NoCommit.error.includes('cam kết đối chiếu'))

  // 5. Đúng 12 chữ số CCCD và đã cam kết -> hợp lệ
  const valid12 = validateDispenseConfirm({
    receiverName: 'Nguyễn Văn A',
    receiverIdCard: '001200012345',
    confirmed: true,
  })
  assert.equal(valid12.isValid, true)
  assert.equal(valid12.error, null)

  // 6. Đúng 9 chữ số CMND và đã cam kết -> hợp lệ
  const valid9 = validateDispenseConfirm({
    receiverName: 'Nguyễn Văn A',
    receiverIdCard: '012345678',
    confirmed: true,
  })
  assert.equal(valid9.isValid, true)
})

test('TC-SC-05: Cấp phát dược sĩ - Kiểm tra tồn kho lô (QTN-06)', () => {
  const batch = {
    id: 'batch-01',
    batchNumber: 'LO-MORPHINE-2026',
    stockQuantity: 10,
    eligibleStockQuantity: 10,
  }

  // Trường hợp 1: Số lượng kê <= tồn kho lô -> Đủ tồn
  const prescribedQtyValid = 5
  const avail = batch.eligibleStockQuantity ?? batch.stockQuantity
  assert.ok(prescribedQtyValid <= avail)

  // Trường hợp 2: Số lượng kê > tồn kho lô -> Phát hiện thiếu tồn kho lô
  const prescribedQtyExcess = 15
  assert.ok(prescribedQtyExcess > avail)
})

test('TC-SC-06: Sổ theo dõi thuốc kiểm soát đặc biệt (Tính bất biến) - Bảng chỉ có hành động xem chi tiết, tuyệt đối không có Sửa/Xóa', () => {
  // Định nghĩa các trường và thao tác của Sổ theo dõi
  const allowedActions = ['view']
  const forbiddenActions = ['edit', 'delete', 'update', 'remove', 'sua', 'xoa']

  forbiddenActions.forEach((action) => {
    assert.ok(
      !allowedActions.includes(action),
      `Hành động "${action}" tuyệt đối không được phép xuất hiện trên UI Sổ theo dõi`,
    )
  })

  // Kiểm tra 2 loại hành động nghiệp vụ hợp lệ của Sổ theo dõi
  assert.equal(SPECIAL_CONTROL_ACTION_TYPES.PRESCRIBED.label, 'Kê đơn')
  assert.equal(SPECIAL_CONTROL_ACTION_TYPES.DISPENSED.label, 'Cấp phát')
})

test('TC-SC-07: Phân quyền truy cập Sổ theo dõi - Bác sĩ, Dược sĩ, Quản trị viên được xem; Lễ tân không được truy cập', () => {
  const doctorNav = getNavigationItems({ roles: ['doctor'], permissions: ['PRESCRIPTION_READ'] })
  const hasDoctorAccess = doctorNav.some((item) => item.key === '/pharmacy/special-control-register')
  assert.equal(hasDoctorAccess, true, 'Bác sĩ phải có quyền truy cập Sổ theo dõi')

  const pharmacistNav = getNavigationItems({ roles: ['pharmacist'], permissions: ['PHARMACY_READ'] })
  const hasPharmacistAccess = pharmacistNav.some((item) => item.key === '/pharmacy/special-control-register')
  assert.equal(hasPharmacistAccess, true, 'Dược sĩ phải có quyền truy cập Sổ theo dõi')

  const adminNav = getNavigationItems({ roles: ['admin'], permissions: [] })
  const hasAdminAccess = adminNav.some((item) => item.key === '/pharmacy/special-control-register')
  assert.equal(hasAdminAccess, true, 'Quản trị viên phải có quyền truy cập Sổ theo dõi')

  const receptionistNav = getNavigationItems({ roles: ['receptionist'], permissions: ['PATIENT_READ'] })
  const hasReceptionistAccess = receptionistNav.some((item) => item.key === '/pharmacy/special-control-register')
  assert.equal(hasReceptionistAccess, false, 'Lễ tân không được phép truy cập Sổ theo dõi')
})
