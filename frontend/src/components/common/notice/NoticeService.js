/**
 * NoticeService.js
 * Quản lý trạng thái và dịch vụ thông báo toàn cục góc dưới bên phải (Bottom-Right Notice System).
 * Áp dụng thống nhất cho toàn bộ hệ thống quản lý phòng khám (Admin, Bác sĩ, Lễ tân, Dược sĩ, Bệnh nhân).
 */

import {
  sanitizeNoticeMessage,
  sanitizeNoticeTitle,
  resolveAccessDeniedNotice,
  formatValidationSummary,
  formatExcelValidationSummary,
  generateReferenceCode,
} from '../../../utils/noticeSecurityHelpers.js'
import noticeBellStore from '../../../utils/NoticeBellStore.js'
import { getApiErrorMessage, isAccessDeniedApiError } from '../../../utils/apiError.js'

export const NOTICE_LEVELS = {
  ERROR: 'error',
  WARNING: 'warning',
  CRITICAL: 'critical',
  SUCCESS: 'success',
  INFO: 'info',
}

export const DEFAULT_DURATIONS = {
  [NOTICE_LEVELS.ERROR]: 8000,
  [NOTICE_LEVELS.WARNING]: 8000,
  [NOTICE_LEVELS.CRITICAL]: 0, // 0 = persistent, KHÔNG tự tắt
  [NOTICE_LEVELS.SUCCESS]: 4000,
  [NOTICE_LEVELS.INFO]: 4000,
}

export const MAX_VISIBLE_NOTICES = 4

class NoticeService {
  constructor() {
    this.notices = []
    this.listeners = new Set()
    this.timers = new Map() // id -> { timerId, startTs, remaining, duration, isPaused }
  }

