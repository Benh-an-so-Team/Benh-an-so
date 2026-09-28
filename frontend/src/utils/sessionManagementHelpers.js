/**
 * NCL-01-CN-007: Helper utilities for Session Management and Auto-Logout
 * (QTN-45, QTN-01)
 */

export const MIN_IDLE_TIMEOUT_MINUTES = 5
export const MAX_IDLE_TIMEOUT_MINUTES = 1440
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30
export const COUNTDOWN_WARNING_SECONDS = 60

/**
 * Format relative time in Vietnamese (e.g. "Vừa xong", "2 phút trước", "1 giờ trước")
 */
export const formatRelativeTime = (timestamp, now = new Date()) => {
  if (!timestamp) return 'Chưa ghi nhận'
  const time = new Date(timestamp).getTime()
  if (isNaN(time)) return 'Không hợp lệ'

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - time) / 1000))

  if (diffSeconds < 30) return 'Vừa xong'
  if (diffSeconds < 60) return `${diffSeconds} giây trước`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} ngày trước`
}

/**
 * Format timestamp into standard Vietnamese datetime string: DD/MM/YYYY HH:mm:ss
 */
export const formatDateTimeVi = (timestamp) => {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return '—'

  const pad = (n) => String(n).padStart(2, '0')
  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Parse human-readable OS and Browser information from User-Agent string
 */
export const parseUserAgent = (userAgent) => {
  if (!userAgent || typeof userAgent !== 'string') {
    return {
      os: 'Không rõ hệ điều hành',
      browser: 'Không rõ trình duyệt',
      deviceType: 'desktop',
      label: 'Máy trạm nội bộ',
    }
  }

  const ua = userAgent.toLowerCase()

  let os = 'Không rõ HĐH'
  if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('windows nt 10.0') || ua.includes('windows nt 11.0')) os = 'Windows 10/11'
  else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1'
  else if (ua.includes('windows nt 6.1')) os = 'Windows 7'
  else if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS'
  else if (ua.includes('linux')) os = 'Linux'

  // Detect Browser
  let browser = 'Trình duyệt khác'
  if (ua.includes('edg/')) browser = 'Microsoft Edge'
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Google Chrome'
  else if (ua.includes('firefox/')) browser = 'Mozilla Firefox'
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Apple Safari'
  else if (ua.includes('coccoc/')) browser = 'Cốc Cốc'

  const isMobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')

  return {
    os,
    browser,
    deviceType: isMobile ? 'mobile' : 'desktop',
    label: `${browser} • ${os}`,
  }
}

/**
 * Map user role to Vietnamese badge color and title
 */
export const getRoleBadgeConfig = (rawRole) => {
  const role = String(rawRole || '').toUpperCase().replace(/^ROLE_/, '')
  switch (role) {
    case 'ADMIN':
      return { label: 'Quản trị viên', color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' }
    case 'DOCTOR':
      return { label: 'Bác sĩ', color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' }
    case 'RECEPTIONIST':
      return { label: 'Lễ tân', color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' }
    case 'PHARMACIST':
      return { label: 'Dược sĩ', color: '#9333EA', bg: '#F3E8FF', border: '#D8B4FE' }
    case 'MANAGER':
    case 'CLINIC_MANAGER':
      return { label: 'Quản lý phòng khám', color: '#EA580C', bg: '#FFEDD5', border: '#FDBA74' }
    case 'PATIENT':
      return { label: 'Bệnh nhân', color: '#0891B2', bg: '#CFFAFE', border: '#67E8F9' }
    default:
      return { label: role || 'Nhân viên', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' }
  }
}

/**
 * Validate session idle timeout value (in minutes)
 */
export const validateIdleTimeout = (minutes) => {
  const num = Number(minutes)
  if (isNaN(num) || !Number.isInteger(num)) {
    return { valid: false, error: 'Thời gian không thao tác phải là một số nguyên dương.' }
  }
  if (num < MIN_IDLE_TIMEOUT_MINUTES) {
    return {
      valid: false,
      error: `Thời gian không thao tác tối thiểu là ${MIN_IDLE_TIMEOUT_MINUTES} phút.`,
    }
  }
  if (num > MAX_IDLE_TIMEOUT_MINUTES) {
    return {
      valid: false,
      error: `Thời gian không thao tác tối đa là ${MAX_IDLE_TIMEOUT_MINUTES} phút (24 giờ).`,
    }
  }
  return { valid: true, error: null }
}

/**
 * Session storage keys for persistent alerts
 */
export const SESSION_EXPIRED_NOTICE_KEY = 'auth_session_expired_notice'
export const SESSION_IDLE_CONFIG_KEY = 'clinic_session_idle_minutes'

export const setSessionExpiredNotice = (msg) => {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, msg)
  } catch {
    // Ignore storage errors
  }
}

export const popSessionExpiredNotice = () => {
  try {
    const msg = sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY)
    if (msg) {
      sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY)
      return msg
    }
  } catch {
    // Ignore storage errors
  }
  return null
}
