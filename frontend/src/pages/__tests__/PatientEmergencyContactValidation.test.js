import test from 'node:test'
import assert from 'node:assert/strict'

import {
  VIETNAMESE_PHONE_REGEX,
  EMERGENCY_RELATIONSHIPS,
  isValidEmergencyPhone,
  validateEmergencyContactTriplet,
  formatEmergencyContactDisplay,
  saveEmergencyContactHistory,
  getEmergencyContactHistory,
  EMERGENCY_HISTORY_STORAGE_KEY,
} from '../../utils/emergencyContactValidation.js'

// Mock localStorage cho môi trường node:test
const mockStorage = {}
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => {
    mockStorage[key] = String(val)
  },
  removeItem: (key) => {
    delete mockStorage[key]
  },
  clear: () => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  },
}

test('NCL-02-CN-007-TC-01: Danh mục mối quan hệ gợi ý chuẩn y tế có đầy đủ các vai trò phổ biến', () => {
  const expectedRoles = ['Bố', 'Mẹ', 'Vợ', 'Chồng', 'Con', 'Anh/Chị/Em', 'Ông/Bà', 'Người giám hộ', 'Khác']
  for (const role of expectedRoles) {
    assert.ok(
      EMERGENCY_RELATIONSHIPS.includes(role),
      `Danh mục phải chứa mối quan hệ: ${role}`
    )
  }
})

test('NCL-02-CN-007-TC-01: Định dạng chuỗi hiển thị tóm tắt Người liên hệ khẩn cấp chuẩn xác', () => {
  const patientFull = {
    emergencyContact: 'Trần Văn Cường',
    emergencyRelationship: 'Bố',
    emergencyPhone: '0912345678',
  }
  const formatted = formatEmergencyContactDisplay(patientFull)
  assert.equal(formatted, 'Trần Văn Cường (Bố) • 0912345678')

  const patientWithoutRel = {
    emergencyContact: 'Lê Thị Thu',
    emergencyPhone: '0987654321',
  }
  assert.equal(formatEmergencyContactDisplay(patientWithoutRel), 'Lê Thị Thu • 0987654321')

  const patientEmpty = {
    emergencyContact: '',
    emergencyRelationship: '',
    emergencyPhone: '',
  }
  assert.equal(formatEmergencyContactDisplay(patientEmpty), null)
  assert.equal(formatEmergencyContactDisplay(null), null)
})

test('NCL-02-CN-007-TC-02: Kiểm tra số điện thoại Việt Nam hợp lệ (10 số, đầu số di động hoặc +84)', () => {
  // Hợp lệ với các đầu số di động chính thống tại Việt Nam
  assert.equal(isValidEmergencyPhone('0912345678'), true, 'Đầu 09 hợp lệ')
  assert.equal(isValidEmergencyPhone('0389998888'), true, 'Đầu 03 hợp lệ')
  assert.equal(isValidEmergencyPhone('0521234567'), true, 'Đầu 05 hợp lệ')
  assert.equal(isValidEmergencyPhone('0701234567'), true, 'Đầu 07 hợp lệ')
  assert.equal(isValidEmergencyPhone('0868123456'), true, 'Đầu 08 hợp lệ')
  assert.equal(isValidEmergencyPhone('+84912345678'), true, 'Đầu +84 hợp lệ')

  // Hợp lệ với số điện thoại che mặt nạ của chế độ ẩn danh (QTN-43)
  assert.equal(isValidEmergencyPhone('09******78'), true, 'Mặt nạ ẩn danh 09******78 hợp lệ')

  // Hợp lệ khi rỗng (tùy chọn)
  assert.equal(isValidEmergencyPhone(''), true, 'Chuỗi rỗng hợp lệ')
  assert.equal(isValidEmergencyPhone(null), true, 'null hợp lệ')
  assert.equal(isValidEmergencyPhone(undefined), true, 'undefined hợp lệ')

  // Không hợp lệ
  assert.equal(isValidEmergencyPhone('0123456789'), false, 'Đầu số 01 cũ không còn hợp lệ')
  assert.equal(isValidEmergencyPhone('0243123456'), false, 'Số điện thoại cố định đầu 024 không hợp lệ')
  assert.equal(isValidEmergencyPhone('091234567'), false, 'Thiếu 1 chữ số (chỉ có 9 số)')
  assert.equal(isValidEmergencyPhone('09123456789'), false, 'Thừa 1 chữ số (có 11 số)')
  assert.equal(isValidEmergencyPhone('0912abc678'), false, 'Chứa ký tự chữ cái')
  assert.equal(isValidEmergencyPhone('abcdefghij'), false, 'Toàn chữ cái')
})

test('NCL-02-CN-007 Cohesive Triplet: Cho phép xóa trắng hoặc không khai báo cả 3 trường', () => {
  const result1 = validateEmergencyContactTriplet({
    emergencyContact: '',
    emergencyRelationship: '',
    emergencyPhone: '',
  })
  assert.equal(result1.valid, true)
  assert.equal(result1.isCleared, true)
  assert.deepEqual(result1.errors, {})

  const result2 = validateEmergencyContactTriplet({})
  assert.equal(result2.valid, true)
  assert.equal(result2.isCleared, true)

  const result3 = validateEmergencyContactTriplet({
    emergencyContact: null,
    emergencyRelationship: null,
    emergencyPhone: null,
  })
  assert.equal(result3.valid, true)
  assert.equal(result3.isCleared, true)
})

