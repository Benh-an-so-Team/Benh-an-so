/**
 * Utility helpers for Scheduled Backup and Integrity Verification
 */

/**
 * Định dạng ngày theo chuẩn DD/MM/YYYY
 * @param {Date} date
 * @returns {string}
 */
export const formatDayMonthYear = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Định dạng chỉ giờ và phút theo chuẩn HH:mm
 * @param {string|Date|number} val
 * @returns {string}
 */
export const formatTimeOnly = (val) => {
  if (!val) return '—'
  const date = new Date(val)
  if (isNaN(date.getTime())) {
    if (typeof val === 'string' && /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val.trim())) {
      return val.trim()
    }
    return '—'
  }
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Định dạng thời gian và ngày theo chuẩn HH:mm:ss DD/MM/YYYY
 * @param {string|Date|number} val
 * @returns {string}
 */
export const formatDateTime = (val) => {
  if (!val) return '—'
  const date = new Date(val)
  if (isNaN(date.getTime())) return '—'
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`
}

/**
 * Định dạng dung lượng tệp từ byte sang B, KB, MB, GB trực quan
 * @param {number} bytes
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Tính toán mốc thời gian sao lưu kế tiếp dựa trên giờ chạy và trạng thái kích hoạt
 * @param {string} dailyTime Giờ chạy định dạng HH:mm (ví dụ "23:00")
 * @param {boolean} enabled Trạng thái bật/tắt lịch sao lưu
 * @param {Date} [referenceDate] Mốc thời gian đối chiếu (mặc định là hiện tại)
 * @returns {{ isScheduled: boolean, text: string, relativeLabel: string, nextRunDate: Date | null }}
 */
export const calculateNextRunTime = (dailyTime, enabled, referenceDate = new Date()) => {
  if (!enabled) {
    return {
      isScheduled: false,
      text: 'Tính năng sao lưu tự động theo lịch hiện đang tắt',
      relativeLabel: 'Đã tạm dừng',
      nextRunDate: null,
    }
  }

  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  const trimmedTime = (dailyTime || '').trim()

  if (!timeRegex.test(trimmedTime)) {
    return {
      isScheduled: false,
      text: 'Giờ sao lưu không hợp lệ (yêu cầu định dạng HH:mm, ví dụ 23:00)',
      relativeLabel: 'Cấu hình không hợp lệ',
      nextRunDate: null,
    }
  }

  const [hoursStr, minutesStr] = trimmedTime.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = parseInt(minutesStr, 10)

  const candidateToday = new Date(referenceDate.getTime())
  candidateToday.setHours(hours, minutes, 0, 0)

  if (candidateToday.getTime() > referenceDate.getTime()) {
    return {
      isScheduled: true,
      text: `Lần sao lưu tiếp theo: ${trimmedTime} hôm nay (${formatDayMonthYear(candidateToday)})`,
      relativeLabel: `Hôm nay lúc ${trimmedTime}`,
      nextRunDate: candidateToday,
    }
  }

  const candidateTomorrow = new Date(candidateToday.getTime())
  candidateTomorrow.setDate(candidateTomorrow.getDate() + 1)

  return {
    isScheduled: true,
    text: `Lần sao lưu tiếp theo: ${trimmedTime} ngày mai (${formatDayMonthYear(candidateTomorrow)})`,
    relativeLabel: `Ngày mai lúc ${trimmedTime}`,
    nextRunDate: candidateTomorrow,
  }
}

/**
 * Cung cấp thông tin badge màu sắc và nhãn cho trạng thái bản sao lưu
 * @param {string} status 'SUCCESS' | 'FAILED' | 'IN_PROGRESS'
 * @returns {{ label: string, color: string, badgeStatus: string }}
 */
export const getBackupStatusInfo = (status) => {
  const normalized = String(status || '').toUpperCase()
  switch (normalized) {
    case 'SUCCESS':
      return {
        label: 'Thành công',
        color: 'success',
        badgeStatus: 'success',
      }
    case 'FAILED':
      return {
        label: 'Thất bại',
        color: 'error',
        badgeStatus: 'error',
      }
    case 'IN_PROGRESS':
      return {
        label: 'Đang chạy',
        color: 'processing',
        badgeStatus: 'processing',
      }
    default:
      return {
        label: status || 'Chưa xác định',
        color: 'default',
        badgeStatus: 'default',
      }
  }
}

/**
 * Cung cấp thông tin kết quả kiểm tra tính toàn vẹn bản sao lưu
 * @param {boolean} valid
 * @param {boolean} readable
 * @param {boolean} dataIntact
 * @returns {{ isSuccess: boolean, label: string, color: string }}
 */
export const getVerificationStatusInfo = (valid, readable, dataIntact) => {
  if (valid && readable && dataIntact) {
    return {
      isSuccess: true,
      label: 'Bản sao lưu đọc được và đầy đủ dữ liệu',
      color: 'success',
    }
  }
  return {
    isSuccess: false,
    label: 'Cảnh báo: Bản sao lưu phát hiện lỗi hoặc không toàn vẹn dữ liệu',
    color: 'error',
  }
}

/**
 * Xác định thông tin loại chạy: Theo lịch hoặc Thủ công
 * @param {object} record
 * @returns {{ label: string, color: string, isManual: boolean }}
 */
export const getExecutionTypeInfo = (record = {}) => {
  const execType = String(record?.executionType || '').toUpperCase()
  const backupType = String(record?.backupType || '').toUpperCase()
  const hasUserCreator = record?.createdBy && record.createdBy !== '00000000-0000-0000-0000-000000000000'

  if (execType === 'MANUAL' || backupType === 'MANUAL' || hasUserCreator) {
    return {
      label: 'Thủ công',
      color: 'purple',
      isManual: true,
    }
  }

  return {
    label: 'Theo lịch',
    color: 'blue',
    isManual: false,
  }
}
