import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canViewMedicalRecordVersionHistory,
  normalizeVersionHistoryData,
  validateVersionHistoryQuery,
} from '../../utils/medicalRecordVersionHelpers.js'

test('1. KIỂM THỬ PHÂN QUYỀN TRUY CẬP LỊCH SỬ PHIÊN BẢN (RBAC & Permissions)', () => {
  assert.equal(canViewMedicalRecordVersionHistory(['manager']), true, 'Manager phải có quyền xem lịch sử phiên bản')
  assert.equal(canViewMedicalRecordVersionHistory(['clinic_manager']), true, 'Clinic manager phải có quyền xem lịch sử phiên bản')
  assert.equal(canViewMedicalRecordVersionHistory(['admin']), true, 'Admin phải có quyền xem lịch sử phiên bản')
  assert.equal(canViewMedicalRecordVersionHistory(['ROLE_CLINIC_MANAGER']), true, 'ROLE_ prefix phải được chuẩn hóa đúng')
  assert.equal(canViewMedicalRecordVersionHistory(['ROLE_MANAGER']), true, 'ROLE_ prefix phải được chuẩn hóa đúng')

  assert.equal(canViewMedicalRecordVersionHistory(['doctor']), false, 'Bác sĩ không có quyền mặc định xem toàn bộ lịch sử quản lý nếu không cấp permission')
  assert.equal(canViewMedicalRecordVersionHistory(['receptionist']), false, 'Lễ tân không có quyền')
  assert.equal(canViewMedicalRecordVersionHistory(['pharmacist']), false, 'Dược sĩ không có quyền')
  assert.equal(canViewMedicalRecordVersionHistory(['staff']), false, 'Nhân viên không có quyền')
  assert.equal(canViewMedicalRecordVersionHistory([]), false, 'Không có vai trò phải bị từ chối')

  assert.equal(
    canViewMedicalRecordVersionHistory(['doctor'], ['MEDICAL_RECORD_VERSION_HISTORY_READ']),
    true,
    'Bác sĩ được cấp permission MEDICAL_RECORD_VERSION_HISTORY_READ phải được truy cập'
  )
  assert.equal(
    canViewMedicalRecordVersionHistory(['doctor'], ['PERMISSION_MEDICAL_RECORD_VERSION_HISTORY_READ']),
    true,
    'Permission có tiền tố PERMISSION_ phải được xử lý đúng'
  )
  assert.equal(
    canViewMedicalRecordVersionHistory([], ['AUDIT_READ']),
    true,
    'Người dùng có quyền AUDIT_READ được phép truy cập'
  )
})

test('2. KIỂM THỬ ĐIỀU KIỆN TRUY VẤN LỊCH SỬ PHIÊN BẢN', () => {
  const validQuery1 = validateVersionHistoryQuery('e0000000-0000-0000-0000-000000000009')
  assert.equal(validQuery1.valid, true)
  assert.equal(validQuery1.recordId, 'e0000000-0000-0000-0000-000000000009')
  assert.equal(validQuery1.error, null)

  const validQuery2 = validateVersionHistoryQuery({ id: 'rec-123', patientName: 'Nguyễn Văn A' })
  assert.equal(validQuery2.valid, true)
  assert.equal(validQuery2.recordId, 'rec-123')

  const validQuery3 = validateVersionHistoryQuery({ medicalRecordId: 'mr-456' })
  assert.equal(validQuery3.valid, true)
  assert.equal(validQuery3.recordId, 'mr-456')

  const invalidQuery1 = validateVersionHistoryQuery(null)
  assert.equal(invalidQuery1.valid, false)
  assert.match(invalidQuery1.error, /không hợp lệ/)

  const invalidQuery2 = validateVersionHistoryQuery({})
  assert.equal(invalidQuery2.valid, false)
  assert.match(invalidQuery2.error, /Không tìm thấy ID/)
})

test('3. KIỂM THỬ HIỂN THỊ HỒ SƠ CHỈ CÓ BẢN GỐC (Chưa có bản đính chính)', () => {
  const rawData = {
    originalOnly: true,
    originalVersion: {
      versionNumber: 1,
      modifiedBy: 'BS. Lê Minh Hoàng',
      modifiedAt: '2026-08-20T08:30:00Z',
      reason: null,
      content: null,
      snapshot: {
        chiefComplaint: 'Đau tức ngực trái khi gắng sức',
        symptoms: 'Khó thở nhẹ, vã mồ hôi',
        medicalHistory: 'Tăng huyết áp 3 năm',
        physicalExamination: 'Tim nhịp đều, T1 T2 rõ, HA 140/90 mmHg',
        clinicalProgress: 'Đã chỉ định điện tim và men tim',
        treatmentPlan: 'Nghỉ ngơi tại chỗ, dùng thuốc hạ áp',
        doctorInstructions: 'Hạn chế vận động mạnh, tái khám ngay nếu đau ngực tăng',
        conclusion: 'Theo dõi cơn đau thắt ngực ổn định',
        diagnoses: ['I20.9 - Cơn đau thắt ngực', 'I10 - Tăng huyết áp vô căn'],
      },
    },
    amendments: [],
  }

  const result = normalizeVersionHistoryData(rawData)

  assert.equal(result.originalOnly, true, 'originalOnly phải là true khi chưa có đính chính')
  assert.equal(result.hasAmendments, false, 'hasAmendments phải là false')
  assert.equal(result.totalVersions, 1, 'Tổng số phiên bản là 1')
  assert.equal(result.amendments.length, 0, 'Danh sách đính chính rỗng')

  assert.equal(result.originalVersion.versionNumber, 1)
  assert.equal(result.originalVersion.isOriginal, true)
  assert.equal(result.originalVersion.modifiedBy, 'BS. Lê Minh Hoàng')
  assert.equal(result.originalVersion.snapshot.conclusion, 'Theo dõi cơn đau thắt ngực ổn định')
  assert.equal(result.originalVersion.snapshot.diagnoses.length, 2)
  assert.equal(result.originalVersion.snapshot.diagnoses[0], 'I20.9 - Cơn đau thắt ngực')
})

