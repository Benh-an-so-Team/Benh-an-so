import { isMedicalRecordSigned } from './medicalRecordSignHelpers.js'

/**
 * Helper utilities for exporting medical records according to data exchange structure (NCL-11-CN-007).
 * Adheres to QTN-41 (Signed prerequisite), QTN-22 (ICD-10 Primary Diagnosis code prerequisite),
 * and QTN-19 (Audit logging).
 */

export const MAX_EXPORT_BATCH_SIZE = 100

/**
 * Extracts filename from Content-Disposition header.
 * @param {string} contentDisposition
 * @param {string} fallback
 * @returns {string}
 */
export const extractFilenameFromHeader = (contentDisposition, fallback = 'emr-exchange-export.json') => {
  if (!contentDisposition || typeof contentDisposition !== 'string') {
    return fallback
  }

  // Check filename* (RFC 5987 / UTF-8)
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ''))
    } catch {
      // ignore decode error and try standard match
    }
  }

  // Check standard filename="..."
  const standardMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  return fallback
}

/**
 * Triggers browser download for a blob file and revokes object URL cleanly.
 * @param {Blob|ArrayBuffer|string} blobData
 * @param {string} filename
 * @param {object|string} [headersOrContentDisposition]
 * @returns {string} The final filename used for downloading
 */
export const downloadBlobFile = (blobData, filename = 'emr-exchange-export.json', headersOrContentDisposition = null) => {
  let finalFilename = filename

  const dispositionHeader = typeof headersOrContentDisposition === 'string'
    ? headersOrContentDisposition
    : (headersOrContentDisposition?.['content-disposition'] || headersOrContentDisposition?.['Content-Disposition'])

  if (dispositionHeader) {
    finalFilename = extractFilenameFromHeader(dispositionHeader, filename)
  }

  const blob = blobData instanceof Blob
    ? blobData
    : new Blob([blobData], { type: 'application/json;charset=utf-8;' })

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = window.URL?.createObjectURL
      ? window.URL.createObjectURL(blob)
      : (typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(blob) : '')

    if (url) {
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', finalFilename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      if (window.URL?.revokeObjectURL) {
        window.URL.revokeObjectURL(url)
      } else if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(url)
      }
    }
  }

  return finalFilename
}

/**
 * Parses error from Axios response when responseType is 'blob'.
 * Extracts the real JSON error response body (status, code, message, details).
 * Safely handles non-blob, string, and malformed inputs without throwing.
 * @param {any} errorResponse
 * @returns {Promise<any>}
 */
export const extractBlobErrorMessage = async (errorResponse) => {
  if (!errorResponse) return null

  // Case 1: axios error with error.response.data as Blob
  const rawData = errorResponse?.response?.data || errorResponse?.data || errorResponse
  if (rawData && typeof rawData.text === 'function') {
    try {
      const text = await rawData.text()
      try {
        return JSON.parse(text)
      } catch {
        return { message: text }
      }
    } catch {
      return null
    }
  }

  // Case 2: error.apiError already populated by axiosClient
  if (errorResponse?.apiError && typeof errorResponse.apiError === 'object') {
    return errorResponse.apiError
  }

  // Case 3: Already an object
  if (typeof rawData === 'object') {
    return rawData
  }

  // Case 4: String
  if (typeof rawData === 'string') {
    try {
      return JSON.parse(rawData)
    } catch {
      return { message: rawData }
    }
  }

  return null
}

/**
 * Maps medical record export errors to descriptive, user-friendly Vietnamese messages.
 * Maps individually:
 * - MEDICAL_RECORD_NOT_SIGNED: "Hồ sơ [mã] chưa được ký, không thể xuất."
 * - MEDICAL_RECORD_MISSING_DIAGNOSIS: "Hồ sơ [mã] thiếu chẩn đoán chính có mã bệnh, không thể xuất."
 * - Batch size > 100: "Chỉ được chọn tối đa 100 hồ sơ mỗi lần xuất."
 * - 403 / Access Denied: Role & permission error
 * - All-or-Nothing explanation
 * @param {any} errorDataOrCode
 * @param {string|object} [recordInfo]
 * @returns {string}
 */
