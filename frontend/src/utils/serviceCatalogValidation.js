/* global TextDecoder */

import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { normalizeApiError } from './apiError.js'

dayjs.extend(customParseFormat)

const win1252Map = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
  0x9E: 0x017E, 0x9F: 0x0178
}
const revMap = {}
for (let b = 0; b < 256; b++) {
  const unicode = win1252Map[b] || b
  revMap[unicode] = b
}

/**
 * Repairs UTF-8 strings misdecoded as Windows-1252 / ISO-8859-1 (mojibake)
 */
export function fixMojibake(str) {
  if (!str || typeof str !== 'string') return str
  if (!/[ÃÄÅÆáàâãèéêìíòóôõùúý»¿º]/i.test(str)) return str

  try {
    const bytes = []
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      if (revMap[code] !== undefined) {
        bytes.push(revMap[code])
      } else if (code < 256) {
        bytes.push(code)
      } else {
        return str
      }
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  } catch {
    return str
  }
}

/**
 * Focus and scroll to first form item with error
 */
export function focusFirstErrorField(fieldName) {
  if (typeof document === 'undefined' || !fieldName) return false
  const selectors = [
    `#${fieldName}`,
    `input[name="${fieldName}"]`,
    `input[id*="${fieldName}"]`,
    `input[id$="${fieldName}"]`,
    `[data-field="${fieldName}"] input`,
    `[id*="${fieldName}"] input`,
    `[id*="${fieldName}"]`,
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && typeof el.focus === 'function') {
      try {
        el.focus()
        return true
      } catch {
        // ignore
      }
    }
  }
  return false
}

/**
 * Check if a service name already exists in the given service list.
 * Normalized comparison (trimmed, multiple spaces collapsed, case-insensitive).
 * @param {string} name - The candidate service name
 * @param {Array} servicesList - The existing services list
 * @param {string|number|null} excludeId - Current service ID to exclude if editing
 * @returns {boolean}
 */
export function isDuplicateServiceName(name, servicesList = [], excludeId = null) {
  if (!name || typeof name !== 'string') return false
  const normalizedCandidate = name.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!normalizedCandidate) return false

  return (servicesList || []).some((s) => {
    const sId = s.id || s.serviceCatalogId
    if (excludeId !== null && excludeId !== undefined && String(sId) === String(excludeId)) {
      return false
    }
    const sName = (s.name || '').trim().replace(/\s+/g, ' ').toLowerCase()
    return sName === normalizedCandidate
  })
}

/**
 * Validate service code (Mã dịch vụ)
 * Rules: Required, max 50 chars, alphanumeric + underscores + dashes
 */
export function validateServiceCode(code) {
  const trimmed = (code || '').toString().trim()
  if (!trimmed) {
    return { valid: false, error: 'Mã dịch vụ là bắt buộc.' }
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Mã dịch vụ không được vượt quá 50 ký tự.' }
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Mã dịch vụ chỉ được chứa chữ cái, chữ số, dấu gạch ngang (-) hoặc gạch dưới (_).',
    }
  }
  return { valid: true, value: trimmed.toUpperCase() }
}

/**
 * Validate service name (Tên dịch vụ)
 * Rules: Required, max 255 chars
 */
export function validateServiceName(name) {
  const trimmed = (name || '').toString().trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return { valid: false, error: 'Tên dịch vụ là bắt buộc.' }
  }
  if (trimmed.length > 255) {
    return { valid: false, error: 'Tên dịch vụ không được vượt quá 255 ký tự.' }
  }
  return { valid: true, value: trimmed }
}

/**
 * Validate service price (Đơn giá dịch vụ)
 * Rules: Required, numeric, >= 0
 */
export function validateServicePrice(price) {
  if (price === null || price === undefined || price === '') {
    return { valid: false, error: 'Đơn giá dịch vụ là bắt buộc.' }
  }
  const numeric = Number(price)
  if (Number.isNaN(numeric) || numeric < 0) {
    return { valid: false, error: 'Đơn giá dịch vụ phải là số lớn hơn hoặc bằng 0.' }
  }
  return { valid: true, value: numeric }
}

/**
 * Validate effective date (Ngày hiệu lực)
 * Rules: Required, valid date format YYYY-MM-DD
 */
export function validateEffectiveDate(effectiveFrom) {
  if (!effectiveFrom) {
    return { valid: false, error: 'Ngày bắt đầu hiệu lực là bắt buộc.' }
  }
  const parsed = dayjs(effectiveFrom)
  if (!parsed.isValid()) {
    return { valid: false, error: 'Ngày hiệu lực không đúng định dạng.' }
  }
  return { valid: true, value: parsed.format('YYYY-MM-DD') }
}

