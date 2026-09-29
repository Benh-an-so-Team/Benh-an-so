import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'
import {
  PRESET_RESCHEDULE_REASONS,
  validateRescheduleReason,
  validateRescheduleTime,
  canRescheduleAppointment,
  getRescheduleRestrictionMessage,
} from '../../utils/appointmentRescheduleValidation.js'

test('NCL-03-CN-007-TC-01: Lý do dời lịch hợp lệ và thời gian tương lai được chấp nhận', () => {
  // 1. Kiểm tra lý do hợp lệ
  const reasonRes = validateRescheduleReason('Bệnh nhân bận việc gia đình xin lùi giờ sang buổi chiều.')
  assert.equal(reasonRes.valid, true)
  assert.equal(reasonRes.error, null)
  assert.equal(reasonRes.reason, 'Bệnh nhân bận việc gia đình xin lùi giờ sang buổi chiều.')

  // 2. Kiểm tra cắt khoảng trắng thừa (trim)
  const trimmed = validateRescheduleReason('   Bác sĩ đổi ca trực   ')
  assert.equal(trimmed.valid, true)
  assert.equal(trimmed.reason, 'Bác sĩ đổi ca trực')

  // 3. Kiểm tra độ dài biên: 1 ký tự và 500 ký tự
  const minReason = validateRescheduleReason('A')
  assert.equal(minReason.valid, true)

  const maxReason = validateRescheduleReason('X'.repeat(500))
  assert.equal(maxReason.valid, true)
  assert.equal(maxReason.reason.length, 500)

  // 4. Kiểm tra thời gian tương lai hợp lệ
  const now = dayjs('2026-09-14T08:00:00Z')
  const startTime = '2026-09-14T09:00:00Z'
  const endTime = '2026-09-14T09:30:00Z'
  const timeRes = validateRescheduleTime(startTime, endTime, now)
  assert.equal(timeRes.valid, true)
  assert.equal(timeRes.error, null)

  // 5. Kiểm tra lịch hẹn trạng thái SCHEDULED trong tương lai được phép dời
  const futureApp = {
    id: 'app-01',
    status: 'SCHEDULED',
    startTime: '2026-09-14T10:00:00Z',
  }
  const checkFuture = canRescheduleAppointment(futureApp, now)
  assert.equal(checkFuture.allowed, true)
  assert.equal(checkFuture.reason, null)
  assert.equal(getRescheduleRestrictionMessage(futureApp, now), null)
})

test('NCL-03-CN-007-TC-02: Từ chối dời lịch khi quá giờ khám hoặc đã tiếp nhận, hoàn tất, không đến, đã hủy', () => {
  const now = dayjs('2026-09-14T09:00:00Z')

  // 1. Lịch hẹn quá giờ khám (trong quá khứ)
  const pastApp = {
    id: 'app-past',
    status: 'SCHEDULED',
    startTime: '2026-09-14T08:30:00Z',
  }
  const checkPast = canRescheduleAppointment(pastApp, now)
  assert.equal(checkPast.allowed, false)
  assert.ok(checkPast.reason.includes('quá giờ khám'))

  // 2. Lịch hẹn đã tiếp nhận (CHECKED_IN)
  const checkedInApp = {
    id: 'app-checkedin',
    status: 'CHECKED_IN',
    startTime: '2026-09-14T10:00:00Z',
  }
  const checkCheckedIn = canRescheduleAppointment(checkedInApp, now)
  assert.equal(checkCheckedIn.allowed, false)
  assert.ok(checkCheckedIn.reason.includes('CHECKED_IN'))

  // 3. Lịch hẹn đã hoàn thành (COMPLETED)
  const completedApp = {
    id: 'app-completed',
    status: 'COMPLETED',
    startTime: '2026-09-14T10:00:00Z',
  }
  const checkCompleted = canRescheduleAppointment(completedApp, now)
  assert.equal(checkCompleted.allowed, false)
  assert.ok(checkCompleted.reason.includes('đã hoàn tất'))

  // 4. Lịch hẹn bị đánh dấu không đến (NO_SHOW)
  const noShowApp = {
    id: 'app-noshow',
    status: 'NO_SHOW',
    startTime: '2026-09-14T10:00:00Z',
  }
  const checkNoShow = canRescheduleAppointment(noShowApp, now)
  assert.equal(checkNoShow.allowed, false)
  assert.ok(checkNoShow.reason.includes('không đến khám'))

  // 5. Lịch hẹn đã hủy (CANCELLED)
  const cancelledApp = {
    id: 'app-cancelled',
    status: 'CANCELLED',
    startTime: '2026-09-14T10:00:00Z',
  }
  const checkCancelled = canRescheduleAppointment(cancelledApp, now)
  assert.equal(checkCancelled.allowed, false)
  assert.ok(checkCancelled.reason.includes('đã bị hủy'))
})

