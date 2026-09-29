/**
 * Electronic Prescription Code (Mã đơn thuốc điện tử) Utilities & Validation
 * 
 * Mỗi đơn thuốc trong hệ thống được cấp một định danh duy nhất (format RX000001...)
 * phục vụ in ấn, tra cứu tại quầy dược và liên thông hệ thống.
 * Mã đơn được gắn cố định với đơn và không thay đổi trong suốt vòng đời của đơn.
 */

// Pattern for electronic prescription code (e.g. RX000001, RX123456, DT-..., etc.)
export const ELECTRONIC_PRESCRIPTION_CODE_REGEX = /^RX\d{6,}$/i
export const GENERAL_PRESCRIPTION_CODE_REGEX = /^(RX\d{6,}|DT-[A-Za-z0-9_-]+|[A-Za-z0-9_-]{3,30})$/i

/**
 * Kiểm tra xem một chuỗi có phải mã đơn thuốc điện tử hợp lệ hay không.
 * @param {string} code 
 * @returns {boolean}
 */
export const isValidElectronicPrescriptionCode = (code) => {
  if (!code || typeof code !== 'string') return false
  const trimmed = code.trim()
  return GENERAL_PRESCRIPTION_CODE_REGEX.test(trimmed)
}

/**
 * Kiểm tra xem mã có đúng chuẩn định dạng RX sequence của Backend không.
 * @param {string} code 
 * @returns {boolean}
 */
export const isStandardRxCode = (code) => {
  if (!code || typeof code !== 'string') return false
  return ELECTRONIC_PRESCRIPTION_CODE_REGEX.test(code.trim())
}

/**
 * Chuẩn hóa mã đơn thuốc điện tử để hiển thị trên giao diện.
 * @param {string} code 
 * @param {string} fallbackId 
 * @returns {string}
 */
export const formatPrescriptionCode = (code, fallbackId = '') => {
  if (code && typeof code === 'string' && code.trim()) {
    return code.trim().toUpperCase()
  }
  if (fallbackId && typeof fallbackId === 'string' && fallbackId.trim()) {
    return fallbackId.trim()
  }
  return '—'
}

/**
 * Kiểm tra tính bất biến của mã đơn thuốc khi thực hiện điều chỉnh đơn.
 * @param {string} originalCode 
 * @param {string} updatedCode 
 * @returns {{ isImmutable: boolean, code: string, error?: string }}
 */
export const verifyPrescriptionCodeImmutability = (originalCode, updatedCode) => {
  if (!originalCode && !updatedCode) {
    return { isImmutable: false, code: '', error: 'Thiếu mã đơn thuốc gốc và mã cập nhật.' }
  }

  const normalizedOriginal = formatPrescriptionCode(originalCode)
  const normalizedUpdated = formatPrescriptionCode(updatedCode || originalCode)

  if (normalizedOriginal !== '—' && normalizedUpdated !== '—' && normalizedOriginal !== normalizedUpdated) {
    return {
      isImmutable: false,
      code: normalizedOriginal,
      error: `Mã đơn thuốc không được phép thay đổi trong suốt vòng đời (Gốc: ${normalizedOriginal}, Cập nhật: ${normalizedUpdated}).`,
    }
  }

  return {
    isImmutable: true,
    code: normalizedOriginal !== '—' ? normalizedOriginal : normalizedUpdated,
  }
}

/**
 * Tìm kiếm & lọc danh sách đơn thuốc theo từ khóa (Mã đơn điện tử, Mã BN, Tên BN, Mã khám).
 * @param {Array} prescriptions 
 * @param {string} keyword 
 * @returns {Array}
 */
export const filterPrescriptionsByKeyword = (prescriptions = [], keyword = '') => {
  if (!Array.isArray(prescriptions)) return []
  const cleanKeyword = String(keyword || '').trim().toLowerCase()
  if (!cleanKeyword) return prescriptions

  return prescriptions.filter((p) => {
    if (!p) return false
    const matchCode = String(p.prescriptionCode || p.code || p.id || '').toLowerCase().includes(cleanKeyword)
    const matchPatientCode = String(p.patientCode || '').toLowerCase().includes(cleanKeyword)
    const matchPatientName = String(p.patientName || '').toLowerCase().includes(cleanKeyword)
    const matchVisitCode = String(p.visitCode || '').toLowerCase().includes(cleanKeyword)
    const matchDoctor = String(p.doctorName || '').toLowerCase().includes(cleanKeyword)
    return matchCode || matchPatientCode || matchPatientName || matchVisitCode || matchDoctor
  })
}

/**
 * Sinh cấu hình hiển thị tag / badge cho mã đơn thuốc điện tử.
 * @param {string} code 
 * @param {string} status 
 * @returns {object}
 */
export const getElectronicPrescriptionBadgeProps = (code, status) => {
  const isRx = isStandardRxCode(code)
  let badgeColor = '#2563eb'
  if (status === 'DISPENSED') {
    badgeColor = 'green'
  } else if (status === 'PARTIALLY_DISPENSED') {
    badgeColor = '#d97706'
  } else if (status === 'CANCELLED') {
    badgeColor = 'default'
  } else if (status === 'REPLACED') {
    badgeColor = 'purple'
  }

  return {
    code: formatPrescriptionCode(code),
    isStandardRx: isRx,
    color: badgeColor,
    tooltipText: isRx
      ? 'Mã đơn thuốc điện tử chuẩn liên thông quốc gia (Định danh duy nhất không đổi)'
      : 'Mã đơn thuốc nội bộ phục vụ tra cứu và in ấn',
    badgeLabel: 'Đơn điện tử',
  }
}

/**
 * Cấu hình trạng thái liên thông đơn thuốc quốc gia
 */
export const INTERCONNECTION_STATUS_CONFIG = {
  NOT_SENT: {
    key: 'NOT_SENT',
    label: 'Chưa gửi liên thông',
    shortLabel: 'Chưa liên thông',
    color: 'default',
    tagColor: '#64748b',
    bgColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    description: 'Đơn thuốc chưa được gửi lên cổng dịch vụ liên thông quốc gia.',
  },
  SUCCESS: {
    key: 'SUCCESS',
    label: 'Đã liên thông thành công',
    shortLabel: 'Đã liên thông',
    color: 'success',
    tagColor: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
    description: 'Đơn thuốc đã được hệ thống liên thông tiếp nhận thành công và cấp mã biên nhận.',
  },
  FAILED: {
    key: 'FAILED',
    label: 'Gửi liên thông thất bại',
    shortLabel: 'Gửi lỗi',
    color: 'error',
    tagColor: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
    description: 'Quá trình gửi đơn lên cổng liên thông gặp lỗi hoặc bị từ chối.',
  },
}

/**
 * Trả về thông tin cấu hình trạng thái liên thông của đơn thuốc
 * @param {string} status 
 * @param {string} receiptCode 
 * @param {string} failureReason 
 * @returns {object}
 */
export const getInterconnectionStatusInfo = (status, receiptCode = '', failureReason = '') => {
  const normalizedStatus = (status || 'NOT_SENT').toUpperCase()
  const config = INTERCONNECTION_STATUS_CONFIG[normalizedStatus] || INTERCONNECTION_STATUS_CONFIG.NOT_SENT

  return {
    ...config,
    rawStatus: normalizedStatus,
    receiptCode: receiptCode || '',
    failureReason: failureReason || '',
    isSuccess: normalizedStatus === 'SUCCESS',
    isFailed: normalizedStatus === 'FAILED',
    isNotSent: normalizedStatus === 'NOT_SENT',
  }
}