/**
 * Format currency to Vietnamese standard (xxx.xxx ₫)
 */
export function formatServiceCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '0 ₫'
  const numeric = Number(amount)
  if (Number.isNaN(numeric)) return '0 ₫'
  return `${numeric.toLocaleString('vi-VN')} ₫`
}

/**
 * Format date for table/card display (DD/MM/YYYY)
 */
export function formatDateDisplay(date) {
  if (!date) return '—'
  const parsed = dayjs(date)
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : '—'
}

/**
 * Format date time for display (DD/MM/YYYY HH:mm)
 */
export function formatDateTimeDisplay(date) {
  if (!date) return '—'
  const parsed = dayjs(date)
  return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : '—'
}

/**
 * Categorize price versions into CURRENT, UPCOMING, or EXPIRED
 * based on effectiveFrom and a reference date (default: today).
 */
export function categorizePriceHistory(prices = [], refDate = null) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return []
  }

  const todayStr = refDate
    ? dayjs(refDate).format('YYYY-MM-DD')
    : dayjs().format('YYYY-MM-DD')

  // Sort descending by effectiveFrom
  const sorted = [...prices].sort((a, b) => {
    const dateA = a.effectiveFrom || ''
    const dateB = b.effectiveFrom || ''
    return dateB.localeCompare(dateA)
  })

  // Find the first price that has effectiveFrom <= todayStr (this is the current active price)
  const currentIdx = sorted.findIndex((p) => (p.effectiveFrom || '') <= todayStr)

  return sorted.map((p, index) => {
    const isFuture = (p.effectiveFrom || '') > todayStr
    let status = 'EXPIRED'
    let statusLabel = 'Hết hiệu lực'
    let statusColor = 'default'

    if (isFuture) {
      status = 'UPCOMING'
      statusLabel = 'Sắp áp dụng'
      statusColor = 'processing'
    } else if (index === currentIdx) {
      status = 'CURRENT'
      statusLabel = 'Đang áp dụng'
      statusColor = 'success'
    }

    return {
      ...p,
      priceStatus: status,
      statusLabel,
      statusColor,
      formattedPrice: formatServiceCurrency(p.price),
      formattedEffectiveFrom: formatDateDisplay(p.effectiveFrom),
      formattedCreatedAt: formatDateTimeDisplay(p.createdAt),
    }
  })
}

export function suggestNextEffectiveDate(priceHistory = [], refDate = null) {
  const existingDates = new Set(
    (priceHistory || [])
      .map((p) => (p.effectiveFrom ? dayjs(p.effectiveFrom).format('YYYY-MM-DD') : null))
      .filter(Boolean)
  )

  let candidate = refDate ? dayjs(refDate) : dayjs()
  let attempts = 0
  while (existingDates.has(candidate.format('YYYY-MM-DD')) && attempts < 365) {
    candidate = candidate.add(1, 'day')
    attempts++
  }
  return candidate.format('YYYY-MM-DD')
}

export function isEffectiveDateConflicted(date, priceHistory = [], newPrice = null, originalPrice = null) {
  if (!date) return { conflicted: false }
  const formattedDate = dayjs(date).isValid() ? dayjs(date).format('YYYY-MM-DD') : String(date)

  if (
    newPrice !== null &&
    originalPrice !== null &&
    Number(newPrice) === Number(originalPrice)
  ) {
    return { conflicted: false }
  }

  const existing = (priceHistory || []).find((p) => {
    const pDate = p.effectiveFrom ? dayjs(p.effectiveFrom).format('YYYY-MM-DD') : ''
    return pDate === formattedDate
  })

  if (!existing) {
    return { conflicted: false }
  }

  if (newPrice !== null && Number(existing.price) === Number(newPrice)) {
    return { conflicted: false }
  }

  return {
    conflicted: true,
    existingPrice: existing.price,
    date: formattedDate,
    message: `Đã tồn tại mức giá (${formatServiceCurrency(existing.price)}) cho ngày ${formatDateDisplay(formattedDate)}. Vui lòng chọn ngày hiệu lực mới.`,
  }
}

/**
 * Prepares and validates payload for Create Service (POST /system/services)
 */
export function prepareCreateServicePayload(values = {}) {
  const codeRes = validateServiceCode(values.serviceCode)
  if (!codeRes.valid) throw new Error(codeRes.error)

  const nameRes = validateServiceName(values.name)
  if (!nameRes.valid) throw new Error(nameRes.error)

  const priceRes = validateServicePrice(values.price)
  if (!priceRes.valid) throw new Error(priceRes.error)

  const dateRes = validateEffectiveDate(values.effectiveFrom)
  if (!dateRes.valid) throw new Error(dateRes.error)

  return {
    serviceCode: codeRes.value,
    name: nameRes.value,
    price: priceRes.value,
    effectiveFrom: dateRes.value,
  }
}