  notify() {
    const snapshot = this.getSnapshot()
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[NoticeService] Listener error:', err)
      }
    })
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot() {
    const total = this.notices.length
    // Lấy tối đa MAX_VISIBLE_NOTICES cái mới nhất
    // Sắp xếp: cái mới nhất nằm dưới cùng của danh sách hiển thị
    const visibleNotices = this.notices.slice(-MAX_VISIBLE_NOTICES)
    const overflowCount = Math.max(0, total - MAX_VISIBLE_NOTICES)

    return {
      allNotices: [...this.notices],
      visibleNotices,
      overflowCount,
      totalCount: total,
    }
  }

  /**
   * Tạo hoặc cập nhật thông báo (Hỗ trợ chống lặp deduplication)
   */
  show(options = {}) {
    if (!options) return null

    const level = options.level || NOTICE_LEVELS.INFO
    const rawTitle = options.title || (level === NOTICE_LEVELS.ERROR ? 'Đã xảy ra lỗi' : 'Thông báo')
    const rawMessage = options.message || ''

    const referenceCode = options.referenceCode || (level === NOTICE_LEVELS.ERROR ? generateReferenceCode('ERR') : null)
    const sanitizedTitle = sanitizeNoticeTitle(rawTitle)
    const sanitizedMessage = sanitizeNoticeMessage(rawMessage, { referenceCode })

    // Xác định thời gian hiển thị
    const isCritical = level === NOTICE_LEVELS.CRITICAL
    const persistent = options.persistent !== undefined ? Boolean(options.persistent) : isCritical
    const defaultDuration = DEFAULT_DURATIONS[level] ?? 4000
    const duration = persistent ? 0 : (typeof options.duration === 'number' ? options.duration : defaultDuration)

    // Khóa deduplication để chống lặp
    const dedupeKey = options.dedupeKey || `${level}::${sanitizedTitle}::${sanitizedMessage}`

    // 1. Kiểm tra chống lặp: nếu cùng dedupeKey đã tồn tại
    const existingIndex = this.notices.findIndex((n) => n.dedupeKey === dedupeKey)
    if (existingIndex !== -1) {
      const existing = this.notices[existingIndex]
      const newCount = (existing.count || 1) + 1

      const updatedNotice = {
        ...existing,
        count: newCount,
        updatedAt: Date.now(),
        // Cập nhật lại action hoặc countdown nếu có thay đổi
        action: options.action || existing.action,
        countdownSeconds: options.countdownSeconds !== undefined ? options.countdownSeconds : existing.countdownSeconds,
      }

      // Đưa thông báo trùng lên cuối để vẫn là mới nhất
      const nextNotices = [...this.notices]
      nextNotices.splice(existingIndex, 1)
      nextNotices.push(updatedNotice)
      this.notices = nextNotices

      // Reset lại bộ đếm giờ nếu là thông báo có thời hạn
      this.clearTimer(existing.id)
      if (duration > 0) {
        this.startTimer(existing.id, duration)
      }

      this.notify()
      return existing.id
    }

    // 2. Tạo thông báo mới
    const id = options.id || `notice-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const notice = {
      id,
      dedupeKey,
      level,
      title: sanitizedTitle,
      message: sanitizedMessage,
      action: options.action || null,
      persistent,
      duration,
      count: 1,
      referenceCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      countdownSeconds: options.countdownSeconds,
      onCountdownEnd: options.onCountdownEnd,
    }

    this.notices.push(notice)

    // Khởi chạy timer tự tắt
    if (duration > 0) {
      this.startTimer(id, duration)
    }

    // Xử lý đếm ngược (nếu có cấu hình countdownSeconds, ví dụ cảnh báo hết phiên làm việc)
    if (typeof options.countdownSeconds === 'number' && options.countdownSeconds > 0) {
      this.startCountdown(id, options.countdownSeconds, options.onCountdownEnd)
    }

    // Tự động lưu vào chuông thông báo nếu được yêu cầu hoặc thuộc các loại cảnh báo quan trọng
    if (options.saveToBell || isCritical || options.bellCategory) {
      noticeBellStore.addBellNotification({
        id: `bell-${id}`,
        category: options.bellCategory || (isCritical ? 'CLINICAL' : 'SYSTEM'),
        title: sanitizedTitle,
        message: sanitizedMessage,
        level,
        referenceCode,
        actionUrl: options.actionUrl || null,
      })
    }

    this.notify()
    return id
  }

  startTimer(id, duration) {
    this.clearTimer(id)
    const startTs = Date.now()
    const timerId = setTimeout(() => {
      this.dismiss(id)
    }, duration)

    this.timers.set(id, {
      timerId,
      startTs,
      remaining: duration,
      duration,
      isPaused: false,
    })
  }

  clearTimer(id) {
    if (this.timers.has(id)) {
      const data = this.timers.get(id)
      if (data.timerId) clearTimeout(data.timerId)
      if (data.countdownInterval) clearInterval(data.countdownInterval)
      this.timers.delete(id)
    }
  }

  startCountdown(id, initialSeconds, onEnd) {
    let remaining = initialSeconds
    const interval = setInterval(() => {
      remaining -= 1
      const notice = this.notices.find((n) => n.id === id)
      if (!notice) {
        clearInterval(interval)
        return
      }

      if (remaining <= 0) {
        clearInterval(interval)
        this.updateNotice(id, { countdownSeconds: 0 })
        if (typeof onEnd === 'function') {
          try {
            onEnd()
          } catch (e) {
            console.error('[NoticeService] onCountdownEnd error:', e)
          }
        }
      } else {
        this.updateNotice(id, { countdownSeconds: remaining })
      }
    }, 1000)

    const timerData = this.timers.get(id) || {}
    timerData.countdownInterval = interval
    this.timers.set(id, timerData)
  }

  /**
   * Tạm dừng đếm giờ khi rê chuột vào (Pause on hover)
   */
  pauseNotice(id) {
    const timerData = this.timers.get(id)
    if (!timerData || timerData.isPaused || timerData.remaining <= 0) return

    clearTimeout(timerData.timerId)
    const elapsed = Date.now() - timerData.startTs
    const remaining = Math.max(200, timerData.remaining - elapsed)

    timerData.remaining = remaining
    timerData.isPaused = true
    this.timers.set(id, timerData)
  }

  /**
   * Tiếp tục đếm giờ khi rời chuột ra (Resume on leave)
   */
  resumeNotice(id) {
    const timerData = this.timers.get(id)
    if (!timerData || !timerData.isPaused || timerData.remaining <= 0) return

    timerData.startTs = Date.now()
    timerData.isPaused = false
    timerData.timerId = setTimeout(() => {
      this.dismiss(id)
    }, timerData.remaining)

    this.timers.set(id, timerData)
  }

  updateNotice(id, partial) {
    let changed = false
    this.notices = this.notices.map((n) => {
      if (n.id === id) {
        changed = true
        return { ...n, ...partial, updatedAt: Date.now() }
      }
      return n
    })
    if (changed) this.notify()
  }

  /**
   * Đóng một thông báo cụ thể
   */
  dismiss(id) {
    this.clearTimer(id)
    const prevLen = this.notices.length
    this.notices = this.notices.filter((n) => n.id !== id)
    if (this.notices.length !== prevLen) {
      this.notify()
    }
  }

  /**
   * Đóng tất cả các thông báo đang hiển thị
   */
  clearAll() {
    this.timers.forEach((_, id) => this.clearTimer(id))
    this.notices = []
    this.notify()
  }
}

export const noticeManager = new NoticeService()

/**
 * Hàm gọi chính toàn cục
 */
export function showNotice(options) {
  return noticeManager.show(options)
}

// Các hàm tiện ích theo 4 mức độ:
showNotice.error = (titleOrOpts, message, extra = {}) => {
  if (typeof titleOrOpts === 'object' && titleOrOpts !== null) {
    return noticeManager.show({ ...titleOrOpts, level: NOTICE_LEVELS.ERROR })
  }
  return noticeManager.show({
    level: NOTICE_LEVELS.ERROR,
    title: titleOrOpts,
    message,
    ...extra,
  })
}

showNotice.warning = (titleOrOpts, message, action, extra = {}) => {
  if (typeof titleOrOpts === 'object' && titleOrOpts !== null) {
    return noticeManager.show({ ...titleOrOpts, level: NOTICE_LEVELS.WARNING })
  }
  return noticeManager.show({
    level: NOTICE_LEVELS.WARNING,
    title: titleOrOpts,
    message,
    action,
    ...extra,
  })
}

showNotice.critical = (titleOrOpts, message, action, extra = {}) => {
  if (typeof titleOrOpts === 'object' && titleOrOpts !== null) {
    return noticeManager.show({ ...titleOrOpts, level: NOTICE_LEVELS.CRITICAL, persistent: true })
  }
  return noticeManager.show({
    level: NOTICE_LEVELS.CRITICAL,
    title: titleOrOpts,
    message,
    action,
    persistent: true,
    ...extra,
  })
}

showNotice.success = (titleOrOpts, message, extra = {}) => {
  if (typeof titleOrOpts === 'object' && titleOrOpts !== null) {
    return noticeManager.show({ ...titleOrOpts, level: NOTICE_LEVELS.SUCCESS })
  }
  return noticeManager.show({
    level: NOTICE_LEVELS.SUCCESS,
    title: titleOrOpts,
    message,
    ...extra,
  })
}

showNotice.info = (titleOrOpts, message, extra = {}) => {
  if (typeof titleOrOpts === 'object' && titleOrOpts !== null) {
    return noticeManager.show({ ...titleOrOpts, level: NOTICE_LEVELS.INFO })
  }
  return noticeManager.show({
    level: NOTICE_LEVELS.INFO,
    title: titleOrOpts,
    message,
    ...extra,
  })
}

/**
 * Tiện ích: Cảnh báo an toàn lâm sàng (tương tác thuốc, dị ứng, chống chỉ định, quá liều tối đa, chỉ số XN)
 * Mức nghiêm trọng (critical), KHÔNG tự tắt, lưu vào chuông
 */
showNotice.clinicalAlert = (options = {}) => {
  const { title = 'Cảnh báo an toàn lâm sàng', message, action, actionUrl, dedupeKey } = options
  return noticeManager.show({
    level: NOTICE_LEVELS.CRITICAL,
    title,
    message,
    action,
    actionUrl,
    persistent: true,
    saveToBell: true,
    bellCategory: 'CLINICAL',
    dedupeKey: dedupeKey || `clinical-alert::${title}::${message}`,
  })
}

/**
 * Tiện ích: Cảnh báo hết phiên làm việc
 * Dạng không tự tắt, có đếm ngược giây và nút "Tiếp tục làm việc"
 */
showNotice.sessionTimeout = ({ remainingSeconds = 60, onExtend, onLogout }) => {
  const noticeId = 'session-idle-timeout-notice'
  return noticeManager.show({
    id: noticeId,
    dedupeKey: 'session-timeout',
    level: NOTICE_LEVELS.CRITICAL,
    title: 'Cảnh báo hết phiên làm việc',
    message: `Phiên làm việc sẽ kết thúc sau ${remainingSeconds} giây do không có thao tác.`,
    persistent: true,
    countdownSeconds: remainingSeconds,
    action: {
      label: 'Tiếp tục làm việc',
      onClick: () => {
        noticeManager.dismiss(noticeId)
        if (typeof onExtend === 'function') onExtend()
      },
    },
    onCountdownEnd: () => {
      noticeManager.dismiss(noticeId)
      if (typeof onLogout === 'function') onLogout()
    },
  })
}

/**
 * Tiện ích: Từ chối truy cập (403 Forbidden)
 * Tự động chọn thông điệp thân thiện theo ngữ cảnh (Cổng bệnh nhân vs Nhân viên y tế)
 */
showNotice.accessDenied = ({ isPatientPortal = false, action = null } = {}) => {
  const resolved = resolveAccessDeniedNotice(isPatientPortal)
  return noticeManager.show({
    level: NOTICE_LEVELS.ERROR,
    title: resolved.title,
    message: resolved.message,
    action,
    dedupeKey: `access-denied::${isPatientPortal}`,
  })
}

/**
 * Tiện ích: Tóm tắt lỗi nhập liệu biểu mẫu (Form Validation)
 * Góc dưới chỉ hiện 1 dòng tóm tắt
 */
showNotice.validationSummary = ({ errorCount = 1, isExcel = false } = {}) => {
  const message = isExcel ? formatExcelValidationSummary(errorCount) : formatValidationSummary(errorCount)
  return noticeManager.show({
    level: NOTICE_LEVELS.ERROR,
    title: 'Thông tin chưa hợp lệ',
    message,
    dedupeKey: `validation-summary::${isExcel ? 'excel' : 'form'}::${errorCount}`,
  })
}

/**
 * Tiện ích: Bắt và chuẩn hóa lỗi API
 * Tự động chuyển đổi lỗi Backend thành thông báo tiếng Việt sạch sẽ, không lộ mã kỹ thuật
 */
showNotice.apiError = (error, fallbackTitle = 'Thao tác không thành công', fallbackMessage) => {
  if (isAccessDeniedApiError(error)) {
    const isPortal = typeof window !== 'undefined' && window.location?.pathname?.startsWith('/portal')
    return showNotice.accessDenied({ isPatientPortal: isPortal })
  }

  const vietnameseMessage = getApiErrorMessage(error, fallbackMessage)
  const refCode = generateReferenceCode('ERR')

  return noticeManager.show({
    level: NOTICE_LEVELS.ERROR,
    title: fallbackTitle,
    message: vietnameseMessage,
    referenceCode: refCode,
  })
}

export const dismissNotice = (id) => noticeManager.dismiss(id)
export const clearAllNotices = () => noticeManager.clearAll()

if (typeof window !== 'undefined') {
  window.showNotice = showNotice
}

export default showNotice
