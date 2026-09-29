import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'

import {
  isMinorPatient,
  isValidGuardianPhone,
  validateGuardianFields,
  requiresAdultTransition,
  formatGuardianDisplay,
  GUARDIAN_RELATIONSHIP_PRESETS,
} from '../../utils/patientGuardianValidation.js'

import {
  canUserMergePatients,
  validatePatientMerge,
  cleanMergeErrorMessage,
  MERGE_REASON_PRESETS,
} from '../../utils/patientMergeValidation.js'

// ============================================================================
// NCL-02-CN-008: Hồ sơ bệnh nhân trẻ em gắn người giám hộ (QTN-44 & QTN-24)
// ============================================================================

test('NCL-02-CN-008-TC-01: Bệnh nhân dưới 18 tuổi được xác định là trẻ em và cho phép gắn người giám hộ thành công', () => {
  const asOf = dayjs('2026-09-16')
  // 10 tuổi
  const minorDob = '2016-05-10'
  assert.equal(isMinorPatient(minorDob, asOf), true, 'Bệnh nhân sinh năm 2016 phải là trẻ em vào năm 2026')

  // Đầy đủ thông tin người giám hộ
  const validation = validateGuardianFields({
    dateOfBirth: minorDob,
    guardianName: 'Trần Văn Phụ Huynh',
    guardianRelationship: 'Bố',
    guardianPhone: '0912345678',
    guardianIdentityNumber: '001085001234',
  }, asOf)

  assert.equal(validation.valid, true, 'Khai báo đầy đủ người giám hộ phải hợp lệ')
  assert.equal(validation.isMinor, true, 'isMinor phải là true')
  assert.deepEqual(validation.errors, {})

  // Kiểm tra hiển thị tóm tắt
  const display = formatGuardianDisplay({
    guardianName: 'Trần Văn Phụ Huynh',
    guardianRelationship: 'Bố',
    guardianPhone: '0912345678',
  })
  assert.equal(display, 'Trần Văn Phụ Huynh (Bố) • 0912345678')
})

test('NCL-02-CN-008-TC-02: Bệnh nhân dưới 18 tuổi thiếu thông tin người giám hộ sẽ bị chặn lập hồ sơ (QTN-44)', () => {
  const asOf = dayjs('2026-09-16')
  const minorDob = '2015-01-01' // 11 tuổi

  // Không có thông tin người giám hộ nào
  const emptyValidation = validateGuardianFields({
    dateOfBirth: minorDob,
  }, asOf)

  assert.equal(emptyValidation.valid, false, 'Thiếu thông tin người giám hộ phải bị từ chối')
  assert.equal(emptyValidation.isMinor, true)
  assert.ok(emptyValidation.errors.guardianName, 'Phải có lỗi tên người giám hộ')
  assert.ok(emptyValidation.errors.guardianRelationship, 'Phải có lỗi mối quan hệ')
  assert.ok(emptyValidation.errors.guardianPhone, 'Phải có lỗi số điện thoại')

  // Số điện thoại sai định dạng
  const invalidPhoneValidation = validateGuardianFields({
    dateOfBirth: minorDob,
    guardianName: 'Nguyễn Thị Mẹ',
    guardianRelationship: 'Mẹ',
    guardianPhone: '123456', // Sai định dạng
  }, asOf)

  assert.equal(invalidPhoneValidation.valid, false)
  assert.ok(invalidPhoneValidation.errors.guardianPhone.includes('định dạng'))

  // Bệnh nhân người lớn (trên 18 tuổi) không bị bắt buộc
  const adultDob = '2000-01-01' // 26 tuổi
  const adultValidation = validateGuardianFields({
    dateOfBirth: adultDob,
  }, asOf)
  assert.equal(adultValidation.valid, true, 'Người lớn không bắt buộc người giám hộ')
  assert.equal(adultValidation.isMinor, false)
})