/**
 * Prepares and validates payload for Update Service (PUT /system/services/{id})
 */
export function prepareUpdateServicePayload(values = {}) {
  const nameRes = validateServiceName(values.name)
  if (!nameRes.valid) throw new Error(nameRes.error)

  const priceRes = validateServicePrice(values.price)
  if (!priceRes.valid) throw new Error(priceRes.error)

  const dateRes = validateEffectiveDate(values.effectiveFrom)
  if (!dateRes.valid) throw new Error(dateRes.error)

  return {
    name: nameRes.value,
    active: Boolean(values.active),
    price: priceRes.value,
    effectiveFrom: dateRes.value,
  }
}

export const SERVICE_ERROR_TRANSLATIONS = {
  'Service code is required.': 'Vui lòng nhập mã dịch vụ.',
  'Service code must not exceed 50 characters.': 'Mã dịch vụ không được vượt quá 50 ký tự.',
  'Service name is required.': 'Vui lòng nhập tên dịch vụ.',
  'Service name must not exceed 255 characters.': 'Tên dịch vụ không được vượt quá 255 ký tự.',
  'Service price is required.': 'Vui lòng nhập đơn giá dịch vụ.',
  'Service price must be greater than or equal to 0.': 'Đơn giá phải lớn hơn hoặc bằng 0.',
  'Price effective date is required.': 'Vui lòng chọn ngày hiệu lực của mức giá.',
  'Service active status is required.': 'Vui lòng chọn trạng thái áp dụng.',
  'Service code already exists.': 'Mã dịch vụ đã tồn tại trong hệ thống.',
  'Service name already exists.': 'Tên dịch vụ đã tồn tại trong hệ thống.',
  'A different service price already exists for this effective date.': 'Đã tồn tại mức giá khác cho ngày hiệu lực này.',
  'A service price already exists for this effective date.': 'Đã tồn tại mức giá cho ngày hiệu lực này.',
  'Service catalog data conflicts with an existing record.': 'Dữ liệu dịch vụ bị xung đột với bản ghi hiện có.',
  'Create service catalog command is required.': 'Dữ liệu tạo dịch vụ không hợp lệ.',
  'Update service catalog command is required.': 'Dữ liệu cập nhật dịch vụ không hợp lệ.',
  'Access denied.': 'Bạn không có quyền thực hiện thao tác này.',
}

/**
 * Translates raw error messages from backend or client validation.
 */
export function translateRawMessage(msg) {
  if (!msg || typeof msg !== 'string') return ''
  if (SERVICE_ERROR_TRANSLATIONS[msg]) {
    return SERVICE_ERROR_TRANSLATIONS[msg]
  }
  const lower = msg.toLowerCase()
  if (lower.includes('service code already exists') || lower.includes('uk_service_catalog_code')) {
    return 'Mã dịch vụ đã tồn tại trong hệ thống.'
  }
  if (lower.includes('service name already exists') || lower.includes('tên dịch vụ đã tồn tại')) {
    return 'Tên dịch vụ đã tồn tại trong hệ thống.'
  }
  if (lower.includes('price must be greater than or equal to 0') || lower.includes('lớn hơn hoặc bằng 0') || lower.includes('không được là số âm') || lower.includes('số âm')) {
    return 'Đơn giá phải lớn hơn hoặc bằng 0.'
  }
  if (lower.includes('price already exists') || (lower.includes('effective') && lower.includes('date'))) {
    return 'Đã tồn tại mức giá cho ngày hiệu lực này.'
  }
  if (lower.includes('not found')) {
    return 'Không tìm thấy thông tin dịch vụ trong hệ thống.'
  }
  return msg
}

function mapMessageToFieldErrors(msg) {
  if (!msg) return []
  const lower = msg.toLowerCase()
  if (msg.includes('Mã dịch vụ') || lower.includes('service code')) {
    return [{ name: 'serviceCode', errors: [msg] }]
  }
  if (msg.includes('Tên dịch vụ') || lower.includes('service name')) {
    return [{ name: 'name', errors: [msg] }]
  }
  if (msg.includes('Giá dịch vụ') || msg.includes('Đơn giá') || lower.includes('price')) {
    return [{ name: 'price', errors: [msg] }]
  }
  if (msg.includes('ngày hiệu lực') || msg.includes('Ngày bắt đầu') || lower.includes('effective')) {
    return [{ name: 'effectiveFrom', errors: [msg] }]
  }
  return []
}

/**
 * Extracts in-form error alert message and field-specific errors
 * formatted for Ant Design form.setFields([{ name, errors: [...] }]).
 */