test('NCL-02-CN-007 Cohesive Triplet: Khai báo thành công khi có đủ cả 3 thông tin hợp lệ', () => {
  const result = validateEmergencyContactTriplet({
    emergencyContact: 'Nguyễn Văn Nam',
    emergencyRelationship: 'Anh/Chị/Em',
    emergencyPhone: '0934567890',
  })
  assert.equal(result.valid, true)
  assert.equal(result.isCleared, false)
  assert.deepEqual(result.errors, {})
})

test('NCL-02-CN-007 Cohesive Triplet: Từ chối khi thiếu 1 hoặc 2 trong 3 trường', () => {
  // Chỉ nhập Họ tên
  const res1 = validateEmergencyContactTriplet({
    emergencyContact: 'Nguyễn Văn Nam',
    emergencyRelationship: '',
    emergencyPhone: '',
  })
  assert.equal(res1.valid, false)
  assert.ok(res1.errors.emergencyRelationship, 'Phải báo thiếu mối quan hệ')
  assert.ok(res1.errors.emergencyPhone, 'Phải báo thiếu số điện thoại')

  // Chỉ nhập SĐT
  const res2 = validateEmergencyContactTriplet({
    emergencyContact: '',
    emergencyRelationship: '',
    emergencyPhone: '0912345678',
  })
  assert.equal(res2.valid, false)
  assert.ok(res2.errors.emergencyContact, 'Phải báo thiếu họ tên')
  assert.ok(res2.errors.emergencyRelationship, 'Phải báo thiếu mối quan hệ')

  // Nhập Họ tên và SĐT nhưng thiếu Mối quan hệ
  const res3 = validateEmergencyContactTriplet({
    emergencyContact: 'Nguyễn Văn Nam',
    emergencyRelationship: '',
    emergencyPhone: '0912345678',
  })
  assert.equal(res3.valid, false)
  assert.ok(res3.errors.emergencyRelationship, 'Phải báo lỗi thiếu mối quan hệ')
  assert.equal(res3.errors.emergencyContact, undefined)
  assert.equal(res3.errors.emergencyPhone, undefined)

  // Nhập Họ tên và Mối quan hệ nhưng thiếu SĐT
  const res4 = validateEmergencyContactTriplet({
    emergencyContact: 'Nguyễn Văn Nam',
    emergencyRelationship: 'Bố',
    emergencyPhone: '',
  })
  assert.equal(res4.valid, false)
  assert.ok(res4.errors.emergencyPhone, 'Phải báo lỗi thiếu số điện thoại')

  // Nhập Mối quan hệ và SĐT nhưng thiếu Họ tên
  const res5 = validateEmergencyContactTriplet({
    emergencyContact: '',
    emergencyRelationship: 'Bố',
    emergencyPhone: '0912345678',
  })
  assert.equal(res5.valid, false)
  assert.ok(res5.errors.emergencyContact, 'Phải báo lỗi thiếu họ tên')
})

test('NCL-02-CN-007 Cohesive Triplet: Từ chối khi SĐT sai định dạng hoặc trường vượt độ dài quy định', () => {
  // SĐT sai định dạng
  const res1 = validateEmergencyContactTriplet({
    emergencyContact: 'Nguyễn Văn Nam',
    emergencyRelationship: 'Bố',
    emergencyPhone: '12345',
  })
  assert.equal(res1.valid, false)
  assert.ok(res1.errors.emergencyPhone.includes('Số điện thoại không đúng định dạng'))

  // Họ tên vượt quá 100 ký tự
  const res2 = validateEmergencyContactTriplet({
    emergencyContact: 'A'.repeat(101),
    emergencyRelationship: 'Bố',
    emergencyPhone: '0912345678',
  })
  assert.equal(res2.valid, false)
  assert.ok(res2.errors.emergencyContact.includes('không được vượt quá 100 ký tự'))

  // Mối quan hệ vượt quá 50 ký tự
  const res3 = validateEmergencyContactTriplet({
    emergencyContact: 'Nguyễn Văn Nam',
    emergencyRelationship: 'B'.repeat(51),
    emergencyPhone: '0912345678',
  })
  assert.equal(res3.valid, false)
  assert.ok(res3.errors.emergencyRelationship.includes('không được vượt quá 50 ký tự'))
})

test('NCL-02-CN-007-TC-03: Ghi nhận và trích xuất lịch sử lưu vết thay đổi người liên hệ khẩn cấp', () => {
  const patientId = 12345

  const entry1 = saveEmergencyContactHistory(patientId, {
    actor: 'Lễ tân Hoàng',
    oldValue: 'Chưa thiết lập',
    newValue: 'Trần Văn Cường (Bố) • 0912345678',
  })

  assert.ok(entry1.id)
  assert.equal(entry1.actor, 'Lễ tân Hoàng')

  const entry2 = saveEmergencyContactHistory(patientId, {
    actor: 'Lễ tân Mai',
    oldValue: 'Trần Văn Cường (Bố) • 0912345678',
    newValue: 'Đã xóa người liên hệ',
  })

  const history = getEmergencyContactHistory(patientId)
  assert.equal(history.length, 2)
  assert.equal(history[0].newValue, 'Đã xóa người liên hệ')
  assert.equal(history[1].newValue, 'Trần Văn Cường (Bố) • 0912345678')
})