test('NCL-02-CN-008-TC-03: Kiểm tra định dạng số điện thoại người giám hộ chuẩn viễn thông Việt Nam', () => {
  assert.equal(isValidGuardianPhone('0912345678'), true)
  assert.equal(isValidGuardianPhone('0388888888'), true)
  assert.equal(isValidGuardianPhone('0771234567'), true)
  assert.equal(isValidGuardianPhone('0866666666'), true)
  assert.equal(isValidGuardianPhone('0521234567'), true)

  // Không hợp lệ
  assert.equal(isValidGuardianPhone('0243123456'), false, 'Số bàn không hợp lệ')
  assert.equal(isValidGuardianPhone('091234567'), false, '9 số không hợp lệ')
  assert.equal(isValidGuardianPhone('09123456789'), false, '11 số không hợp lệ')
  assert.equal(isValidGuardianPhone('abcdefghij'), false)
  assert.equal(isValidGuardianPhone(''), false)
})

test('NCL-02-CN-008-TC-04: Bệnh nhân đã đủ 18 tuổi nhưng còn người giám hộ sẽ được nhắc nhở chuyển tiếp thành niên', () => {
  const asOf = dayjs('2026-09-16')

  // Bệnh nhân tròn 18 tuổi (sinh 2008-01-01, asOf 2026-09-16 -> 18 tuổi)
  const patientNowAdult = {
    dateOfBirth: '2008-01-01',
    guardianName: 'Lê Văn Cha',
    guardianPhone: '0909999888',
  }
  assert.equal(
    requiresAdultTransition(patientNowAdult, asOf),
    true,
    'Người đủ 18 tuổi có người giám hộ phải yêu cầu chuyển tiếp thành niên (TC-04)'
  )

  // Bệnh nhân vẫn dưới 18 tuổi (sinh 2012-01-01) -> không chuyển tiếp thành niên
  const minorPatient = {
    dateOfBirth: '2012-01-01',
    guardianName: 'Lê Văn Cha',
  }
  assert.equal(requiresAdultTransition(minorPatient, asOf), false)

  // Người lớn không có người giám hộ -> không chuyển tiếp
  const normalAdult = {
    dateOfBirth: '1995-01-01',
    guardianName: null,
  }
  assert.equal(requiresAdultTransition(normalAdult, asOf), false)
})

test('NCL-02-CN-008-TC-05: Danh mục mối quan hệ người giám hộ có đầy đủ các vai trò phổ biến', () => {
  const requiredRoles = ['Bố', 'Mẹ', 'Ông', 'Bà', 'Người giám hộ hợp pháp']
  for (const role of requiredRoles) {
    assert.ok(
      GUARDIAN_RELATIONSHIP_PRESETS.includes(role),
      `Danh mục quan hệ phải chứa: ${role}`
    )
  }
})

// ============================================================================
// NCL-02-CN-006: Gộp hồ sơ bệnh nhân trùng (QTN-33, QTN-10, QTN-02)
// ============================================================================

test('NCL-02-CN-006-TC-01: Kiểm tra hợp lệ thao tác gộp 2 hồ sơ bệnh nhân thành công', () => {
  const sourcePatient = {
    id: 'p-source-001',
    patientCode: 'BN000020',
    fullName: 'Nguyễn Văn Nam',
    isMerged: false,
    status: 'ACTIVE',
  }

  const targetPatient = {
    id: 'p-target-001',
    patientCode: 'BN000010',
    fullName: 'Nguyễn Văn Nam',
    isMerged: false,
    status: 'ACTIVE',
  }

  const result = validatePatientMerge(sourcePatient, targetPatient, 'Trùng hồ sơ do tiếp đón')
  assert.equal(result.allowed, true, 'Gộp 2 hồ sơ hợp lệ phải được chấp thuận')
  assert.equal(result.message, null)
})

test('NCL-02-CN-006-TC-02: Không thể gộp một hồ sơ bệnh nhân vào chính nó (CANNOT_MERGE_SAME_PATIENT)', () => {
  const patient = {
    id: 'p-same-001',
    patientCode: 'BN000001',
    fullName: 'Hoàng Văn Cường',
  }

  const result = validatePatientMerge(patient, patient, 'Thử gộp vào chính nó')
  assert.equal(result.allowed, false)
  assert.ok(result.message.includes('chính nó'), 'Phải báo lỗi không thể gộp vào chính nó')
})

