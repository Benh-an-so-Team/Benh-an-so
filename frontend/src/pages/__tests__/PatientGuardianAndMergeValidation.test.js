import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dayjs from 'dayjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  checkIdentityConflict,
  comparePatientFields,
  buildMergedPatientProfile,
  MERGE_COMPARISON_FIELDS,
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

test('NCL-02-CN-006-TC-06: Phát hiện mâu thuẫn danh tính khi cả 2 hồ sơ đều có bệnh án đã ký -> Từ chối gộp hoàn toàn', () => {
  const patientA = {
    id: 'p-signed-001',
    patientCode: 'BN000001',
    fullName: 'Nguyễn Văn Tuấn',
    dateOfBirth: '1990-01-01',
    gender: 'MALE',
    hasFinalizedMedicalRecords: true,
  }

  const patientB = {
    id: 'p-signed-002',
    patientCode: 'BN000002',
    fullName: 'Trần Văn Tuấn', // Khác họ tên
    dateOfBirth: '1990-01-01',
    gender: 'MALE',
    hasFinalizedMedicalRecords: true,
  }

  // Kiểm tra qua checkIdentityConflict
  const conflict = checkIdentityConflict(patientA, patientB)
  assert.equal(conflict.hasConflict, true, 'Phải phát hiện mâu thuẫn danh tính trên bệnh án đã ký')
  assert.equal(conflict.conflictType, 'SIGNED_RECORDS_DEMOGRAPHIC_CONFLICT')
  assert.ok(conflict.reason.includes('đã có bệnh án đã ký'), 'Thông báo phải nêu rõ lý do bệnh án đã ký')
  assert.ok(conflict.recommendation.includes('từ chối gộp tự động'), 'Phải có khuyến nghị an toàn y tế')

  // Kiểm tra qua validatePatientMerge
  const validation = validatePatientMerge(patientA, patientB, 'Thử gộp')
  assert.equal(validation.allowed, false, 'Không cho phép gộp')
  assert.equal(validation.conflictType, 'SIGNED_RECORDS_DEMOGRAPHIC_CONFLICT')
})

test('NCL-02-CN-006-TC-07: Phát hiện mâu thuẫn số CCCD/CMND giữa 2 hồ sơ -> Từ chối gộp ngay', () => {
  const patient1 = {
    id: 'p-cccd-001',
    patientCode: 'BN000011',
    fullName: 'Lê Hoàng Long',
    identityNumber: '001090001234',
  }

  const patient2 = {
    id: 'p-cccd-002',
    patientCode: 'BN000012',
    fullName: 'Lê Hoàng Long',
    identityNumber: '001090009999', // Khác CCCD
  }

  const conflict = checkIdentityConflict(patient1, patient2)
  assert.equal(conflict.hasConflict, true)
  assert.equal(conflict.conflictType, 'IDENTITY_NUMBER_MISMATCH')
  assert.ok(conflict.reason.includes('001090001234'))

  const validation = validatePatientMerge(patient1, patient2, 'Gộp trùng')
  assert.equal(validation.allowed, false)
})

test('NCL-02-CN-006-TC-08: Không mâu thuẫn khi chỉ 1 bên có bệnh án ký hoặc thông tin danh tính trùng khớp', () => {
  const patient1 = {
    id: 'p-ok-001',
    patientCode: 'BN000021',
    fullName: 'Nguyễn Thị Mai',
    dateOfBirth: '1995-05-15',
    gender: 'FEMALE',
    hasFinalizedMedicalRecords: true, // Có bệnh án ký
  }

  const patient2 = {
    id: 'p-ok-002',
    patientCode: 'BN000022',
    fullName: 'Nguyễn Thị Mai',
    dateOfBirth: '1995-05-15',
    gender: 'FEMALE',
    hasFinalizedMedicalRecords: false, // Chưa có bệnh án ký
  }

  const conflict = checkIdentityConflict(patient1, patient2)
  assert.equal(conflict.hasConflict, false, 'Không có mâu thuẫn danh tính')

  const validation = validatePatientMerge(patient1, patient2, 'Gộp bình thường')
  assert.equal(validation.allowed, true)
})