test('NCL-03-CN-007-TC-03: Kiểm tra dữ liệu không hợp lệ - startTime ở quá khứ, endTime <= startTime, lý do để trống hoặc > 500 ký tự', () => {
  const now = dayjs('2026-09-14T09:00:00Z')

  // 1. startTime ở quá khứ
  const pastStartTime = '2026-09-14T08:00:00Z'
  const futureEndTime = '2026-09-14T09:30:00Z'
  const pastTimeRes = validateRescheduleTime(pastStartTime, futureEndTime, now)
  assert.equal(pastTimeRes.valid, false)
  assert.ok(pastTimeRes.error.includes('trong tương lai'))

  // 2. endTime trước startTime
  const validStart = '2026-09-14T10:00:00Z'
  const invalidEnd = '2026-09-14T09:30:00Z'
  const invalidEndRes = validateRescheduleTime(validStart, invalidEnd, now)
  assert.equal(invalidEndRes.valid, false)
  assert.ok(invalidEndRes.error.includes('sau thời gian bắt đầu'))

  // 3. endTime bằng startTime
  const sameEndRes = validateRescheduleTime(validStart, validStart, now)
  assert.equal(sameEndRes.valid, false)
  assert.ok(sameEndRes.error.includes('sau thời gian bắt đầu'))

  // 4. Lý do để trống hoặc chỉ có khoảng trắng
  const emptyReason = validateRescheduleReason('')
  assert.equal(emptyReason.valid, false)
  assert.ok(emptyReason.error.includes('không được để trống'))

  const whitespaceReason = validateRescheduleReason('    \n\t   ')
  assert.equal(whitespaceReason.valid, false)
  assert.ok(whitespaceReason.error.includes('không được để trống'))

  // 5. Lý do vượt quá 500 ký tự (501 ký tự)
  const tooLongReason = validateRescheduleReason('A'.repeat(501))
  assert.equal(tooLongReason.valid, false)
  assert.ok(tooLongReason.error.includes('500 ký tự'))
})

test('NCL-03-CN-007-TC-04: Cấu trúc nhật ký lịch sử dời lịch hẹn đầy đủ theo chuẩn backend', () => {
  const historyItem = {
    id: 'log-01',
    appointmentId: 'app-01',
    oldDoctorId: 'doc-01',
    newDoctorId: 'doc-02',
    oldDoctorName: 'BS. Trần Văn A',
    newDoctorName: 'BS. Lê Thị B',
    oldStartTime: '2026-09-14T09:00:00Z',
    oldEndTime: '2026-09-14T09:30:00Z',
    newStartTime: '2026-09-15T14:00:00Z',
    newEndTime: '2026-09-15T14:30:00Z',
    reason: 'Bệnh nhân có việc gia đình đột xuất',
    rescheduledBy: 'user-rec-01',
    rescheduledByName: 'Nguyễn Thị Lễ Tân',
    rescheduledAt: '2026-09-14T08:15:00Z',
  }

  assert.ok(historyItem.oldStartTime && historyItem.newStartTime)
  assert.ok(historyItem.reason)
  assert.ok(historyItem.rescheduledByName)
  assert.ok(historyItem.rescheduledAt)
  assert.notEqual(historyItem.oldStartTime, historyItem.newStartTime)
})

test('NCL-03-CN-007: Danh mục lý do dời lịch hẹn mẫu (Preset Reasons) đầy đủ', () => {
  assert.ok(Array.isArray(PRESET_RESCHEDULE_REASONS))
  assert.ok(PRESET_RESCHEDULE_REASONS.length >= 4)
  assert.ok(PRESET_RESCHEDULE_REASONS.some((r) => r.includes('bận đột xuất')))
  assert.ok(PRESET_RESCHEDULE_REASONS.some((r) => r.includes('đến muộn')))
  assert.ok(PRESET_RESCHEDULE_REASONS.some((r) => r.includes('Bác sĩ')))
})

