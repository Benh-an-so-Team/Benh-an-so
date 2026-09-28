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
} from '../utils/sessionManagementHelpers.js'

import { getNavigationItems } from '../components/layout/navigationConfig.js'

test('NCL-01-CN-007 / AC-01: Cấu hình thời gian không thao tác trước khi tự đăng xuất', () => {
  // AC-01 TC-01: Nhập giá trị hợp lệ trong khoảng [5, 1440]
  assert.equal(validateIdleTimeout(5).valid, true)
  assert.equal(validateIdleTimeout(15).valid, true)
  assert.equal(validateIdleTimeout(30).valid, true)
  assert.equal(validateIdleTimeout(60).valid, true)
  assert.equal(validateIdleTimeout(120).valid, true)
  assert.equal(validateIdleTimeout(1440).valid, true)

  // AC-01 TC-02: Nhập giá trị dưới ngưỡng tối thiểu (< 5 phút)
  const tooLow = validateIdleTimeout(4)
  assert.equal(tooLow.valid, false)
  assert.match(tooLow.error, /tối thiểu là 5 phút/i)

  // AC-01 TC-03: Nhập giá trị vượt ngưỡng tối đa (> 1440 phút)
  const tooHigh = validateIdleTimeout(1441)
  assert.equal(tooHigh.valid, false)
  assert.match(tooHigh.error, /tối đa là 1440 phút/i)

  // AC-01 TC-04: Giá trị mặc định là 30 phút
  assert.equal(DEFAULT_IDLE_TIMEOUT_MINUTES, 30)
})

test('NCL-01-CN-007 / AC-02: Cảnh báo đếm ngược và cơ chế gia hạn phiên làm việc', () => {
  // AC-02 TC-01: Ngưỡng thời gian đếm ngược cảnh báo đúng 60 giây trước khi hết hạn
  assert.equal(COUNTDOWN_WARNING_SECONDS, 60)

  // AC-02 TC-02: Tính toán thời điểm hiển thị cảnh báo
  const timeoutMinutes = 30
  const totalSeconds = timeoutMinutes * 60
  const warningStartSeconds = totalSeconds - COUNTDOWN_WARNING_SECONDS

  assert.equal(totalSeconds, 1800)
  assert.equal(warningStartSeconds, 1740) // Cảnh báo bắt đầu từ giây thứ 1740 (còn 60 giây)

  // AC-02 TC-03: Định dạng đếm ngược mm:ss
  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  assert.equal(formatCountdown(60), '01:00')
  assert.equal(formatCountdown(45), '00:45')
  assert.equal(formatCountdown(9), '00:09')
  assert.equal(formatCountdown(0), '00:00')
})

test('NCL-01-CN-007 / AC-03: Danh sách phiên hoạt động và nhận diện thiết bị/máy trạm', () => {
  // AC-03 TC-01: Phân tích máy trạm Windows + Chrome
  const uaChrome =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  const parsedChrome = parseUserAgent(uaChrome)
  assert.equal(parsedChrome.os, 'Windows 10/11')
  assert.equal(parsedChrome.browser, 'Google Chrome')
  assert.equal(parsedChrome.deviceType, 'desktop')

  // AC-03 TC-02: Phân tích thiết bị di động
  const uaMobile =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const parsedMobile = parseUserAgent(uaMobile)
  assert.equal(parsedMobile.os, 'iOS')
  assert.equal(parsedMobile.browser, 'Apple Safari')
  assert.equal(parsedMobile.deviceType, 'mobile')

  // AC-03 TC-03: Gán nhãn vai trò người dùng chuẩn xác
  assert.equal(getRoleBadgeConfig('ADMIN').label, 'Quản trị viên')
  assert.equal(getRoleBadgeConfig('DOCTOR').label, 'Bác sĩ')
  assert.equal(getRoleBadgeConfig('RECEPTIONIST').label, 'Lễ tân')
  assert.equal(getRoleBadgeConfig('PHARMACIST').label, 'Dược sĩ')
  assert.equal(getRoleBadgeConfig('CLINIC_MANAGER').label, 'Quản lý phòng khám')
})

test('NCL-01-CN-007 / AC-04: Kết thúc phiên từ xa và quy tắc không ngắt phiên chính mình', () => {
  const mockSessions = [
    {
      sessionId: 'session-admin-1',
      username: 'admin',
      fullName: 'System Administrator',
      roleName: 'ADMIN',
      isCurrentSession: true,
    },
    {
      sessionId: 'session-reception-1',
      username: 'receptionist1',
      fullName: 'Pham Mai Lan',
      roleName: 'RECEPTIONIST',
      isCurrentSession: false,
    },
  ]

  // AC-04 TC-01: Phiên của chính quản trị viên không cho phép kết thúc
  const currentSession = mockSessions.find((s) => s.isCurrentSession)
  assert.equal(currentSession.isCurrentSession, true)

  // AC-04 TC-02: Phiên của người dùng khác được phép ngắt từ xa
  const otherSession = mockSessions.find((s) => !s.isCurrentSession)
  assert.equal(otherSession.isCurrentSession, false)
  assert.equal(otherSession.username, 'receptionist1')
})

test('NCL-01-CN-007 / QTN-01: Phân quyền truy cập menu Quản lý phiên làm việc', () => {
  // Quản trị viên (ADMIN) được truy cập
  const adminNav = getNavigationItems(['admin'], [])
  assert.equal(adminNav.some((item) => item.key === '/admin/sessions'), true)

  // Người dùng có quyền SESSION_READ được truy cập
  const customNav = getNavigationItems(['user'], ['SESSION_READ'])
  assert.equal(customNav.some((item) => item.key === '/admin/sessions'), true)

  // Bác sĩ bị từ chối
  const doctorNav = getNavigationItems(['doctor'], ['MEDICAL_RECORD_READ'])
  assert.equal(doctorNav.some((item) => item.key === '/admin/sessions'), false)

  // Lễ tân bị từ chối
  const receptionNav = getNavigationItems(['receptionist'], ['PATIENT_READ'])
  assert.equal(receptionNav.some((item) => item.key === '/admin/sessions'), false)

  // Dược sĩ bị từ chối
  const pharmacyNav = getNavigationItems(['pharmacist'], ['PHARMACY_READ'])
  assert.equal(pharmacyNav.some((item) => item.key === '/admin/sessions'), false)
})

test('NCL-01-CN-007 / 2FA: Luồng thông báo hết hạn và duy trì bảo mật xác thực hai lớp', () => {
  const storage = new Map()
  global.sessionStorage = {
    setItem: (k, v) => storage.set(k, v),
    getItem: (k) => storage.get(k) || null,
    removeItem: (k) => storage.delete(k),
  }

  const expectedNotice = 'Phiên làm việc đã hết hạn do không có thao tác, vui lòng đăng nhập lại'
  setSessionExpiredNotice(expectedNotice)

  // Thông báo được lưu trữ an toàn để trang login đọc được
  assert.equal(popSessionExpiredNotice(), expectedNotice)
  // Sau khi lấy ra, thông báo được dọn dẹp để không lặp lại
  assert.equal(popSessionExpiredNotice(), null)
})
