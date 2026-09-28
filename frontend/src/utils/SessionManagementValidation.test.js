import test from 'node:test'
import assert from 'node:assert/strict'

import {
  validateIdleTimeout,
  formatRelativeTime,
  formatDateTimeVi,
  parseUserAgent,
  getRoleBadgeConfig,
  setSessionExpiredNotice,
  popSessionExpiredNotice,
  MIN_IDLE_TIMEOUT_MINUTES,
  MAX_IDLE_TIMEOUT_MINUTES,
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  COUNTDOWN_WARNING_SECONDS,
} from './sessionManagementHelpers.js'

import { getNavigationItems } from '../components/layout/navigationConfig.js'

test('NCL-01-CN-007 / QTN-45: Constants and idle timeout boundaries', () => {
  assert.strictEqual(MIN_IDLE_TIMEOUT_MINUTES, 5)
  assert.strictEqual(MAX_IDLE_TIMEOUT_MINUTES, 1440)
  assert.strictEqual(DEFAULT_IDLE_TIMEOUT_MINUTES, 30)
  assert.strictEqual(COUNTDOWN_WARNING_SECONDS, 60)
})

test('NCL-01-CN-007: validateIdleTimeout handles valid and invalid ranges', () => {
  // Valid timeouts
  assert.strictEqual(validateIdleTimeout(5).valid, true)
  assert.strictEqual(validateIdleTimeout(15).valid, true)
  assert.strictEqual(validateIdleTimeout(30).valid, true)
  assert.strictEqual(validateIdleTimeout(60).valid, true)
  assert.strictEqual(validateIdleTimeout(1440).valid, true)
  assert.strictEqual(validateIdleTimeout('30').valid, true)

  // Invalid: under 5 minutes
  const underMin = validateIdleTimeout(4)
  assert.strictEqual(underMin.valid, false)
  assert.match(underMin.error, /tối thiểu là 5 phút/i)

  const negative = validateIdleTimeout(-10)
  assert.strictEqual(negative.valid, false)

  // Invalid: over 1440 minutes (24h)
  const overMax = validateIdleTimeout(1441)
  assert.strictEqual(overMax.valid, false)
  assert.match(overMax.error, /tối đa là 1440 phút/i)

  // Invalid: non-integer / string
  const decimal = validateIdleTimeout(15.5)
  assert.strictEqual(decimal.valid, false)

  const nonNum = validateIdleTimeout('abc')
  assert.strictEqual(nonNum.valid, false)
})

test('NCL-01-CN-007: formatRelativeTime outputs human-friendly Vietnamese time', () => {
  const baseNow = new Date('2026-09-25T14:00:00Z')

  // Just now (< 30s)
  const t1 = new Date('2026-09-25T13:59:45Z')
  assert.strictEqual(formatRelativeTime(t1, baseNow), 'Vừa xong')

  // Seconds ago
  const t2 = new Date('2026-09-25T13:59:15Z')
  assert.strictEqual(formatRelativeTime(t2, baseNow), '45 giây trước')

  // Minutes ago
  const t3 = new Date('2026-09-25T13:45:00Z')
  assert.strictEqual(formatRelativeTime(t3, baseNow), '15 phút trước')

  // Hours ago
  const t4 = new Date('2026-09-25T11:00:00Z')
  assert.strictEqual(formatRelativeTime(t4, baseNow), '3 giờ trước')

  // Days ago
  const t5 = new Date('2026-09-22T14:00:00Z')
  assert.strictEqual(formatRelativeTime(t5, baseNow), '3 ngày trước')

  // Invalid or null
  assert.strictEqual(formatRelativeTime(null, baseNow), 'Chưa ghi nhận')
  assert.strictEqual(formatRelativeTime('invalid-date', baseNow), 'Không hợp lệ')
})

test('NCL-01-CN-007: formatDateTimeVi produces DD/MM/YYYY HH:mm:ss format', () => {
  const d = new Date(2026, 8, 25, 14, 30, 45) // 25/09/2026 14:30:45
  const formatted = formatDateTimeVi(d)
  assert.strictEqual(formatted, '25/09/2026 14:30:45')

  assert.strictEqual(formatDateTimeVi(null), '—')
  assert.strictEqual(formatDateTimeVi('invalid'), '—')
})