test('NCL-02-CN-006-TC-09: So sánh trường: Giống nhau gom 1 dòng, khác nhau làm nổi bật có radio chọn', () => {
  const p1 = {
    id: 'p-comp-001',
    patientCode: 'BN000101',
    fullName: 'Vũ Đức Đam',
    dateOfBirth: '1985-08-20',
    gender: 'MALE',
    identityNumber: '001085007890',
    phone: '0912345678', // SĐT cũ
    address: 'Hà Nội',   // Địa chỉ đúng
  }

  const p2 = {
    id: 'p-comp-002',
    patientCode: 'BN000102',
    fullName: 'Vũ Đức Đam',
    dateOfBirth: '1985-08-20',
    gender: 'MALE',
    identityNumber: '001085007890',
    phone: '0988776655', // SĐT mới
    address: 'Hải Phòng',// Địa chỉ cũ
  }

  const result = comparePatientFields(p1, p2)
  assert.ok(result.fields.length >= 8, 'Phải có đầy đủ các trường thông tin cá nhân cần so sánh')

  // Họ tên, ngày sinh, giới tính, CCCD giống nhau
  const nameField = result.fields.find((f) => f.key === 'fullName')
  assert.equal(nameField.isIdentical, true, 'Họ tên trùng khớp phải có isIdentical = true')

  // Số điện thoại khác nhau
  const phoneField = result.fields.find((f) => f.key === 'phone')
  assert.equal(phoneField.isIdentical, false, 'Số điện thoại khác nhau phải isIdentical = false')
  assert.equal(phoneField.val1, '0912345678')
  assert.equal(phoneField.val2, '0988776655')

  // Địa chỉ khác nhau
  const addrField = result.fields.find((f) => f.key === 'address')
  assert.equal(addrField.isIdentical, false)
})

test('NCL-02-CN-006-TC-10: Một bên để trống trường được coi là khác nhau và mặc định chọn bên có sẵn dữ liệu', () => {
  const p1 = {
    id: 'p-empty-001',
    fullName: 'Phạm Minh Chính',
    address: '123 Ba Đình, Hà Nội', // p1 có địa chỉ
    insuranceNumber: null,           // p1 trống BHYT
  }

  const p2 = {
    id: 'p-empty-002',
    fullName: 'Phạm Minh Chính',
    address: '',                     // p2 trống địa chỉ
    insuranceNumber: 'DN4010123456789', // p2 có BHYT
  }

  const result = comparePatientFields(p1, p2)

  // Địa chỉ: p1 có, p2 trống -> Mặc định chọn p1
  const addrField = result.fields.find((f) => f.key === 'address')
  assert.equal(addrField.isIdentical, false)
  assert.equal(addrField.isOneSideEmpty, true)
  assert.equal(addrField.emptySide, 'p2')
  assert.equal(addrField.recommendedSide, 'p1', 'Phải gợi ý bên có dữ liệu (p1)')
  assert.equal(result.initialSelections.address, 'p1')

  // BHYT: p1 trống, p2 có -> Mặc định chọn p2
  const insField = result.fields.find((f) => f.key === 'insuranceNumber')
  assert.equal(insField.isIdentical, false)
  assert.equal(insField.isOneSideEmpty, true)
  assert.equal(insField.emptySide, 'p1')
  assert.equal(insField.recommendedSide, 'p2', 'Phải gợi ý bên có dữ liệu (p2)')
  assert.equal(result.initialSelections.insuranceNumber, 'p2')
})

test('NCL-02-CN-006-TC-11: Cả hai bên đều có dữ liệu khác nhau -> Mặc định gợi ý bên cập nhật gần đây nhất (updatedAt)', () => {
  const p1Old = {
    id: 'p-old-001',
    fullName: 'Đoàn Văn Hậu',
    phone: '0901111111',
    updatedAt: '2026-01-01T10:00:00Z', // Cũ hơn
  }

  const p2New = {
    id: 'p-new-002',
    fullName: 'Đoàn Văn Hậu',
    phone: '0902222222',
    updatedAt: '2026-09-20T15:30:00Z', // Mới hơn
  }

  const result = comparePatientFields(p1Old, p2New)
  const phoneField = result.fields.find((f) => f.key === 'phone')
  assert.equal(phoneField.isIdentical, false)
  assert.equal(phoneField.recommendedSide, 'p2', 'Phải gợi ý p2 vì có updatedAt mới hơn')
  assert.equal(result.initialSelections.phone, 'p2')
})

test('NCL-02-CN-006-TC-12: Tách biệt lựa chọn mã hồ sơ giữ lại và sinh preview hồ sơ bệnh nhân cuối cùng', () => {
  const p1 = {
    id: 'p-target-001',
    patientCode: 'BN000001',
    fullName: 'Nguyễn Văn An',
    phone: '0911111111', // Cũ
    address: 'Số 10 Phố Huế, Hà Nội', // Đúng
    bloodType: 'O',
  }

  const p2 = {
    id: 'p-source-002',
    patientCode: 'BN000002',
    fullName: 'Nguyễn Văn An',
    phone: '0999999999', // Mới
    address: 'Địa chỉ cũ',
    bloodType: 'O',
  }

  // Chọn giữ lại mã của p1 (BN000001), nhưng SĐT lấy từ p2, địa chỉ lấy từ p1
  const selections = {
    fullName: 'p1',
    phone: 'p2',   // Lấy từ p2
    address: 'p1', // Lấy từ p1
    bloodType: 'p1',
  }

  const preview = buildMergedPatientProfile(p1, p2, p1.id, selections)

  // Mã hồ sơ được bảo lưu chính xác
  assert.equal(preview.patientCode, 'BN000001')
  assert.equal(preview.retainedPatientCode, 'BN000001')
  assert.equal(preview.otherPatientCode, 'BN000002')

  // Dữ liệu từng trường lấy đúng nguồn đã chọn
  assert.equal(preview.phone, '0999999999', 'Số điện thoại phải lấy từ p2')
  assert.equal(preview.phoneNumber, '0999999999')
  assert.equal(preview.address, 'Số 10 Phố Huế, Hà Nội', 'Địa chỉ phải lấy từ p1')
  assert.equal(preview.bloodType, 'O')
})

