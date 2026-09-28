/**
 * prescriptionReconciliationHelpers.js
 * 
 * Helper functions for NCL-12-CN-007 (Đối chiếu đơn đã liên thông với đơn đã cấp phát / QTN-21).
 * Maps the 5-state reconciliation matrix, validates notes, and verifies authorization.
 */

export const RECONCILIATION_OUTCOMES = {
  CONSISTENT: 'CONSISTENT',
  TRANSMITTED_NOT_DISPENSED: 'TRANSMITTED_NOT_DISPENSED',
  DISPENSED_NOT_TRANSMITTED: 'DISPENSED_NOT_TRANSMITTED',
  NOT_TRANSMITTED_NOT_DISPENSED: 'NOT_TRANSMITTED_NOT_DISPENSED',
  CANCELLED: 'CANCELLED',
}

export const OUTCOME_CONFIG = {
  CONSISTENT: {
    key: 'CONSISTENT',
    label: 'Đồng bộ (Khớp)',
    color: '#16a34a',
    antdColor: 'success',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    description: 'Đã liên thông thành công và đã cấp phát thuốc đầy đủ',
    isDiscrepancy: false,
  },
  TRANSMITTED_NOT_DISPENSED: {
    key: 'TRANSMITTED_NOT_DISPENSED',
    label: 'Đã liên thông - Chưa cấp phát',
    color: '#d97706',
    antdColor: 'warning',
    bg: '#fffbeb',
    border: '#fde68a',
    description: 'Đã gửi liên thông nhưng nhà thuốc chưa cấp phát thuốc',
    isDiscrepancy: true,
  },
  DISPENSED_NOT_TRANSMITTED: {
    key: 'DISPENSED_NOT_TRANSMITTED',
    label: 'Đã cấp phát - Chưa liên thông',
    color: '#dc2626',
    antdColor: 'error',
    bg: '#fef2f2',
    border: '#fca5a5',
    description: 'Thuốc đã xuất kho nhưng chưa gửi hoặc gửi liên thông thất bại (Nghiêm trọng)',
    isDiscrepancy: true,
  },
  NOT_TRANSMITTED_NOT_DISPENSED: {
    key: 'NOT_TRANSMITTED_NOT_DISPENSED',
    label: 'Chưa liên thông - Chưa cấp phát',
    color: '#475569',
    antdColor: 'default',
    bg: '#f8fafc',
    border: '#cbd5e1',
    description: 'Đơn mới kê, đang trong quy trình chờ xử lý',
    isDiscrepancy: false,
  },
  CANCELLED: {
    key: 'CANCELLED',
    label: 'Đơn thuốc đã hủy',
    color: '#94a3b8',
    antdColor: 'default',
    bg: '#f1f5f9',
    border: '#e2e8f0',
    description: 'Đơn thuốc đã bị hủy, không thuộc phạm vi xử lý lệch',
    isDiscrepancy: false,
  },
}

/**
 * Returns tag configuration and metadata for a given reconciliation outcome.
 * 
 * @param {string} outcome 
 * @returns {Object} Outcome config
 */
export function getOutcomeTag(outcome) {
  const norm = String(outcome || '').toUpperCase()
  return (
    OUTCOME_CONFIG[norm] || {
      key: norm || 'UNKNOWN',
      label: outcome || 'Không xác định',
      color: '#64748b',
      antdColor: 'default',
      bg: '#f8fafc',
      border: '#cbd5e1',
      description: 'Chưa xác định trạng thái',
      isDiscrepancy: false,
    }
  )
}

/**
 * Validates reconciliation note/reason text.
 * - Required (non-empty, non-whitespace)
 * - Maximum 500 characters
 * 
 * @param {string} note 
 * @returns {{ valid: boolean, error?: string, trimmed?: string }}
 */
export function validateNote(note) {
  if (note === null || note === undefined) {
    return { valid: false, error: 'Vui lòng nhập lý do/ghi chú giải trình.' }
  }
  const trimmed = String(note).trim()
  if (!trimmed) {
    return { valid: false, error: 'Vui lòng nhập lý do/ghi chú giải trình.' }
  }
  if (trimmed.length > 500) {
    return {
      valid: false,
      error: `Lý do giải trình không được vượt quá 500 ký tự (hiện có ${trimmed.length} ký tự).`,
    }
  }
  return { valid: true, trimmed }
}

/**
 * Determines whether the "Thêm ghi chú" button should be displayed.
 * Permitted only when the prescription is actively discrepant AND not cancelled.
 * 
 * @param {Object} item 
 * @returns {boolean}
 */
export function canAddNote(item) {
  if (!item || typeof item !== 'object') return false
  if (item.prescriptionStatus === 'CANCELLED') return false
  return Boolean(item.discrepancy === true)
}

/**
 * Determines whether the "Gửi lại liên thông" button should be displayed and actionable.
 * 
 * STRICT RULES:
 * 1. Must rely DIRECTLY on item.retransmissionEligible === true (computed server-side from FAILED).
 *    Never re-derive from outcome because DISPENSED_NOT_TRANSMITTED has two branches (FAILED vs NOT_SENT).
 * 2. User must possess ADMIN role (pharmacist cannot retry per NCL-12-CN-004 authorization lock).
 * 
 * @param {Object} item
 * @param {string|Array<string>|Object} currentUserRole
 * @returns {boolean}
 */
export function canRetryInterconnection(item, currentUserRole) {
  if (!item || typeof item !== 'object') return false
  if (item.retransmissionEligible !== true) return false

  let roles = []
  if (typeof currentUserRole === 'string') {
    roles = [currentUserRole]
  } else if (Array.isArray(currentUserRole)) {
    roles = currentUserRole
  } else if (currentUserRole && typeof currentUserRole === 'object') {
    roles = Array.isArray(currentUserRole.roles)
      ? currentUserRole.roles
      : [currentUserRole.role]
  }

  const normalized = roles.map((r) =>
    String(r || '')
      .toUpperCase()
      .replace(/^ROLE_/, '')
  )

  return normalized.includes('ADMIN')
}

/**
 * UI Tag metadata for prescription dispensing status.
 */
export const PRESCRIPTION_STATUS_CONFIG = {
  PENDING_DISPENSE: { label: 'Chờ cấp phát', color: 'orange', text: '#d97706' },
  PARTIALLY_DISPENSED: { label: 'Cấp phát một phần', color: 'blue', text: '#2563eb' },
  DISPENSED: { label: 'Đã cấp phát', color: 'green', text: '#16a34a' },
  CANCELLED: { label: 'Đã hủy', color: 'default', text: '#64748b' },
}

export function getPrescriptionStatusTag(status) {
  const norm = String(status || '').toUpperCase()
  return (
    PRESCRIPTION_STATUS_CONFIG[norm] || {
      label: status || '---',
      color: 'default',
      text: '#64748b',
    }
  )
}

/**
 * UI Tag metadata for national interconnection transmission status.
 */
export const INTERCONNECTION_STATUS_CONFIG = {
  NOT_SENT: { label: 'Chưa gửi', color: 'default', text: '#64748b' },
  SUCCESS: { label: 'Thành công', color: 'success', text: '#16a34a' },
  FAILED: { label: 'Thất bại', color: 'error', text: '#dc2626' },
}

export function getInterconnectionStatusTag(status) {
  const norm = String(status || '').toUpperCase()
  return (
    INTERCONNECTION_STATUS_CONFIG[norm] || {
      label: status || '---',
      color: 'default',
      text: '#64748b',
    }
  )
}