test('4. KIỂM THỬ HIỂN THỊ HỒ SƠ ĐÃ CÓ BẢN ĐÍNH CHÍNH (Transparency & Auditability)', () => {
  const rawData = {
    originalOnly: false,
    originalVersion: {
      versionNumber: 1,
      modifiedBy: 'BS. Trần Văn Nam',
      modifiedAt: '2026-08-15T09:00:00Z',
      reason: null,
      content: null,
      snapshot: {
        chiefComplaint: 'Sốt cao, ho đờm',
        symptoms: 'Sốt 39 độ, ho có đờm vàng',
        medicalHistory: 'Không có tiền sử đặc biệt',
        physicalExamination: 'Phổi nghe rale ẩm rải rác đáy phổi phải',
        clinicalProgress: 'Đang đợi kết quả X-Quang ngực thẳng',
        treatmentPlan: 'Kháng sinh, hạ sốt, long đờm',
        doctorInstructions: 'Uống nhiều nước, uống thuốc đúng liều',
        conclusion: 'Viêm phế quản cấp',
        diagnoses: ['J20.9 - Viêm phế quản cấp tính'],
      },
    },
    amendments: [
      {
        versionNumber: 2,
        modifiedBy: 'BS. Trần Văn Nam',
        modifiedAt: '2026-08-15T15:30:00Z',
        reason: 'Bổ sung chẩn đoán sau khi có kết quả X-Quang phổi',
        content: 'Kết quả X-Quang có hình ảnh đám mờ thâm nhiễm thùy dưới phổi phải. Bổ sung chẩn đoán: Viêm phổi mắc phải cộng đồng. Điều chỉnh tăng liều kháng sinh.',
        snapshot: null,
      },
      {
        versionNumber: 3,
        modifiedBy: 'BS. Quản lý Nguyễn Thị Mai',
        modifiedAt: '2026-08-16T10:00:00Z',
        reason: 'Đính chính sai sót chính tả thông tin tiền sử dị ứng theo khiếu nại của bệnh nhân',
        content: 'Bệnh nhân có tiền sử dị ứng Penicillin mức độ nhẹ (nổi mề đay). Đã lưu ý trong hồ sơ cảnh báo dị ứng.',
        snapshot: null,
      },
    ],
  }

  const result = normalizeVersionHistoryData(rawData)

  // 4.1 Kiểm tra trạng thái phân loại
  assert.equal(result.originalOnly, false, 'originalOnly phải là false khi đã có đính chính')
  assert.equal(result.hasAmendments, true, 'hasAmendments phải là true')
  assert.equal(result.totalVersions, 3, 'Tổng số phiên bản là 3 (1 gốc + 2 đính chính)')
  assert.equal(result.amendments.length, 2, 'Có 2 bản đính chính')

  const amendment1 = result.amendments[0]
  assert.equal(amendment1.versionNumber, 2)
  assert.equal(amendment1.isOriginal, false)
  assert.equal(amendment1.modifiedBy, 'BS. Trần Văn Nam')
  assert.equal(amendment1.reason, 'Bổ sung chẩn đoán sau khi có kết quả X-Quang phổi')
  assert.match(amendment1.content, /Viêm phổi mắc phải cộng đồng/)

  const amendment2 = result.amendments[1]
  assert.equal(amendment2.versionNumber, 3)
  assert.equal(amendment2.isOriginal, false)
  assert.equal(amendment2.modifiedBy, 'BS. Quản lý Nguyễn Thị Mai')
  assert.equal(amendment2.reason, 'Đính chính sai sót chính tả thông tin tiền sử dị ứng theo khiếu nại của bệnh nhân')
  assert.match(amendment2.content, /dị ứng Penicillin/)

  assert.equal(result.allVersions.length, 3)
  assert.equal(result.allVersions[0].versionNumber, 1, 'Phiên bản đầu tiên trong danh sách phải là v1 (bản gốc)')
  assert.equal(result.allVersions[1].versionNumber, 2, 'Phiên bản thứ hai là v2 (đính chính 1)')
  assert.equal(result.allVersions[2].versionNumber, 3, 'Phiên bản thứ ba là v3 (đính chính 2)')
})