export const mapExportErrorMessage = (errorDataOrCode, recordInfo = null) => {
  if (!errorDataOrCode) {
    return 'Xuất hồ sơ bệnh án không thành công. Vui lòng thử lại.'
  }

  let code = ''
  let status = null
  let rawMessage = ''

  if (typeof errorDataOrCode === 'string') {
    code = errorDataOrCode.trim().toUpperCase()
  } else if (typeof errorDataOrCode === 'object') {
    code = String(
      errorDataOrCode.code ||
      errorDataOrCode.errorCode ||
      errorDataOrCode.response?.data?.code ||
      errorDataOrCode.apiError?.code ||
      ''
    ).trim().toUpperCase()

    status = errorDataOrCode.status ||
      errorDataOrCode.response?.status ||
      errorDataOrCode.apiError?.status

    rawMessage = String(
      errorDataOrCode.message ||
      errorDataOrCode.response?.data?.message ||
      errorDataOrCode.apiError?.message ||
      ''
    )
  }

  // Extract record identifier if available
  let recordCode = ''
  if (typeof recordInfo === 'string') {
    recordCode = recordInfo
  } else if (recordInfo && typeof recordInfo === 'object') {
    recordCode = recordInfo.recordCode || recordInfo.patientCode || recordInfo.id || recordInfo.medicalRecordId || ''
  }

  // If code is not set, try to infer from message
  if (!code) {
    if (/not[_\s]?signed/i.test(rawMessage) || /must be signed/i.test(rawMessage) || /chưa được ký/i.test(rawMessage)) {
      code = 'MEDICAL_RECORD_NOT_SIGNED'
    } else if (/missing[_\s]?diagnosis/i.test(rawMessage) || /chẩn đoán/i.test(rawMessage) || /mã bệnh/i.test(rawMessage)) {
      code = 'MEDICAL_RECORD_MISSING_DIAGNOSIS'
    } else if (/100/i.test(rawMessage) || /max.*batch/i.test(rawMessage)) {
      code = 'MAX_BATCH_SIZE_EXCEEDED'
    } else if (status === 403) {
      code = 'ACCESS_DENIED'
    } else if (status === 401) {
      code = 'UNAUTHORIZED'
    }
  }

  // Also extract UUID or code from message if present and recordCode was not passed
  if (!recordCode && rawMessage) {
    const uuidMatch = rawMessage.match(/[0-9a-fA-F-]{36}/)
    if (uuidMatch) {
      recordCode = uuidMatch[0]
    }
  }

  const recordPrefix = recordCode ? `Hồ sơ [${recordCode}]` : 'Hồ sơ'

  switch (code) {
    case 'MEDICAL_RECORD_NOT_SIGNED':
      return `${recordPrefix} chưa được ký, không thể xuất. Theo quy định (QTN-41), chỉ bệnh án đã ký duyệt mới đủ điều kiện xuất trao đổi dữ liệu.`

    case 'MEDICAL_RECORD_MISSING_DIAGNOSIS':
      return `${recordPrefix} thiếu chẩn đoán chính có mã bệnh, không thể xuất. Theo quy định (QTN-22), hồ sơ phải có ít nhất một chẩn đoán chính gắn mã bệnh ICD-10.`

    case 'MAX_BATCH_SIZE_EXCEEDED':
    case 'BATCH_SIZE_EXCEEDED':
      return 'Chỉ được chọn tối đa 100 hồ sơ mỗi lần xuất. Vui lòng giảm số lượng hồ sơ đã chọn.'

    case 'ACCESS_DENIED':
    case 'FORBIDDEN':
      return 'Bạn không có quyền xuất hồ sơ bệnh án theo cấu trúc trao đổi dữ liệu (MEDICAL_RECORD_EXPORT). Chức năng chỉ dành cho Quản trị viên và Quản lý phòng khám.'

    case 'UNAUTHORIZED':
      return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'

    case 'MEDICAL_RECORD_NOT_FOUND':
      return recordCode
        ? `Không tìm thấy hồ sơ bệnh án [${recordCode}] trong hệ thống.`
        : 'Không tìm thấy hồ sơ bệnh án yêu cầu trong hệ thống.'

    case 'VALIDATION_ERROR':
    case 'VALIDATION_FAILED':
      if (rawMessage.includes('100') || rawMessage.toLowerCase().includes('maximum')) {
        return 'Chỉ được chọn tối đa 100 hồ sơ mỗi lần xuất. Vui lòng giảm số lượng hồ sơ đã chọn.'
      }
      if (rawMessage.toLowerCase().includes('signed')) {
        return `${recordPrefix} chưa được ký, không thể xuất. Theo quy định (QTN-41), chỉ hồ sơ đã ký mới được xuất.`
      }
      if (rawMessage.toLowerCase().includes('diagnosis')) {
        return `${recordPrefix} thiếu chẩn đoán chính có mã bệnh, không thể xuất.`
      }
      return rawMessage || 'Thông tin yêu cầu xuất hồ sơ không hợp lệ.'

    default:
      if (status === 403) {
        return 'Bạn không có quyền xuất hồ sơ bệnh án theo cấu trúc trao đổi dữ liệu (MEDICAL_RECORD_EXPORT).'
      }
      if (rawMessage) {
        return rawMessage
      }
      return 'Xuất hồ sơ bệnh án không thành công. Vui lòng kiểm tra lại điều kiện hồ sơ hoặc thử lại sau.'
  }
}

/**
 * Checks whether a single medical record is eligible for export.
 * Reuses isMedicalRecordSigned from medicalRecordSignHelpers.js (QTN-41).
 * Returns true ONLY when status is SIGNED, LOCKED, or ARCHIVED.
 * @param {object|string} recordOrStatus
 * @returns {boolean}
 */
export const canExportRecord = (recordOrStatus) => {
  return isMedicalRecordSigned(recordOrStatus) === true
}

/**
 * Returns tooltip reason when a medical record cannot be exported.
 * @param {object|string} recordOrStatus
 * @returns {string}
 */
export const getExportEligibilityReason = (recordOrStatus) => {
  if (canExportRecord(recordOrStatus)) {
    return ''
  }
  return 'Chỉ xuất được hồ sơ đã ký'
}

/**
 * Checks whether the current user has permission to export medical records.
 * Only ADMIN and MANAGER roles, or users with MEDICAL_RECORD_EXPORT permission.
 * Doctors, pharmacists, receptionists without export permission are denied.
 * @param {string[]} [roles]
 * @param {string[]} [permissions]
 * @returns {boolean}
 */
export const canUserExportMedicalRecords = (roles = [], permissions = []) => {
  const normalizedRoles = (Array.isArray(roles) ? roles : [roles])
    .map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
    .filter(Boolean)

  const normalizedPerms = (Array.isArray(permissions) ? permissions : [permissions])
    .map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
    .filter(Boolean)

  const hasExportPerm = normalizedPerms.includes('MEDICAL_RECORD_EXPORT')
  const isAdmin = normalizedRoles.includes('admin')
  const isManager = normalizedRoles.includes('manager') || normalizedRoles.includes('clinic_manager')

  return hasExportPerm || isAdmin || isManager
}
