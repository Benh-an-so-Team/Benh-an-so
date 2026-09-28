/**
 * waitingRoomDisplayHelpers.js
 * 
 * Helper functions for Public Waiting Room Display Board (NCL-03-CN-014 / QTN-43 / QTN-03).
 * Ensures privacy compliance, safe formatting, and clean status representations.
 */

/**
 * Formats ISO date-time string to local time string (HH:mm:ss).
 * 
 * @param {string|Date|null|undefined} timeVal 
 * @param {string} fallback 
 * @returns {string} Formatted time string
 */
export function formatDisplayTime(timeVal, fallback = '--:--:--') {
  if (!timeVal) return fallback
  try {
    const d = new Date(timeVal)
    if (isNaN(d.getTime())) return fallback
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  } catch {
    return fallback
  }
}

/**
 * Formats calledAt timestamp to concise hour:minute (HH:mm).
 * 
 * @param {string|Date|null|undefined} timeVal 
 * @returns {string} Formatted HH:mm or empty string
 */
export function formatCalledAtTime(timeVal) {
  if (!timeVal) return ''
  try {
    const d = new Date(timeVal)
    if (isNaN(d.getTime())) return ''
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  } catch {
    return ''
  }
}

/**
 * Returns UI badge styling and metadata according to queue item priority.
 * 
 * @param {'EMERGENCY'|'PRIORITY'|'NORMAL'|string} priority 
 * @returns {{ label: string, color: string, bg: string, border: string, isEmergency: boolean }}
 */
export function getPriorityBadge(priority) {
  const norm = String(priority || 'NORMAL').toUpperCase()
  switch (norm) {
    case 'EMERGENCY':
      return {
        label: 'CẤP CỨU',
        color: '#dc2626',
        bg: '#fef2f2',
        border: '#f87171',
        isEmergency: true,
      }
    case 'PRIORITY':
      return {
        label: 'ƯU TIÊN',
        color: '#d97706',
        bg: '#fffbeb',
        border: '#fde68a',
        isEmergency: false,
      }
    case 'NORMAL':
    default:
      return {
        label: 'THƯỜNG',
        color: '#475569',
        bg: '#f8fafc',
        border: '#cbd5e1',
        isEmergency: false,
      }
  }
}

/**
 * Sanitize queue display item to enforce QTN-43 / TC-02 privacy rules.
 * Strictly guarantees NO sensitive identity field (patientId, phone, address, etc.) is retained.
 * 
 * @param {Object} item 
 * @returns {Object|null} Sanitized item
 */
export function sanitizeDisplayItem(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id || null,
    queueNumber: Number(item.queueNumber) || 0,
    patientInitials: String(item.patientInitials || '').trim(),
    status: item.status || 'WAITING',
    priority: item.priority || 'NORMAL',
    calledAt: item.calledAt || null,
  }
}

/**
 * Evaluates room status text based on currentCalling and waitingList.
 * 
 * @param {Object|null} currentCalling 
 * @param {Array} waitingList 
 * @returns {'CALLING'|'WAITING_NEXT'|'READY'}
 */
export function getRoomStatusCode(currentCalling, waitingList = []) {
  if (currentCalling) return 'CALLING'
  if (Array.isArray(waitingList) && waitingList.length > 0) return 'WAITING_NEXT'
  return 'READY'
}

/**
 * Human-readable room status in Vietnamese.
 * 
 * @param {Object|null} currentCalling 
 * @param {Array} waitingList 
 * @returns {string} Status label
 */
export function getRoomStatusLabel(currentCalling, waitingList = []) {
  const code = getRoomStatusCode(currentCalling, waitingList)
  switch (code) {
    case 'CALLING':
      return 'Đang gọi khám'
    case 'WAITING_NEXT':
      return 'Chờ lượt tiếp theo'
    case 'READY':
    default:
      return 'Sẵn sàng đón bệnh nhân'
  }
}

/**
 * Parses optional roomId filter from URL search string.
 * 
 * @param {string} searchString (e.g. "?roomId=abcd-1234")
 * @returns {string|null} roomId or null
 */
export function parseRoomIdParam(searchString = '') {
  if (!searchString) return null
  try {
    const params = new URLSearchParams(searchString)
    const roomId = params.get('roomId')
    return roomId && roomId.trim() ? roomId.trim() : null
  } catch {
    return null
  }
}