test('NCL-02-CN-006-TC-03: Không thể gộp hồ sơ đã ở trạng thái MERGED (PATIENT_ALREADY_MERGED)', () => {
  const mergedSource = {
    id: 'p-merged-001',
    patientCode: 'BN000099',
    fullName: 'Đỗ Thị Hạnh',
    isMerged: true,
    status: 'MERGED',
  }

  const activeTarget = {
    id: 'p-active-001',
    patientCode: 'BN000088',
    fullName: 'Đỗ Thị Hạnh',
    isMerged: false,
    status: 'ACTIVE',
  }

  const resSourceMerged = validatePatientMerge(mergedSource, activeTarget, 'Lý do gộp')
  assert.equal(resSourceMerged.allowed, false)
  assert.ok(resSourceMerged.message.includes('đã ở trạng thái đã gộp'), 'Hồ sơ nguồn đã gộp không được gộp tiếp')

  const resTargetMerged = validatePatientMerge(activeTarget, mergedSource, 'Lý do gộp')
  assert.equal(resTargetMerged.allowed, false)
  assert.ok(resTargetMerged.message.includes('đã ở trạng thái đã gộp'), 'Hồ sơ đích đã gộp không được chọn làm đích')
})

test('NCL-02-CN-006-TC-04: Phân quyền RBAC cho phép Lễ tân, Quản lý, Admin và chặn Bác sĩ, Dược sĩ', () => {
  // Được phép gộp
  assert.equal(canUserMergePatients(['receptionist'], []), true, 'Lễ tân được quyền gộp hồ sơ')
  assert.equal(canUserMergePatients(['ROLE_RECEPTIONIST'], []), true)
  assert.equal(canUserMergePatients(['admin'], []), true, 'Admin được quyền gộp hồ sơ')
  assert.equal(canUserMergePatients(['manager'], []), true, 'Quản lý được quyền gộp hồ sơ')
  assert.equal(canUserMergePatients([], ['PATIENT_MERGE']), true, 'Có permission PATIENT_MERGE được phép')

  // Bị từ chối quyền (TC-04: HTTP 403)
  assert.equal(canUserMergePatients(['doctor'], []), false, 'Bác sĩ không có quyền gộp hồ sơ')
  assert.equal(canUserMergePatients(['ROLE_DOCTOR'], []), false)
  assert.equal(canUserMergePatients(['pharmacist'], []), false, 'Dược sĩ không có quyền gộp hồ sơ')
  assert.equal(canUserMergePatients([], ['PATIENT_READ']), false, 'Chỉ có quyền đọc không được gộp')
})

test('NCL-02-CN-006-TC-05: Chuyển đổi mã lỗi API sang thông điệp tiếng Việt thân thiện chuẩn mực', () => {
  // CANNOT_MERGE_SAME_PATIENT
  const errSame = { response: { data: { code: 'CANNOT_MERGE_SAME_PATIENT' } } }
  assert.equal(
    cleanMergeErrorMessage(errSame),
    'Không thể gộp hồ sơ vào chính nó.'
  )

  // PATIENT_ALREADY_MERGED
  const errMerged = { response: { data: { code: 'PATIENT_ALREADY_MERGED' } } }
  assert.equal(
    cleanMergeErrorMessage(errMerged),
    'Một trong hai hồ sơ đã ở trạng thái đã gộp trước đó.'
  )

  // ACCESS_DENIED / 403 Forbidden
  const err403 = { response: { status: 403, data: { message: 'Forbidden' } } }
  assert.ok(
    cleanMergeErrorMessage(err403).includes('quyền'),
    '403 phải giải thích rõ người dùng thiếu quyền hạn'
  )

  // PATIENT_NOT_FOUND / 404
  const err404 = { response: { status: 404 } }
  assert.ok(
    cleanMergeErrorMessage(err404).includes('Không tìm thấy')
  )

  // Danh mục lý do gộp hồ sơ gợi ý chuẩn
  assert.ok(MERGE_REASON_PRESETS.length >= 3)
})
