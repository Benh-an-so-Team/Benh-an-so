import dayjs from 'dayjs'

/**
 * Tiện ích hỗ trợ quản lý kho lưu trữ hồ sơ bệnh án hết thời hạn
 */

/**
 * Tính toán thời gian quá hạn lưu trữ dựa trên ngày kết thúc lượt khám và số tháng thời hạn hoạt động
 * @param {string|Date} completedAt - Thời điểm kết thúc lượt khám
 * @param {number} activeDurationMonths - Số tháng hoạt động cấu hình (mặc định 12)
 * @param {Date|string} referenceDate - Ngày mốc so sánh (mặc định hiện tại)
 * @returns {Object} { isOverdue: boolean, totalMonthsOverdue: number, overdueMonths: number, formatted: string, durationText: string, severity: 'warning'|'danger' }
 */
export const calculateOverdueDuration = (completedAt, activeDurationMonths = 12, referenceDate = new Date()) => {
  if (!completedAt) {
    return {
      isOverdue: false,
      totalMonthsOverdue: 0,
      overdueMonths: 0,
      formatted: 'Chưa xác định',
      durationText: 'Chưa xác định',
      severity: 'warning',
    }
  }

  const completed = dayjs(completedAt)
  const now = dayjs(referenceDate)
  const expirationDate = completed.add(Number(activeDurationMonths || 12), 'month')

  if (now.isBefore(expirationDate)) {
    return {
      isOverdue: false,
      totalMonthsOverdue: 0,
      overdueMonths: 0,
      formatted: 'Còn trong thời hạn',
      durationText: 'Còn trong thời hạn',
      severity: 'success',
    }
  }

  // Số tháng đã quá hạn
  const diffMonths = now.diff(expirationDate, 'month')
  const diffDays = now.diff(expirationDate.add(diffMonths, 'month'), 'day')

  const years = Math.floor(diffMonths / 12)
  const remainingMonths = diffMonths % 12

  let formatted = ''
  if (years > 0) {
    formatted = remainingMonths > 0
      ? `Quá hạn ${years} năm ${remainingMonths} tháng`
      : `Quá hạn ${years} năm`
  } else if (diffMonths > 0) {
    formatted = `Quá hạn ${diffMonths} tháng`
  } else {
    formatted = `Quá hạn ${diffDays > 0 ? diffDays : 1} ngày`
  }

  return {
    isOverdue: true,
    totalMonthsOverdue: diffMonths,
    overdueMonths: diffMonths,
    formatted,
    durationText: formatted,
    severity: diffMonths >= 12 ? 'danger' : 'warning',
  }
}

/**
 * Kiểm tra xem hồ sơ bệnh án có phải ở trạng thái lưu trữ hay không
 * @param {Object|string} recordOrStatus
 * @returns {boolean}
 */
export const isArchivedRecord = (recordOrStatus) => {
  const status = typeof recordOrStatus === 'string'
    ? recordOrStatus
    : recordOrStatus?.status
  return String(status || '').toUpperCase() === 'ARCHIVED'
}

const extractRoles = (user) => {
  if (!user) return []
  const rawRoles = Array.isArray(user.roles)
    ? user.roles
    : (user.role ? [user.role] : [])
  return rawRoles.map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
}

const extractPermissions = (user) => {
  if (!user) return []
  const rawPermissions = Array.isArray(user.permissions)
    ? user.permissions
    : (user.permission ? [user.permission] : [])
  return rawPermissions.map((p) => String(p || '').toUpperCase().replace(/^permission_/, ''))
}

/**
 * Kiểm tra người dùng có quyền xác nhận chuyển hồ sơ vào kho lưu trữ hay không
 * Nghiệp vụ: Chỉ Quản trị viên (ADMIN) mới có quyền xác nhận chuyển;
 * Quản lý phòng khám (MANAGER) chỉ xem danh sách đủ điều kiện nhưng không có quyền bấm chuyển.
 * @param {Object} user
 * @returns {boolean}
 */
export const canUserConfirmArchive = (user) => {
  if (!user) return false
  const roles = extractRoles(user)
  return roles.includes('admin')
}

/**
 * Kiểm tra người dùng có quyền xem danh sách hồ sơ đủ điều kiện lưu trữ hay không
 * Nghiệp vụ: Quản trị viên (ADMIN) và Quản lý phòng khám (MANAGER)
 * @param {Object} user
 * @returns {boolean}
 */
export const canUserViewEligibleTab = (user) => {
  if (!user) return false
  const roles = extractRoles(user)
  const permissions = extractPermissions(user)
  return roles.includes('admin') || roles.includes('manager') || roles.includes('clinic_manager') || permissions.includes('MEDICAL_RECORD_ARCHIVE_MANAGE')
}

/**
 * Kiểm tra người dùng có quyền tra cứu kho lưu trữ hay không
 * Nghiệp vụ: Quản trị viên, Quản lý phòng khám, Bác sĩ
 * @param {Object} user
 * @returns {boolean}
 */
export const canUserSearchArchive = (user) => {
  if (!user) return false
  const roles = extractRoles(user)
  const permissions = extractPermissions(user)
  return roles.includes('admin') || roles.includes('manager') || roles.includes('clinic_manager') || roles.includes('doctor') || permissions.includes('MEDICAL_RECORD_ARCHIVE_READ')
}

/**
 * Cung cấp cấu hình nhãn trạng thái và badge cho Hồ sơ lưu trữ
 * @param {string} [status='ARCHIVED']
 * @returns {Object} { label, text, badgeText, color, bgColor, borderColor, textColor, isArchived }
 */
export const getArchivedBadgeConfig = (status = 'ARCHIVED') => {
  const isArchived = String(status || '').toUpperCase() === 'ARCHIVED'
  if (isArchived) {
    return {
      label: 'Hồ sơ lưu trữ',
      text: 'Hồ sơ lưu trữ',
      badgeText: 'Lưu trữ (Chỉ đọc)',
      color: 'purple',
      bgColor: '#faf5ff',
      borderColor: '#d8b4fe',
      textColor: '#6b21a8',
      isArchived: true,
    }
  }
  return {
    label: 'Hồ sơ hoạt động',
    text: 'Hồ sơ hoạt động',
    badgeText: 'Đang hoạt động',
    color: 'blue',
    bgColor: '#eff6ff',
    borderColor: '#93c5fd',
    textColor: '#1e40af',
    isArchived: false,
  }
}
