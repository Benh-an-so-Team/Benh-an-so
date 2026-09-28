/**
 * Validation & helper utilities for checking maximum daily dose (NCL-05-CN-007 / QTN-35, QTN-20)
 * Backend Integration: CheckMaxDailyDoseService.java, CreatePrescriptionService.java
 */

export const PRESET_MAX_DOSE_OVERRIDE_REASONS = [
  'Bệnh nhân có chỉ định điều trị liều tấn công trong giai đoạn cấp',
  'Đã hội chẩn chuyên khoa, theo dõi sát các thông số sinh hiệu và chức năng tạng',
  'Tình trạng bệnh nặng, đáp ứng kém với mức liều thông thường',
  'Chỉ định ngắn ngày theo phác đồ điều trị chuyên biệt đã được phê duyệt',
]

/**
 * Format a number for clean clinical display (e.g. 4000, 2.5, 0.5 without float inaccuracies).
 * @param {number|string} val
 * @returns {string}
 */
export function formatDoseNumber(val) {
  if (val === null || val === undefined || isNaN(Number(val))) return '0'
  const num = Number(val)
  // Fix potential floating point inaccuracies (e.g. 0.30000000000000004 -> 0.3)
  const rounded = Math.round(num * 10000) / 10000
  return rounded.toString()
}

/**
 * Validate that an override reason is non-empty and does not exceed 500 characters.
 * @param {string} reason
 * @returns {{ valid: boolean, error: string, trimmedReason: string }}
 */
export function validateOverrideReason(reason) {
  if (typeof reason !== 'string') {
    return {
      valid: false,
      error: 'Vui lòng nhập lý do giải trình kê vượt liều tối đa (không được để trống).',
      trimmedReason: '',
    }
  }

  const trimmed = reason.trim()
  if (!trimmed) {
    return {
      valid: false,
      error: 'Vui lòng nhập lý do giải trình kê vượt liều tối đa (không được để trống).',
      trimmedReason: '',
    }
  }

  if (trimmed.length > 500) {
    return {
      valid: false,
      error: 'Lý do giải trình kê vượt liều tối đa không được vượt quá 500 ký tự.',
      trimmedReason: trimmed,
    }
  }

  return {
    valid: true,
    error: '',
    trimmedReason: trimmed,
  }
}

/**
 * Format warning message for dose exceedance.
 * Format requirement: "Hoạt chất [tên]: tổng liều [X]mg/ngày vượt ngưỡng tối đa [Y]mg/ngày (vượt [X-Y]mg)."
 * @param {Object} warning
 * @param {string} warning.activeIngredient
 * @param {number|string} warning.totalDailyDoseMg
 * @param {number|string} warning.maxDailyDoseMg
 * @returns {string}
 */
export function formatDoseWarningMessage(warning) {
  if (!warning) return ''
  const ingredient = warning.activeIngredient || 'Không xác định'
  const total = Number(warning.totalDailyDoseMg) || 0
  const max = Number(warning.maxDailyDoseMg) || 0
  const diff = Math.max(0, total - max)

  return `Hoạt chất ${ingredient}: tổng liều ${formatDoseNumber(total)}mg/ngày vượt ngưỡng tối đa ${formatDoseNumber(max)}mg/ngày (vượt ${formatDoseNumber(diff)}mg).`
}

/**
 * Get reason string for an active ingredient from reasonInputMap (handles both Object and Map).
 * @param {Object|Map} reasonInputMap
 * @param {string} activeIngredient
 * @returns {string}
 */
function getReasonForIngredient(reasonInputMap, activeIngredient) {
  if (!reasonInputMap || !activeIngredient) return ''
  if (reasonInputMap instanceof Map) {
    return reasonInputMap.get(activeIngredient) || ''
  }
  return reasonInputMap[activeIngredient] || ''
}

/**
 * Check if there is ANY warning that lacks a valid override reason.
 * Used to disable the "Lưu đơn thuốc" button before submitting to backend.
 * @param {Array<Object>} warnings
 * @param {Object|Map} reasonInputMap
 * @returns {boolean} true if at least one warning has an invalid/missing reason
 */
export function hasUnresolvedWarnings(warnings = [], reasonInputMap = {}) {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return false
  }

  return warnings.some((warning) => {
    const ingredient = warning?.activeIngredient
    if (!ingredient) return true
    const reason = getReasonForIngredient(reasonInputMap, ingredient)
    const validation = validateOverrideReason(reason)
    return !validation.valid
  })
}

/**
 * Build payload array of maxDailyDoseOverrides for Backend CreatePrescriptionRequest / AmendPrescriptionRequest.
 * Format: [ { activeIngredient: string, overrideReason: string } ]
 * @param {Array<Object>} warnings
 * @param {Object|Map} reasonInputMap
 * @returns {Array<{ activeIngredient: string, overrideReason: string }>}
 */
export function buildOverridesPayload(warnings = [], reasonInputMap = {}) {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return []
  }

  const seenIngredients = new Set()
  const overrides = []

  for (const warning of warnings) {
    const ingredient = warning?.activeIngredient
    if (!ingredient) continue

    const normalizedKey = ingredient.trim().toLowerCase()
    if (seenIngredients.has(normalizedKey)) continue

    const reason = getReasonForIngredient(reasonInputMap, ingredient)
    const validation = validateOverrideReason(reason)

    if (validation.valid) {
      seenIngredients.add(normalizedKey)
      overrides.push({
        activeIngredient: ingredient.trim(),
        overrideReason: validation.trimmedReason,
      })
    }
  }

  return overrides
}

/**
 * Extract single dose numeric quantity from a dosage string or explicit value.
 * Handles fractions like "1/2", decimals like "1.5", and texts like "2 viên".
 * @param {string|number} dosage
 * @param {number} fallback
 * @returns {number}
 */
export function parseSingleDoseQuantity(dosage, fallback = 1) {
  if (typeof dosage === 'number' && !isNaN(dosage) && dosage > 0) {
    return dosage
  }
  if (!dosage || typeof dosage !== 'string') {
    return fallback
  }

  const trimmed = dosage.trim().replace(',', '.')

  // Check fraction like "1/2" or "3/4"
  const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)/)
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1])
    const denominator = parseFloat(fractionMatch[2])
    if (denominator > 0) {
      return numerator / denominator
    }
  }

  // Check decimal or integer number at start of string
  const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)/)
  if (numMatch) {
    const parsed = parseFloat(numMatch[1])
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

/**
 * Calculate recommended total quantity for a prescription item.
 * Formula: doseQuantityPerTake × frequencyPerDay × durationDays
 * Handles text dosages like "8 viên", fractions like "1/2 viên", and direct singleDoseQuantity values.
 * @param {Object} item - Prescription item containing dosage/singleDoseQuantity, frequency, durationDays
 * @returns {number}
 */
export function calculateAutoQuantity(item) {
  if (!item) return 0
  const doseInput = item.singleDoseQuantity ?? item.dosage ?? item.singleDose ?? ''
  const doseQty = parseSingleDoseQuantity(doseInput, 1)
  const freq = Number(item.frequency) || 0
  const days = Number(item.durationDays) || 0
  const total = doseQty * freq * days
  return Number.isInteger(total) ? total : Math.ceil(total)
}
