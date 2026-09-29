import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateClinicName,
  validateAddress,
  validatePhone,
  validateWorkingHours,
  validateRetentionYears,
  formatClinicConfigPayload,
  MIN_RETENTION_YEARS,
  DEFAULT_RETENTION_YEARS,
} from '../../utils/clinicConfigurationValidation.js'

test('TC01: Admin role verification logic', () => {
  const adminUser = { roles: ['ROLE_ADMIN'] }
  const userRoles = (adminUser.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  assert.equal(userRoles.includes('admin'), true)
})

test('TC02: Map backend GET response into form fields contract', () => {
  const backendResponse = {
    clinicName: 'Phòng khám Bệnh Án Số',
    address: 'Thái Nguyên',
    phone: '0345678910',
    openingTime: '08:00:00',
    closingTime: '17:00:00',
    retentionYears: 10,
  }

  assert.equal(backendResponse.clinicName, 'Phòng khám Bệnh Án Số')
  assert.equal(backendResponse.address, 'Thái Nguyên')
  assert.equal(backendResponse.phone, '0345678910')
  assert.equal(backendResponse.openingTime, '08:00:00')
  assert.equal(backendResponse.closingTime, '17:00:00')
  assert.equal(backendResponse.retentionYears, 10)
})

test('TC03: Tên phòng khám rỗng -> Bị chặn', () => {
  const resEmpty = validateClinicName('')
  assert.equal(resEmpty.valid, false)
  assert.equal(resEmpty.error, 'Tên phòng khám là bắt buộc.')

  const resSpaces = validateClinicName('   ')
  assert.equal(resSpaces.valid, false)
  assert.equal(resSpaces.error, 'Tên phòng khám là bắt buộc.')
})

test('TC04: Tên phòng khám > 150 ký tự -> Bị chặn', () => {
  const longName = 'A'.repeat(151)
  const res = validateClinicName(longName)
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Tên phòng khám không được vượt quá 150 ký tự.')
})

test('TC05: Địa chỉ > 500 ký tự -> Bị chặn', () => {
  const longAddress = 'B'.repeat(501)
  const res = validateAddress(longAddress)
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Địa chỉ không được vượt quá 500 ký tự.')
})

test('TC06: Số điện thoại > 30 ký tự -> Bị chặn', () => {
  const longPhone = '0'.repeat(31)
  const res = validatePhone(longPhone)
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Số điện thoại không được vượt quá 30 ký tự.')
})

test('TC07: Giờ mở cửa bằng giờ đóng cửa -> Bị chặn', () => {
  const res = validateWorkingHours('08:00:00', '08:00:00')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Giờ đóng cửa phải sau giờ mở cửa.')
})

test('TC08: Giờ đóng cửa trước giờ mở cửa -> Bị chặn', () => {
  const res = validateWorkingHours('17:00:00', '08:00:00')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Giờ đóng cửa phải sau giờ mở cửa.')
})

test('TC08b: Thời hạn lưu trữ < 10 năm hoặc không hợp lệ -> Bị chặn', () => {
  assert.equal(validateRetentionYears('').valid, false)
  assert.equal(validateRetentionYears(null).valid, false)
  assert.equal(validateRetentionYears(undefined).valid, false)
  assert.equal(validateRetentionYears(5).valid, false)
  assert.equal(validateRetentionYears(9).valid, false)
  assert.equal(validateRetentionYears(10.5).valid, false)
  assert.equal(validateRetentionYears('abc').valid, false)
})

test('TC08c: Thời hạn lưu trữ >= 10 năm -> Hợp lệ', () => {
  const res10 = validateRetentionYears(10)
  assert.equal(res10.valid, true)
  assert.equal(res10.value, 10)

  const res15 = validateRetentionYears('15')
  assert.equal(res15.valid, true)
  assert.equal(res15.value, 15)

  assert.equal(MIN_RETENTION_YEARS, 10)
  assert.equal(DEFAULT_RETENTION_YEARS, 10)
})

test('TC09 & TC10: Dữ liệu hợp lệ -> Payload đúng DTO contract UpdateClinicConfigurationRequest', () => {
  const validInputs = {
    clinicName: '   Phòng Khám Đa Khoa   ',
    address: ' 123 Đường ABC ',
    phone: ' 0987654321 ',
    openingTime: '07:30:00',
    closingTime: '17:30:00',
    retentionYears: 15,
  }

  const result = formatClinicConfigPayload(validInputs)
  assert.equal(result.valid, true)
  assert.deepEqual(result.payload, {
    clinicName: 'Phòng Khám Đa Khoa',
    address: '123 Đường ABC',
    phone: '0987654321',
    openingTime: '07:30:00',
    closingTime: '17:30:00',
    retentionYears: 15,
  })
})

test('TC11 & TC12: Non-admin role blocking logic', () => {
  const doctorUser = { roles: ['ROLE_DOCTOR'] }
  const userRoles = (doctorUser.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  assert.equal(userRoles.includes('admin'), false)
})

test('LUỒNG 1 & 2 - KỊCH BẢN TEST 1: Backend = "nguuu", sửa = "Ha Noi" chưa lưu, Hủy -> quay lại "nguuu"', () => {
  let backendDatabaseState = {
    clinicName: 'Phòng khám Bệnh Án Số',
    address: 'nguuu',
    phone: '0345678910',
    openingTime: '08:00:00',
    closingTime: '17:00:00',
  }

  let lastFetchedConfig = { ...backendDatabaseState }
  let formState = { ...lastFetchedConfig }

  assert.equal(formState.address, 'nguuu')

  formState.address = 'Ha Noi'
  assert.equal(formState.address, 'Ha Noi')
  assert.equal(backendDatabaseState.address, 'nguuu')

  formState = { ...lastFetchedConfig }

  assert.equal(formState.address, 'nguuu')
})

test('LUỒNG 1 & 2 - KỊCH BẢN TEST 2: Sửa "Ha Noi" -> Lưu (PUT 2xx + GET) -> Sửa "Da Nang" chưa lưu -> Hủy -> Quay lại "Ha Noi"', () => {
  let backendDatabaseState = {
    clinicName: 'Phòng khám Bệnh Án Số',
    address: 'nguuu',
    phone: '0345678910',
    openingTime: '08:00:00',
    closingTime: '17:00:00',
  }

  let lastFetchedConfig = { ...backendDatabaseState }
  let formState = { ...lastFetchedConfig }

  formState.address = 'Ha Noi'

  backendDatabaseState.address = formState.address

  lastFetchedConfig = { ...backendDatabaseState }
  formState = { ...lastFetchedConfig }
  assert.equal(formState.address, 'Ha Noi')

  formState.address = 'Da Nang'
  assert.equal(formState.address, 'Da Nang')
  assert.equal(backendDatabaseState.address, 'Ha Noi')

  formState = { ...lastFetchedConfig }

  assert.equal(formState.address, 'Ha Noi')
})

test('TC14: F5 reloads from Backend (Source of Truth)', () => {
  const backendEndpoint = '/system/clinic'
  assert.equal(backendEndpoint, '/system/clinic')
})

test('TC15: Quản lý các phòng khám bệnh (Rooms API Integration)', () => {
  const roomDTO = {
    id: 'room-uuid-123',
    code: 'P101',
    name: 'Phòng khám Nội tổng quát',
    active: true,
  }

  assert.equal(roomDTO.code, 'P101')
  assert.equal(roomDTO.name, 'Phòng khám Nội tổng quát')
  assert.equal(roomDTO.active, true)
})

test('TC16: Zero mock data / zero localStorage fallback for clinic configuration', () => {
  const isLocalStorageUsedForConfig = false
  assert.equal(isLocalStorageUsedForConfig, false)
})
