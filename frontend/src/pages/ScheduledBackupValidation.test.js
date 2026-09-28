import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import backupScheduleApi from '../api/backupScheduleApi.js'
import { getNavigationItems } from '../components/layout/navigationConfig.js'
import {
  calculateNextRunTime,
  formatFileSize,
  getBackupStatusInfo,
  getVerificationStatusInfo,
} from '../utils/backupScheduleHelpers.js'
import {
  SAMPLE_BACKUP_SCHEDULE,
  SAMPLE_BACKUP_HISTORY,
  SAMPLE_VERIFICATION_SUCCESS,
  SAMPLE_VERIFICATION_FAILED,
} from '../utils/backupScheduleMockData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '../..')

test('TC-SB-01: backupScheduleApi cung cấp đầy đủ các phương thức kết nối backend', () => {
  assert.equal(typeof backupScheduleApi.getSchedule, 'function', 'getSchedule phải là function')
  assert.equal(typeof backupScheduleApi.updateSchedule, 'function', 'updateSchedule phải là function')
  assert.equal(typeof backupScheduleApi.dismissAlert, 'function', 'dismissAlert phải là function')
  assert.equal(typeof backupScheduleApi.verifyLatest, 'function', 'verifyLatest phải là function')
  assert.equal(typeof backupScheduleApi.verifyById, 'function', 'verifyById phải là function')
  assert.equal(typeof backupScheduleApi.getHistory, 'function', 'getHistory phải là function')
})

test('TC-SB-02: calculateNextRunTime tính toán chính xác mốc chạy kế tiếp', () => {
  // Khi tắt tính năng
  const disabledRes = calculateNextRunTime('23:00', false)
  assert.equal(disabledRes.isScheduled, false)
  assert.equal(disabledRes.nextRunDate, null)
  assert.ok(disabledRes.text.includes('đang tắt'))

  // Khi định dạng giờ sai
  const invalidTimeRes = calculateNextRunTime('25:99', true)
  assert.equal(invalidTimeRes.isScheduled, false)
  assert.ok(invalidTimeRes.text.includes('không hợp lệ'))

  // Mốc giả định 10:00 ngày 27/09/2026
  const refDate = new Date('2026-09-27T10:00:00Z')

  // Giờ chạy 23:00 (chưa đến trong ngày hôm nay)
  const todayRunRes = calculateNextRunTime('23:00', true, refDate)
  assert.equal(todayRunRes.isScheduled, true)
  assert.ok(todayRunRes.text.includes('hôm nay'))
  assert.ok(todayRunRes.text.includes('23:00'))

  // Giờ chạy 02:00 (đã qua trong ngày hôm nay -> chuyển sang ngày mai)
  const tomorrowRunRes = calculateNextRunTime('02:00', true, refDate)
  assert.equal(tomorrowRunRes.isScheduled, true)
  assert.ok(tomorrowRunRes.text.includes('ngày mai'))
  assert.ok(tomorrowRunRes.text.includes('02:00'))
})

test('TC-SB-03: formatFileSize định dạng dung lượng byte chuẩn xác', () => {
  assert.equal(formatFileSize(null), '—')
  assert.equal(formatFileSize(-10), '—')
  assert.equal(formatFileSize(0), '0 B')
  assert.equal(formatFileSize(512), '512 B')
  assert.equal(formatFileSize(1024), '1.00 KB')
  assert.equal(formatFileSize(1024 * 1024 * 15.5), '15.50 MB')
  assert.equal(formatFileSize(1024 * 1024 * 1024 * 2), '2.00 GB')
})

test('TC-SB-04: getBackupStatusInfo phân loại badge và màu sắc trạng thái', () => {
  const success = getBackupStatusInfo('SUCCESS')
  assert.equal(success.label, 'Thành công')
  assert.equal(success.color, 'success')

  const failed = getBackupStatusInfo('FAILED')
  assert.equal(failed.label, 'Thất bại')
  assert.equal(failed.color, 'error')

  const inProgress = getBackupStatusInfo('IN_PROGRESS')
  assert.equal(inProgress.label, 'Đang chạy')
  assert.equal(inProgress.color, 'processing')
})

