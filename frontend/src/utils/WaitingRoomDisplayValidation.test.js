import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDisplayTime,
  formatCalledAtTime,
  getPriorityBadge,
  sanitizeDisplayItem,
  getRoomStatusCode,
  getRoomStatusLabel,
  parseRoomIdParam,
} from './waitingRoomDisplayHelpers.js'

test('1. formatDisplayTime handles valid dates, ISO strings, null, and invalid values safely', () => {
  assert.equal(formatDisplayTime(null), '--:--:--')
  assert.equal(formatDisplayTime(undefined), '--:--:--')
  assert.equal(formatDisplayTime('invalid-date'), '--:--:--')

  const fixed = new Date(2026, 8, 26, 14, 30, 45)
  assert.equal(formatDisplayTime(fixed), '14:30:45')
})

test('2. formatCalledAtTime formats HH:mm cleanly and returns empty for null/invalid', () => {
  assert.equal(formatCalledAtTime(null), '')
  assert.equal(formatCalledAtTime(undefined), '')
  assert.equal(formatCalledAtTime('invalid'), '')

  const fixed = new Date(2026, 8, 26, 8, 5, 0)
  assert.equal(formatCalledAtTime(fixed), '08:05')
})

test('3. getPriorityBadge returns proper metadata for EMERGENCY, PRIORITY, and NORMAL', () => {
  const em = getPriorityBadge('EMERGENCY')
  assert.equal(em.label, 'CẤP CỨU')
  assert.equal(em.isEmergency, true)
  assert.equal(em.color, '#dc2626')

  const pri = getPriorityBadge('PRIORITY')
  assert.equal(pri.label, 'ƯU TIÊN')
  assert.equal(pri.isEmergency, false)
  assert.equal(pri.color, '#d97706')

  const norm = getPriorityBadge('NORMAL')
  assert.equal(norm.label, 'THƯỜNG')
  assert.equal(norm.isEmergency, false)

  const def = getPriorityBadge(null)
  assert.equal(def.label, 'THƯỜNG')
})

test('4. sanitizeDisplayItem strictly strips any sensitive fields (QTN-43 / TC-02)', () => {
  const rawItemWithLeaks = {
    id: '770e8400-e29b-41d4-a716-446655440222',
    queueNumber: 12,
    patientInitials: 'N. V. A',
    status: 'IN_PROGRESS',
    priority: 'NORMAL',
    calledAt: '2026-09-24T08:25:00Z',
    // Sensitive fields that must NOT leak into sanitized output:
    patientId: 'secret-patient-id',
    fullName: 'Nguyễn Văn An',
    phoneNumber: '0901234567',
    idCardNumber: '123456789012',
    address: '123 Đường ABC',
  }

  const sanitized = sanitizeDisplayItem(rawItemWithLeaks)
  assert.ok(sanitized)
  assert.equal(sanitized.id, '770e8400-e29b-41d4-a716-446655440222')
  assert.equal(sanitized.queueNumber, 12)
  assert.equal(sanitized.patientInitials, 'N. V. A')
  assert.equal(sanitized.status, 'IN_PROGRESS')
  assert.equal(sanitized.priority, 'NORMAL')

  // Verify sensitive fields are strictly excluded
  assert.equal('patientId' in sanitized, false)
  assert.equal('fullName' in sanitized, false)
  assert.equal('phoneNumber' in sanitized, false)
  assert.equal('idCardNumber' in sanitized, false)
  assert.equal('address' in sanitized, false)
})

test('5. Room status handles calling, waiting_next, and ready states without crashing', () => {
  const callingItem = { queueNumber: 1, patientInitials: 'A. B. C' }
  const waitingItem = { queueNumber: 2, patientInitials: 'X. Y. Z' }

  // 1. Room is actively calling
  assert.equal(getRoomStatusCode(callingItem, [waitingItem]), 'CALLING')
  assert.equal(getRoomStatusLabel(callingItem, [waitingItem]), 'Đang gọi khám')

  // 2. Room has no calling patient, but has waiting patients
  assert.equal(getRoomStatusCode(null, [waitingItem]), 'WAITING_NEXT')
  assert.equal(getRoomStatusLabel(null, [waitingItem]), 'Chờ lượt tiếp theo')

  // 3. Room is completely empty (currentCalling = null, waitingList = [])
  assert.equal(getRoomStatusCode(null, []), 'READY')
  assert.equal(getRoomStatusLabel(null, []), 'Sẵn sàng đón bệnh nhân')
  assert.equal(getRoomStatusCode(null, null), 'READY')
  assert.equal(getRoomStatusLabel(null, null), 'Sẵn sàng đón bệnh nhân')
})

test('6. parseRoomIdParam extracts UUID from search string or returns null', () => {
  assert.equal(parseRoomIdParam('?roomId=e3b0c442-98fc-1c14-9af0-2a3c4d5e6f01'), 'e3b0c442-98fc-1c14-9af0-2a3c4d5e6f01')
  assert.equal(parseRoomIdParam('?foo=bar&roomId=12345'), '12345')
  assert.equal(parseRoomIdParam('?foo=bar'), null)
  assert.equal(parseRoomIdParam(''), null)
  assert.equal(parseRoomIdParam(null), null)
})

test('7. waitingList preservation: UI must maintain backend priority order without re-sorting', () => {
  const backendList = [
    { queueNumber: 15, patientInitials: 'L. C. C', priority: 'EMERGENCY' },
    { queueNumber: 14, patientInitials: 'P. Ư. T', priority: 'PRIORITY' },
    { queueNumber: 13, patientInitials: 'T. T. B', priority: 'NORMAL' },
  ]

  // Clone and verify order is unchanged
  const displayedList = backendList.map(sanitizeDisplayItem)
  assert.equal(displayedList[0].priority, 'EMERGENCY')
  assert.equal(displayedList[0].queueNumber, 15)
  assert.equal(displayedList[1].priority, 'PRIORITY')
  assert.equal(displayedList[1].queueNumber, 14)
  assert.equal(displayedList[2].priority, 'NORMAL')
  assert.equal(displayedList[2].queueNumber, 13)
})