export function extractServiceFormErrors(error) {
  if (!error) {
    return { errorMessage: '', fieldErrors: [] }
  }

  // If string
  if (typeof error === 'string') {
    const translated = translateRawMessage(error)
    const fieldErrors = mapMessageToFieldErrors(translated)
    return { errorMessage: translated, fieldErrors }
  }

  // If Error instance without response (Client-side validation error)
  if (error instanceof Error && !error.response) {
    const translated = translateRawMessage(error.message)
    const fieldErrors = mapMessageToFieldErrors(translated)
    return { errorMessage: translated, fieldErrors }
  }

  const apiError = normalizeApiError(error)
  let generalMessage = ''
  let generalDescription = ''
  const fieldErrorsMap = {}

  if (apiError.code === 'ACCESS_DENIED' || apiError.status === 403) {
    return {
      errorMessage: 'Bạn không có quyền thực hiện thao tác này.',
      description: 'Thao tác tạo hoặc chỉnh sửa danh mục dịch vụ kỹ thuật yêu cầu tài khoản Quản trị viên (Admin) hoặc Quản lý phòng khám (Manager).',
      fieldErrors: [],
    }
  }

  if (apiError.code === 'AUTHENTICATION_FAILED' || apiError.status === 401) {
    return {
      errorMessage: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      description: 'Vui lòng đăng nhập lại để làm mới phiên làm việc và tiếp tục thao tác.',
      fieldErrors: [],
    }
  }

  if (apiError.code === 'RESOURCE_NOT_FOUND' || apiError.status === 404) {
    return {
      errorMessage: 'Không tìm thấy thông tin dịch vụ trong hệ thống.',
      description: 'Dịch vụ không tồn tại trên hệ thống hoặc đã bị xóa (Lỗi 404). Vui lòng tải lại danh sách dịch vụ.',
      fieldErrors: [],
    }
  }

  // Map field level errors from backend
  if (apiError.fields && typeof apiError.fields === 'object') {
    Object.entries(apiError.fields).forEach(([fieldName, rawMsg]) => {
      const translated = translateRawMessage(rawMsg)
      fieldErrorsMap[fieldName] = translated
    })
  }

  // Check domain/root error message
  const rootMsg = translateRawMessage(apiError.message)
  const isGenericValidation =
    !rootMsg ||
    rootMsg.toLowerCase().includes('validation failed') ||
    rootMsg.toLowerCase().includes('dữ liệu không hợp lệ')

  if (Object.keys(fieldErrorsMap).length > 0) {
    generalMessage = Object.values(fieldErrorsMap)[0]
  } else if (!isGenericValidation && rootMsg) {
    generalMessage = rootMsg
  }

  if (rootMsg && !isGenericValidation) {
    const rootLower = rootMsg.toLowerCase()
    if ((rootMsg.includes('Mã dịch vụ') || rootLower.includes('service code')) && !fieldErrorsMap.serviceCode) {
      fieldErrorsMap.serviceCode = rootMsg
      generalDescription = 'Vui lòng kiểm tra lại mã dịch vụ hoặc đặt một mã khác để phân biệt.'
    }
    if ((rootMsg.includes('Tên dịch vụ') || rootLower.includes('service name')) && !fieldErrorsMap.name) {
      fieldErrorsMap.name = rootMsg
      generalDescription = 'Vui lòng đặt tên phân biệt với các dịch vụ kỹ thuật hiện có.'
    }
    if ((rootMsg.includes('mức giá') || rootMsg.includes('ngày hiệu lực') || rootLower.includes('effective date')) && !fieldErrorsMap.effectiveFrom) {
      fieldErrorsMap.effectiveFrom = rootMsg
      generalDescription = 'Vui lòng chọn ngày hiệu lực khác hoặc nhấn nút Gợi ý ngày áp dụng.'
    }
    if ((rootMsg.includes('Giá') || rootMsg.includes('Đơn giá') || rootLower.includes('service price')) && !rootMsg.includes('ngày hiệu lực') && !fieldErrorsMap.price) {
      fieldErrorsMap.price = rootMsg
    }
  }

  const fieldErrors = Object.entries(fieldErrorsMap).map(([name, err]) => ({
    name,
    errors: [err],
  }))

  if (!generalMessage) {
    generalMessage = apiError.firstFieldError
      ? translateRawMessage(apiError.firstFieldError)
      : 'Thao tác không thành công. Vui lòng kiểm tra lại thông tin nhập vào.'
  }

  return {
    errorMessage: generalMessage,
    description: generalDescription,
    fieldErrors,
  }
}

/**
 * Translates backend errors using stable response codes into Vietnamese.
 */
export function translateServiceErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định.'
  const { errorMessage } = extractServiceFormErrors(error)
  return errorMessage || 'Đã xảy ra lỗi không xác định.'
}