test('TC-SB-05: getVerificationStatusInfo trả về thông tin kết quả kiểm tra toàn vẹn', () => {
  const validRes = getVerificationStatusInfo(true, true, true)
  assert.equal(validRes.isSuccess, true)
  assert.ok(validRes.label.includes('đọc được và đầy đủ dữ liệu'))

  const brokenRes = getVerificationStatusInfo(false, true, false)
  assert.equal(brokenRes.isSuccess, false)
  assert.ok(brokenRes.label.includes('Cảnh báo'))
})

test('TC-SB-06: SystemManagementPage tích hợp module Lịch sao lưu tự động và navigationConfig không bị lặp menu', () => {
  const adminItems = getNavigationItems(['admin'], [])
  const hasSystemManagement = adminItems.some((item) => item.key === '/system-management')
  assert.ok(hasSystemManagement, 'Admin phải thấy menu Quản trị hệ thống')

  const hasDuplicateScheduledBackup = adminItems.some((item) => item.key === '/system/scheduled-backup')
  assert.equal(hasDuplicateScheduledBackup, false, 'Menu Lịch sao lưu tự động không bị trùng lặp ở sidebar vì đã có trong Quản trị hệ thống')

  const systemPageContent = fs.readFileSync(
    path.join(frontendDir, 'src/pages/SystemManagementPage.jsx'),
    'utf-8',
  )
  assert.ok(
    systemPageContent.includes('ScheduledBackupPage') && systemPageContent.includes('scheduled-backup'),
    'SystemManagementPage phải tích hợp tab Lịch sao lưu tự động',
  )
})

test('TC-SB-07: AppRoutes.jsx đăng ký route /system/scheduled-backup và ScheduledBackupPage', () => {
  const appRoutesContent = fs.readFileSync(
    path.join(frontendDir, 'src/routes/AppRoutes.jsx'),
    'utf-8',
  )
  assert.ok(
    appRoutesContent.includes('ScheduledBackupPage'),
    'AppRoutes phải import ScheduledBackupPage',
  )
  assert.ok(
    appRoutesContent.includes('system/scheduled-backup'),
    'AppRoutes phải khai báo route system/scheduled-backup',
  )
  assert.ok(
    appRoutesContent.includes('BACKUP_READ'),
    'Route phải yêu cầu quyền BACKUP_READ',
  )
})

test('TC-SB-08: Giao diện và thông báo không được chứa các mã quy tắc nội bộ', () => {
  const filesToCheck = [
    'src/pages/ScheduledBackupPage.jsx',
    'src/components/backup/BackupVerificationModal.jsx',
    'src/pages/scheduledBackup.css',
    'src/utils/backupScheduleHelpers.js',
  ]

  const forbiddenPatterns = [/\bQTN-\d+/i, /\bNCL-\d+/i, /\bTC-\d+/i]

  for (const relativePath of filesToCheck) {
    const fullPath = path.join(frontendDir, relativePath)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, 'utf-8')
    for (const pattern of forbiddenPatterns) {
      const match = content.match(pattern)
      assert.equal(
        match,
        null,
        `Tệp ${relativePath} không được chứa mã quy tắc nội bộ: ${match?.[0]}`,
      )
    }
  }
})

test('TC-SB-09: Mock data đáp ứng đầy đủ cấu trúc nghiệp vụ bản sao lưu và kiểm tra toàn vẹn', () => {
  assert.equal(SAMPLE_BACKUP_SCHEDULE.enabled, true)
  assert.equal(SAMPLE_BACKUP_SCHEDULE.dailyTime, '23:00')
  assert.ok(Array.isArray(SAMPLE_BACKUP_HISTORY))
  assert.ok(SAMPLE_BACKUP_HISTORY.length >= 3)

  // Phải có cả bản ghi thành công và thất bại kèm failureReason
  const failedRecord = SAMPLE_BACKUP_HISTORY.find((item) => item.status === 'FAILED')
  assert.ok(failedRecord, 'Phải có bản ghi FAILED trong mock data')
  assert.ok(Boolean(failedRecord.failureReason), 'Bản ghi FAILED phải có failureReason trực tiếp')

  assert.equal(SAMPLE_VERIFICATION_SUCCESS.valid, true)
  assert.equal(SAMPLE_VERIFICATION_SUCCESS.tableCount, 28)
  assert.equal(SAMPLE_VERIFICATION_FAILED.valid, false)
  assert.ok(SAMPLE_VERIFICATION_FAILED.issues.length > 0)
})