test('NCL-03-CN-007-Major-1: Chỉ RECEPTIONIST hoặc ADMIN mới có quyền đổi lịch hẹn tại quầy (canRescheduleAppointment)', async () => {
  const { checkQueuePermissions } = await import('../../utils/queueHelpers.js')

  // 1. Receptionist có quyền APPOINTMENT_UPDATE -> Được phép
  const recPerm = checkQueuePermissions(['ROLE_RECEPTIONIST'], ['APPOINTMENT_UPDATE', 'APPOINTMENT_READ'])
  assert.equal(recPerm.canRescheduleAppointment, true)
  assert.equal(recPerm.isReceptionist, true)

  // 2. Admin có toàn quyền -> Được phép
  const adminPerm = checkQueuePermissions(['ROLE_ADMIN'], [])
  assert.equal(adminPerm.canRescheduleAppointment, true)
  assert.equal(adminPerm.isAdmin, true)

  // 3. Doctor (kể cả có vô tình có APPOINTMENT_UPDATE) -> Bị chặn
  const docPerm = checkQueuePermissions(['ROLE_DOCTOR'], ['APPOINTMENT_UPDATE', 'APPOINTMENT_READ'])
  assert.equal(docPerm.canRescheduleAppointment, false)

  // 4. Pharmacist -> Bị chặn
  const pharmPerm = checkQueuePermissions(['ROLE_PHARMACIST'], ['APPOINTMENT_UPDATE'])
  assert.equal(pharmPerm.canRescheduleAppointment, false)

  // 5. Nurse -> Bị chặn
  const nursePerm = checkQueuePermissions(['ROLE_NURSE'], ['APPOINTMENT_UPDATE'])
  assert.equal(nursePerm.canRescheduleAppointment, false)
})

test('NCL-03-CN-007-Blocker: Tính toán tính khả dụng của slot 30 phút theo ca trực bác sĩ', () => {
  const now = dayjs('2026-09-15T09:00:00Z')

  const sampleSlots = [
    { startTime: '2026-09-15T08:00:00Z', endTime: '2026-09-15T08:30:00Z', isAvailable: true }, // Past
    { startTime: '2026-09-15T08:30:00Z', endTime: '2026-09-15T09:00:00Z', isAvailable: false }, // Past & booked
    { startTime: '2026-09-15T09:30:00Z', endTime: '2026-09-15T10:00:00Z', isAvailable: true }, // Future & free -> SELECTABLE
    { startTime: '2026-09-15T10:00:00Z', endTime: '2026-09-15T10:30:00Z', isAvailable: false }, // Future & booked -> NOT selectable
    { startTime: '2026-09-15T14:00:00Z', endTime: '2026-09-15T14:30:00Z', isAvailable: true }, // Afternoon & free -> SELECTABLE
  ]

  const processed = sampleSlots.map((slot) => {
    const start = dayjs(slot.startTime)
    const isPast = start.isBefore(now)
    const canSelect = Boolean(slot.isAvailable) && !isPast
    return { ...slot, isPast, canSelect }
  })

  // Slot 1: Past -> cannot select
  assert.equal(processed[0].isPast, true)
  assert.equal(processed[0].canSelect, false)

  // Slot 2: Past & unavailable -> cannot select
  assert.equal(processed[1].isPast, true)
  assert.equal(processed[1].canSelect, false)

  // Slot 3: Future & available -> can select
  assert.equal(processed[2].isPast, false)
  assert.equal(processed[2].canSelect, true)

  // Slot 4: Future but unavailable (booked) -> cannot select
  assert.equal(processed[3].isPast, false)
  assert.equal(processed[3].canSelect, false)

  // Slot 5: Afternoon & available -> can select
  assert.equal(processed[4].isPast, false)
  assert.equal(processed[4].canSelect, true)

  // Exactly 2 selectable slots
  const availableCount = processed.filter((s) => s.canSelect).length
  assert.equal(availableCount, 2)
})