test('NCL-01-CN-007: parseUserAgent parses desktop and mobile browsers correctly', () => {
  // Chrome on Windows 10
  const winChrome =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  const parsed1 = parseUserAgent(winChrome)
  assert.strictEqual(parsed1.os, 'Windows 10/11')
  assert.strictEqual(parsed1.browser, 'Google Chrome')
  assert.strictEqual(parsed1.deviceType, 'desktop')
  assert.strictEqual(parsed1.label, 'Google Chrome • Windows 10/11')

  // Edge on Windows
  const winEdge =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'
  const parsed2 = parseUserAgent(winEdge)
  assert.strictEqual(parsed2.browser, 'Microsoft Edge')

  // Safari on macOS
  const macSafari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  const parsed3 = parseUserAgent(macSafari)
  assert.strictEqual(parsed3.os, 'macOS')
  assert.strictEqual(parsed3.browser, 'Apple Safari')
  assert.strictEqual(parsed3.deviceType, 'desktop')

  // Mobile Chrome on Android
  const androidMobile =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
  const parsed4 = parseUserAgent(androidMobile)
  assert.strictEqual(parsed4.os, 'Android')
  assert.strictEqual(parsed4.deviceType, 'mobile')

  // Fallback for null/empty
  const fallback = parseUserAgent(null)
  assert.strictEqual(fallback.deviceType, 'desktop')
})

test('NCL-01-CN-007: getRoleBadgeConfig maps roles to Vietnamese labels and theme colors', () => {
  const admin = getRoleBadgeConfig('ADMIN')
  assert.strictEqual(admin.label, 'Quản trị viên')
  assert.strictEqual(admin.color, '#DC2626')

  const doctor = getRoleBadgeConfig('ROLE_DOCTOR')
  assert.strictEqual(doctor.label, 'Bác sĩ')
  assert.strictEqual(doctor.color, '#2563EB')

  const receptionist = getRoleBadgeConfig('receptionist')
  assert.strictEqual(receptionist.label, 'Lễ tân')

  const pharmacist = getRoleBadgeConfig('pharmacist')
  assert.strictEqual(pharmacist.label, 'Dược sĩ')

  const manager = getRoleBadgeConfig('clinic_manager')
  assert.strictEqual(manager.label, 'Quản lý phòng khám')

  const patient = getRoleBadgeConfig('PATIENT')
  assert.strictEqual(patient.label, 'Bệnh nhân')
})

test('NCL-01-CN-007: Session storage notice pop and clear', () => {
  // Mock sessionStorage in node test environment
  const storage = new Map()
  global.sessionStorage = {
    setItem: (k, v) => storage.set(k, v),
    getItem: (k) => storage.get(k) || null,
    removeItem: (k) => storage.delete(k),
  }

  const testMsg = 'Phiên làm việc đã hết hạn do không có thao tác, vui lòng đăng nhập lại'
  setSessionExpiredNotice(testMsg)

  assert.strictEqual(sessionStorage.getItem('auth_session_expired_notice'), testMsg)

  const popped = popSessionExpiredNotice()
  assert.strictEqual(popped, testMsg)

  // After pop, it must be cleared
  assert.strictEqual(popSessionExpiredNotice(), null)
})

test('NCL-01-CN-007 / QTN-01: Navigation menu access control for /admin/sessions', () => {
  // 1. ADMIN sees /admin/sessions
  const adminItems = getNavigationItems(['admin'], [])
  const hasAdminSessionMenu = adminItems.some((item) => item.key === '/admin/sessions')
  assert.strictEqual(hasAdminSessionMenu, true)

  // 2. User with SESSION_READ permission sees /admin/sessions
  const customPermItems = getNavigationItems(['user'], ['SESSION_READ'])
  const hasPermSessionMenu = customPermItems.some((item) => item.key === '/admin/sessions')
  assert.strictEqual(hasPermSessionMenu, true)

  // 3. DOCTOR without permission does NOT see /admin/sessions
  const doctorItems = getNavigationItems(['doctor'], ['MEDICAL_RECORD_READ'])
  const hasDoctorSessionMenu = doctorItems.some((item) => item.key === '/admin/sessions')
  assert.strictEqual(hasDoctorSessionMenu, false)

  // 4. RECEPTIONIST does NOT see /admin/sessions
  const receptionistItems = getNavigationItems(['receptionist'], ['PATIENT_READ'])
  const hasReceptionistSessionMenu = receptionistItems.some((item) => item.key === '/admin/sessions')
  assert.strictEqual(hasReceptionistSessionMenu, false)

  // 5. PHARMACIST does NOT see /admin/sessions
  const pharmacistItems = getNavigationItems(['pharmacist'], ['PHARMACY_READ'])
  const hasPharmacistSessionMenu = pharmacistItems.some((item) => item.key === '/admin/sessions')
  assert.strictEqual(hasPharmacistSessionMenu, false)

  // 6. CLINIC MANAGER without permission does NOT see /admin/sessions
  const managerItems = getNavigationItems(['manager'], ['REPORT_VIEW'])
  const hasManagerSessionMenu = managerItems.some((item) => item.key === '/admin/sessions')
  assert.strictEqual(hasManagerSessionMenu, false)
})
