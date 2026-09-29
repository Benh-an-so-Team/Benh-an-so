/**
 * Helper utilities for Prescription Lookup (NCL-12-CN-006: Tra cứu đơn thuốc bằng mã đơn khi cấp phát)
 */

export const PRESCRIPTION_STATUS = {
  PENDING_DISPENSE: 'PENDING_DISPENSE',
  PARTIALLY_DISPENSED: 'PARTIALLY_DISPENSED',
  DISPENSED: 'DISPENSED',
  CANCELLED: 'CANCELLED',
  REPLACED: 'REPLACED',
}

export const PRESCRIPTION_STATUS_LABELS = {
  [PRESCRIPTION_STATUS.PENDING_DISPENSE]: 'Chưa cấp',
  [PRESCRIPTION_STATUS.PARTIALLY_DISPENSED]: 'Đã cấp một phần',
  [PRESCRIPTION_STATUS.DISPENSED]: 'Đã cấp phát',
  [PRESCRIPTION_STATUS.CANCELLED]: 'Đã hủy',
  [PRESCRIPTION_STATUS.REPLACED]: 'Đã thay thế',
}

/**
 * Chuẩn hóa mã đơn thuốc: trim khoảng trắng và chuyển thành chữ in hoa.
 * @param {string} code
 * @returns {string}
 */
export const normalizeCode = (code) => {
  if (typeof code !== 'string') return ''
  return code.trim().toUpperCase()
}

/**
 * Lấy nhãn tiếng Việt tương ứng cho trạng thái đơn thuốc.
 * @param {string} status
 * @returns {string}
 */
export const getPrescriptionStatusLabel = (status) => {
  if (!status) return 'Không xác định'
  return PRESCRIPTION_STATUS_LABELS[status] || status
}

/**
 * Kiểm tra xem đơn thuốc có được phép cấp phát hay không.
 * Chỉ cho phép cấp phát khi đơn ở trạng thái PENDING_DISPENSE hoặc PARTIALLY_DISPENSED.
 * @param {string} status
 * @returns {boolean}
 */
export const isDispensable = (status) => {
  return status === PRESCRIPTION_STATUS.PENDING_DISPENSE || status === PRESCRIPTION_STATUS.PARTIALLY_DISPENSED
}

/**
 * Lấy lý do không thể cấp phát thuốc khi đơn thuốc không hợp lệ.
 * Trả về null nếu đơn thuốc đủ điều kiện cấp phát.
 * @param {string} status
 * @returns {string|null}
 */
export const getDispenseBlockedReason = (status) => {
  if (isDispensable(status)) return null

  switch (status) {
    case PRESCRIPTION_STATUS.DISPENSED:
      return 'Đơn thuốc đã được cấp phát rồi.'
    case PRESCRIPTION_STATUS.CANCELLED:
      return 'Đơn thuốc đã bị hủy.'
    case PRESCRIPTION_STATUS.REPLACED:
      return 'Đơn thuốc này đã bị thay thế.'
    default:
      return 'Đơn thuốc không thể cấp phát.'
  }
}

/**
 * Cấu hình hiển thị badge và màu sắc trạng thái trên UI.
 * @param {string} status
 * @returns {{ color: string, label: string }}
 */
export const getStatusBadgeConfig = (status) => {
  switch (status) {
    case PRESCRIPTION_STATUS.PENDING_DISPENSE:
      return { color: 'blue', label: 'Chưa cấp' }
    case PRESCRIPTION_STATUS.PARTIALLY_DISPENSED:
      return { color: 'gold', label: 'Đã cấp một phần' }
    case PRESCRIPTION_STATUS.DISPENSED:
      return { color: 'default', label: 'Đã cấp phát' }
    case PRESCRIPTION_STATUS.CANCELLED:
      return { color: 'error', label: 'Đã hủy' }
    case PRESCRIPTION_STATUS.REPLACED:
      return { color: 'purple', label: 'Đã thay thế' }
    default:
      return { color: 'default', label: status || 'Không xác định' }
  }
}
