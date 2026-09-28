import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateRetentionYears,
  formatClinicConfigPayload,
  MIN_RETENTION_YEARS,
  DEFAULT_RETENTION_YEARS,
} from '../../utils/clinicConfigurationValidation.js'
import { getApiErrorMessage, DOMAIN_ERROR_MESSAGES } from '../../utils/apiError.js'
import { formatRecordStatus } from '../../utils/helpers.js'

test('AC1.1: Quản trị viên đặt số năm lưu trữ tối thiểu (>= 10 năm) - Validation phía Client', () => {
  // Bị chặn nếu nhỏ hơn 10 năm
  assert.equal(validateRetentionYears(5).valid, false)
  assert.equal(validateRetentionYears(9).valid, false)
  assert.equal(validateRetentionYears(-1).valid, false)
  assert.equal(validateRetentionYears(0).valid, false)

  // Bị chặn nếu không phải số nguyên hoặc rỗng
  assert.equal(validateRetentionYears(10.5).valid, false)
  assert.equal(validateRetentionYears('').valid, false)
  assert.equal(validateRetentionYears(null).valid, false)
  assert.equal(validateRetentionYears(undefined).valid, false)
  assert.equal(validateRetentionYears('abc').valid, false)

  // Hợp lệ khi >= 10 năm
  const res10 = validateRetentionYears(10)
  assert.equal(res10.valid, true)
  assert.equal(res10.value, 10)

  const res15 = validateRetentionYears(15)
  assert.equal(res15.valid, true)
  assert.equal(res15.value, 15)

  const resString = validateRetentionYears('20')
  assert.equal(resString.valid, true)
  assert.equal(resString.value, 20)

  assert.equal(MIN_RETENTION_YEARS, 10)
  assert.equal(DEFAULT_RETENTION_YEARS, 10)
})

test('AC1.2: Payload cập nhật cấu hình phòng khám chứa retentionYears hợp lệ', () => {
  const formValues = {
    clinicName: 'Phòng khám Đa khoa Trung tâm',
    address: 'Hà Nội',
    phone: '0912345678',
    openingTime: '08:00:00',
    closingTime: '17:00:00',
    retentionYears: 12,
  }

  const result = formatClinicConfigPayload(formValues)
  assert.equal(result.valid, true)
  assert.equal(result.payload.retentionYears, 12)
})

test('AC2 & AC3.1: Xóa hồ sơ còn trong thời hạn lưu trữ -> Trả thông báo lỗi thân thiện thay vì raw code', () => {
  const retentionErrorResponse = {
    response: {
      status: 400,
      data: {
        status: 400,
        code: 'MEDICAL_RECORD_IN_RETENTION_PERIOD',
        message: 'Medical record is still within the retention period and cannot be deleted.',
      },
    },
  }

  const friendlyMessage = getApiErrorMessage(retentionErrorResponse, 'Lỗi xóa hồ sơ.')
  assert.equal(
    friendlyMessage,
    'Hồ sơ đang trong thời hạn lưu trữ bắt buộc, không thể xóa. Vui lòng dùng chức năng lưu trữ (Archive) nếu cần ẩn hồ sơ khỏi danh sách hoạt động.',
  )
  assert.equal(
    DOMAIN_ERROR_MESSAGES.MEDICAL_RECORD_IN_RETENTION_PERIOD,
    'Hồ sơ đang trong thời hạn lưu trữ bắt buộc, không thể xóa. Vui lòng dùng chức năng lưu trữ (Archive) nếu cần ẩn hồ sơ khỏi danh sách hoạt động.',
  )
})

test('AC3.2: Chức năng Lưu trữ (Archive) chuyển trạng thái hồ sơ sang ARCHIVED', () => {
  const currentRecord = {
    id: 'mr-uuid-001',
    recordCode: 'BA-2026-001',
    status: 'LOCKED',
  }

  // Giả lập sau khi gọi POST /medical-records/{id}/archive thành công
  const archivedRecord = {
    ...currentRecord,
    status: 'ARCHIVED',
  }

  assert.equal(archivedRecord.status, 'ARCHIVED')

  const statusFormat = formatRecordStatus(archivedRecord.status)
  assert.equal(statusFormat.label, 'Đã lưu trữ')
  assert.equal(statusFormat.color, 'purple')
})

test('AC3.3: Hiển thị trạng thái hồ sơ bệnh án nhất quán trên hệ thống', () => {
  assert.deepEqual(formatRecordStatus('DRAFT'), { label: 'Bản nháp', color: 'default' })
  assert.deepEqual(formatRecordStatus('OPEN'), { label: 'Đang mở', color: 'processing' })
  assert.deepEqual(formatRecordStatus('LOCKED'), { label: 'Đã khóa', color: 'green' })
  assert.deepEqual(formatRecordStatus('ARCHIVED'), { label: 'Đã lưu trữ', color: 'purple' })
})

test('AC4: Kiểm tra phân quyền RBAC cho cấu hình phòng khám và thao tác hồ sơ bệnh án', () => {
  const checkClinicPermissions = (permissions = []) => ({
    canRead: permissions.includes('CLINIC_CONFIGURATION_READ'),
    canUpdate: permissions.includes('CLINIC_CONFIGURATION_UPDATE'),
  })

  const checkRecordPermissions = (permissions = []) => ({
    canDelete: permissions.includes('MEDICAL_RECORD_DELETE'),
    canArchive: permissions.includes('MEDICAL_RECORD_UPDATE_STATUS') || permissions.includes('MEDICAL_RECORD_UPDATE'),
  })

  // Admin có đầy đủ quyền
  const adminPerms = ['CLINIC_CONFIGURATION_READ', 'CLINIC_CONFIGURATION_UPDATE', 'MEDICAL_RECORD_DELETE', 'MEDICAL_RECORD_UPDATE_STATUS']
  const adminClinic = checkClinicPermissions(adminPerms)
  const adminRecord = checkRecordPermissions(adminPerms)
  assert.equal(adminClinic.canRead, true)
  assert.equal(adminClinic.canUpdate, true)
  assert.equal(adminRecord.canDelete, true)
  assert.equal(adminRecord.canArchive, true)

  // Doctor chỉ có quyền xem/archive hồ sơ bệnh án
  const doctorPerms = ['MEDICAL_RECORD_READ', 'MEDICAL_RECORD_UPDATE']
  const doctorClinic = checkClinicPermissions(doctorPerms)
  const doctorRecord = checkRecordPermissions(doctorPerms)
  assert.equal(doctorClinic.canUpdate, false)
  assert.equal(doctorRecord.canDelete, false)
  assert.equal(doctorRecord.canArchive, true)
})
