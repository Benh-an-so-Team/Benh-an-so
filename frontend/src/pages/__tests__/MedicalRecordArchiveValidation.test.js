import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import medicalRecordArchiveApi from '../../api/medicalRecordArchiveApi.js'
import { getNavigationItems, navigationSections } from '../../components/layout/navigationConfig.js'
import {
  calculateOverdueDuration,
  isArchivedRecord,
  canUserConfirmArchive,
  canUserViewEligibleTab,
  canUserSearchArchive,
  getArchivedBadgeConfig,
} from '../../utils/medicalRecordArchiveHelpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '../../..')

test('TC-MRA-01: medicalRecordArchiveApi cung cấp đầy đủ các phương thức nghiệp vụ', () => {
  assert.equal(typeof medicalRecordArchiveApi.getEligibleRecords, 'function')
  assert.equal(typeof medicalRecordArchiveApi.searchArchivedRecords, 'function')
  assert.equal(typeof medicalRecordArchiveApi.batchArchive, 'function')
  assert.equal(typeof medicalRecordArchiveApi.archiveSingle, 'function')
})

test('TC-MRA-02: calculateOverdueDuration tính chính xác số năm và tháng quá hạn', () => {
  const baseDate = new Date('2026-09-25T00:00:00')
  // Quá hạn 2 năm (730 ngày trước so với hạn 12 tháng)
  const date2YearsAgo = new Date(baseDate.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString()
  const result2Years = calculateOverdueDuration(date2YearsAgo, 12, baseDate)
  assert.ok(result2Years.isOverdue, 'Hồ sơ phải được xác định là quá hạn')
  assert.ok(result2Years.overdueMonths >= 11, 'Số tháng quá hạn phải xấp xỉ 12 tháng so với hạn 1 năm')
  assert.ok(result2Years.durationText.length > 0, 'Phải có chuỗi mô tả thời gian quá hạn')

  // Chưa quá hạn (khám 6 tháng trước, thời hạn hoạt động là 12 tháng)
  const date6MonthsAgo = new Date(baseDate.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const resultNotOverdue = calculateOverdueDuration(date6MonthsAgo, 12, baseDate)
  assert.equal(resultNotOverdue.isOverdue, false, 'Hồ sơ chưa quá 12 tháng không được báo quá hạn')
})

test('TC-MRA-03: Phân quyền thao tác kho lưu trữ - Chỉ Quản trị viên mới được xác nhận chuyển lưu trữ', () => {
  // Quản trị viên (admin): Được xác nhận chuyển
  const adminUser = { role: 'admin', permissions: ['MEDICAL_RECORD_ARCHIVE_MANAGE'] }
  assert.equal(canUserConfirmArchive(adminUser), true, 'Admin phải có quyền xác nhận chuyển lưu trữ')

  // Quản lý phòng khám (manager/clinic_manager): Xem được danh sách nhưng KHÔNG được bấm xác nhận chuyển
  const managerUser = { role: 'clinic_manager', permissions: ['MEDICAL_RECORD_ARCHIVE_MANAGE'] }
  assert.equal(canUserConfirmArchive(managerUser), false, 'Quản lý phòng khám KHÔNG có quyền xác nhận chuyển lưu trữ')

  const managerUser2 = { role: 'manager', permissions: ['MEDICAL_RECORD_ARCHIVE_MANAGE'] }
  assert.equal(canUserConfirmArchive(managerUser2), false, 'Manager KHÔNG có quyền xác nhận chuyển lưu trữ')

  // Bác sĩ (doctor): Không có quyền quản lý kho chuyển
  const doctorUser = { role: 'doctor', permissions: ['MEDICAL_RECORD_ARCHIVE_READ'] }
  assert.equal(canUserConfirmArchive(doctorUser), false, 'Doctor không có quyền xác nhận chuyển lưu trữ')
  assert.equal(canUserViewEligibleTab(doctorUser), false, 'Doctor không được xem tab Đủ điều kiện')
  assert.equal(canUserSearchArchive(doctorUser), true, 'Doctor được tra cứu kho lưu trữ')
})

test('TC-MRA-04: navigationConfig.js tích hợp menu Kho lưu trữ bệnh án cho đúng vai trò', () => {
  // Admin thấy menu
  const adminNav = getNavigationItems(['admin'], [])
  const archiveItemAdmin = adminNav.find((item) => item.key === '/medical-records/archive')
  assert.ok(archiveItemAdmin, 'Admin phải thấy menu Kho lưu trữ bệnh án')
  assert.equal(archiveItemAdmin.label, 'Kho lưu trữ bệnh án')

  // Doctor thấy menu
  const doctorNav = getNavigationItems(['doctor'], ['MEDICAL_RECORD_ARCHIVE_READ'])
  const archiveItemDoc = doctorNav.find((item) => item.key === '/medical-records/archive')
  assert.ok(archiveItemDoc, 'Bác sĩ có quyền tra cứu phải thấy menu Kho lưu trữ bệnh án')

  // Lễ tân không thấy menu
  const recepNav = getNavigationItems(['receptionist'], [])
  const archiveItemRecep = recepNav.find((item) => item.key === '/medical-records/archive')
  assert.equal(archiveItemRecep, undefined, 'Lễ tân không được thấy menu Kho lưu trữ bệnh án')

  // Thuộc section 'examination'
  const examSection = navigationSections.find((s) => s.key === 'examination')
  assert.ok(examSection.paths.includes('/medical-records/archive'), 'Đường dẫn phải nằm trong section examination')
})

test('TC-MRA-05: AppRoutes.jsx đăng ký đầy đủ route và phân quyền cho Kho lưu trữ bệnh án', () => {
  const appRoutesContent = fs.readFileSync(path.join(frontendDir, 'src/routes/AppRoutes.jsx'), 'utf-8')
  assert.ok(appRoutesContent.includes('MedicalRecordArchivePage'), 'AppRoutes phải import MedicalRecordArchivePage')
  assert.ok(appRoutesContent.includes('path="medical-records/archive"'), 'AppRoutes phải có path medical-records/archive')
  assert.ok(appRoutesContent.includes('MEDICAL_RECORD_ARCHIVE_READ'), 'Phải yêu cầu quyền MEDICAL_RECORD_ARCHIVE_READ')
  assert.ok(appRoutesContent.includes('MEDICAL_RECORD_ARCHIVE_MANAGE'), 'Phải yêu cầu quyền MEDICAL_RECORD_ARCHIVE_MANAGE')
  assert.ok(appRoutesContent.includes('path="archive"'), 'Phải có redirect route /archive')
})

test('TC-MRA-06: MedicalRecordList.jsx tích hợp nhãn Hồ sơ lưu trữ và ẩn hoàn toàn nút Sửa/Xóa', () => {
  const listContent = fs.readFileSync(path.join(frontendDir, 'src/pages/MedicalRecordList.jsx'), 'utf-8')
  // Phải có nhãn "Hồ sơ lưu trữ"
  assert.ok(listContent.includes('Hồ sơ lưu trữ'), 'MedicalRecordList phải có nhãn Hồ sơ lưu trữ')
  // Không hiển thị nút Sửa/Xóa/Archive khi hồ sơ đã lưu trữ
  assert.ok(
    listContent.includes("record.status === 'ARCHIVED'") && listContent.includes('!isArchived'),
    'MedicalRecordList phải kiểm tra status ARCHIVED và ẩn nút thao tác khi đã lưu trữ',
  )
})

test('TC-MRA-07: MedicalEncounter.jsx hiển thị banner cảnh báo chỉ đọc cho hồ sơ đã lưu trữ và ẩn thao tác chỉnh sửa', () => {
  const encounterContent = fs.readFileSync(path.join(frontendDir, 'src/pages/MedicalEncounter.jsx'), 'utf-8')
  assert.ok(
    encounterContent.includes('Hồ sơ bệnh án đã lưu trữ — Chế độ chỉ đọc'),
    'MedicalEncounter phải có thông báo hồ sơ đã lưu trữ chỉ đọc',
  )
  assert.ok(
    encounterContent.includes('isRecordArchived'),
    'MedicalEncounter phải có biến trạng thái kiểm tra hồ sơ lưu trữ',
  )
})

test('TC-MRA-08: getArchivedBadgeConfig cung cấp đúng text nhãn và cấu hình màu sắc', () => {
  const badge = getArchivedBadgeConfig()
  assert.equal(badge.text, 'Hồ sơ lưu trữ')
  assert.equal(badge.color, 'purple')
  assert.equal(badge.isArchived, true)

  const activeBadge = getArchivedBadgeConfig('COMPLETED')
  assert.equal(activeBadge.text, 'Hồ sơ hoạt động')
  assert.equal(activeBadge.isArchived, false)
})

test('TC-MRA-09: Tuân thủ quy định - TUYỆT ĐỐI KHÔNG chứa mã kỹ thuật nội bộ (QTN, NCL, TC) trên UI', () => {
  const filesToCheck = [
    'src/pages/MedicalRecordArchivePage.jsx',
    'src/components/archive/ConfirmBatchArchiveModal.jsx',
    'src/components/archive/ArchivedMedicalRecordDetailModal.jsx',
    'src/utils/medicalRecordArchiveHelpers.js',
  ]

  const forbiddenPattern = /\b(QTN-\d+|NCL-\d+-[A-Z]+-\d+)\b/g

  for (const relPath of filesToCheck) {
    const fullPath = path.join(frontendDir, relPath)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8')
      const matches = content.match(forbiddenPattern)
      assert.equal(
        matches,
        null,
        `Tập tin ${relPath} không được chứa mã quy tắc nội bộ (${matches?.join(', ')})`,
      )
    }
  }
})