test('NCL-02-CN-006-TC-13: Kiểm tra cấu trúc MergePatientModal.jsx tích hợp đầy đủ bảng so sánh, chọn lọc từng trường, mâu thuẫn bệnh án đã ký và xác nhận phụ', () => {
  const modalPath = path.resolve(__dirname, '../../components/patient/MergePatientModal.jsx')
  assert.equal(fs.existsSync(modalPath), true, 'File MergePatientModal.jsx bắt buộc phải tồn tại')

  const content = fs.readFileSync(modalPath, 'utf-8')

  // 1. Phân quyền truy cập
  assert.ok(content.includes('canUserMergePatients'), 'Phải sử dụng canUserMergePatients để kiểm tra quyền RBAC')
  assert.ok(content.includes('Từ chối quyền truy cập gộp hồ sơ'), 'Phải có thông báo từ chối truy cập cho Bác sĩ')

  // 2. Kiểm tra mâu thuẫn danh tính trên bệnh án đã ký
  assert.ok(content.includes('checkIdentityConflict'), 'Phải gọi hàm checkIdentityConflict kiểm tra mâu thuẫn danh tính')
  assert.ok(content.includes('TỪ CHỐI GỘP HOÀN TOÀN DO MÂU THUẪN DANH TÍNH'), 'Phải có khối cảnh báo từ chối mâu thuẫn danh tính')

  // 3. Xử lý hồ sơ đã từng bị gộp trước đó
  assert.ok(content.includes('Hồ sơ đã ở trạng thái ĐÃ GỘP'), 'Phải có cảnh báo chặn thao tác khi hồ sơ đã gộp trước đó')

  // 4. Bảng so sánh 2 cột và các dòng giống/khác nhau
  assert.ok(content.includes('comparePatientFields'), 'Phải gọi comparePatientFields để phân loại các trường')
  assert.ok(content.includes('merge-comparison-table-wrapper'), 'Phải có bảng so sánh 2 cột')
  assert.ok(content.includes('identical-row'), 'Phải có class style cho dòng giống nhau')
  assert.ok(content.includes('different-row'), 'Phải có class style nổi bật cho dòng khác biệt')

  // 5. Chọn mã hồ sơ giữ lại tách biệt với chọn trường
  assert.ok(content.includes('CHỌN HỒ SƠ GIỮ LẠI (BẢO LƯU MÃ HỒ SƠ DUY NHẤT)'), 'Phải có phần chọn hồ sơ giữ lại mã định danh tách biệt')
  assert.ok(content.includes('retained-selector-container'), 'Phải có container chọn hồ sơ giữ lại')

  // 6. Khối xem trước hồ sơ sau khi gộp
  assert.ok(content.includes('merge-preview-card'), 'Phải có card xem trước hồ sơ sau khi gộp')
  assert.ok(content.includes('merge-medical-data-notice'), 'Phải có khối nhắc nhở toàn bộ dữ liệu y tế luôn được chuyển giao')

  // 7. Xác nhận phụ
  assert.ok(content.includes('confirmModalVisible') || content.includes('setConfirmModalVisible'), 'Phải có bước xác nhận phụ trước khi gộp')
  assert.ok(content.includes('Xác nhận phụ: Chuyển giao toàn bộ dữ liệu y tế'), 'Tiêu đề xác nhận phụ phải nêu rõ chuyển giao dữ liệu y tế')
})

test('NCL-02-CN-006-TC-14: Kiểm tra Stylesheet patientMergeModal.css định nghĩa đầy đủ giao diện bảng so sánh và các trạng thái', () => {
  const cssPath = path.resolve(__dirname, '../../styles/patientMergeModal.css')
  assert.equal(fs.existsSync(cssPath), true, 'File stylesheet patientMergeModal.css phải tồn tại')

  const css = fs.readFileSync(cssPath, 'utf-8')
  assert.ok(css.includes('.merge-comparison-table-wrapper'), 'Phải có style cho bảng so sánh')
  assert.ok(css.includes('.different-row'), 'Phải có style highlight dòng khác biệt')
  assert.ok(css.includes('.identical-row'), 'Phải có style cho dòng trùng khớp')
  assert.ok(css.includes('.merge-identity-conflict-card'), 'Phải có style cho card từ chối do mâu thuẫn danh tính')
  assert.ok(css.includes('.merge-preview-card'), 'Phải có style cho preview card')
  assert.ok(css.includes('.retained-selector-container'), 'Phải có style cho bộ chọn hồ sơ giữ lại mã')
})


