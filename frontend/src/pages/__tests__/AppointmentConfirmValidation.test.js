import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'
import {
  canConfirmAppointment,
  canPatientConfirmAppointment,
  formatConfirmationInfo,
  filterUnconfirmedAppointments,
} from '../../utils/appointmentConfirmValidation.js'
import {
  checkQueuePermissions,
  APPOINTMENT_STATUS_META,
} from '../../utils/queueHelpers.js'
import appointmentApi from '../../api/appointmentApi.js'
import patientPortalAppointmentApi from '../../api/patientPortalAppointmentApi.js'

test('NCL-03-CN-008-TC-01: Lễ tân xác nhận lịch hẹn ở trạng thái đã đặt (SCHEDULED)', () => {
  const now = dayjs('2026-09-15T08:00:00.000Z')

  // 1. Lịch hẹn tương lai ở trạng thái SCHEDULED được phép xác nhận
  const scheduledApp = {
    id: 'app-01',
    appointmentCode: 'APT-001',
    status: 'SCHEDULED',
    startTime: '2026-09-15T09:00:00.000Z',
    patientName: 'Nguyễn Văn An',
  }

  const check = canConfirmAppointment(scheduledApp, now)
  assert.equal(check.allowed, true)
  assert.equal(check.reason, '')

  // 2. Định dạng thông tin xác nhận sau khi hoàn tất
  const info = formatConfirmationInfo('Lễ tân Mai Anh', '2026-09-15T08:05:00.000Z')
  assert.ok(info.includes('Lễ tân Mai Anh'))
  assert.ok(info.includes('Xác nhận bởi'))

  // Trường hợp không có tên người xác nhận thì mặc định là 'Lễ tân'
  const defaultInfo = formatConfirmationInfo(null, '2026-09-15T08:05:00.000Z')
  assert.ok(defaultInfo.includes('Lễ tân'))

  // 3. API xác nhận có sẵn trên appointmentApi
  assert.equal(typeof appointmentApi.confirm, 'function')
})

test('NCL-03-CN-008-TC-02: Bệnh nhân trên cổng trực tuyến tự xác nhận sẽ đến khám', () => {
  const now = dayjs('2026-09-15T08:00:00.000Z')

  const portalApp = {
    id: 'app-portal-01',
    appointmentCode: 'APT-PORTAL-01',
    status: 'SCHEDULED',
    startTime: '2026-09-15T14:30:00.000Z',
    bookingChannel: 'ONLINE_PORTAL',
  }

  // Bệnh nhân tự xác nhận được phép khi lịch đang ở trạng thái SCHEDULED tương lai
  const check = canPatientConfirmAppointment(portalApp, now)
  assert.equal(check.allowed, true)
  assert.equal(check.reason, '')

  // API xác nhận có sẵn trên patientPortalAppointmentApi
  assert.equal(typeof patientPortalAppointmentApi.confirmAppointment, 'function')
})

test('NCL-03-CN-008-TC-03: Từ chối xác nhận với lịch sai trạng thái hoặc đã quá giờ khám', () => {
  const now = dayjs('2026-09-15T09:00:00.000Z')

  // 1. Lịch đã bị hủy (CANCELLED)
  const cancelledApp = {
    id: 'app-cancelled',
    status: 'CANCELLED',
    startTime: '2026-09-15T10:00:00.000Z',
  }
  const checkCancelled = canConfirmAppointment(cancelledApp, now)
  assert.equal(checkCancelled.allowed, false)
  assert.ok(checkCancelled.reason.includes('đã bị hủy'))

  // 2. Lịch đã được xác nhận trước đó (CONFIRMED) - chống xác nhận 2 lần
  const alreadyConfirmedApp = {
    id: 'app-confirmed',
    status: 'CONFIRMED',
    startTime: '2026-09-15T10:00:00.000Z',
  }
  const checkDoubleConfirm = canConfirmAppointment(alreadyConfirmedApp, now)
  assert.equal(checkDoubleConfirm.allowed, false)
  assert.ok(checkDoubleConfirm.reason.includes('đã được xác nhận trước đó'))

  // 3. Lịch đã tiếp nhận (CHECKED_IN)
  const checkedInApp = {
    id: 'app-checkedin',
    status: 'CHECKED_IN',
    startTime: '2026-09-15T10:00:00.000Z',
  }
  const checkCheckedIn = canConfirmAppointment(checkedInApp, now)
  assert.equal(checkCheckedIn.allowed, false)
  assert.ok(checkCheckedIn.reason.includes('tiếp nhận'))

  // 4. Lịch đã hoàn tất (COMPLETED)
  const completedApp = {
    id: 'app-completed',
    status: 'COMPLETED',
    startTime: '2026-09-15T10:00:00.000Z',
  }
  const checkCompleted = canConfirmAppointment(completedApp, now)
  assert.equal(checkCompleted.allowed, false)
  assert.ok(checkCompleted.reason.includes('hoàn tất'))

  // 5. Lịch đã quá giờ khám (startTime <= now)
  const pastApp = {
    id: 'app-past',
    status: 'SCHEDULED',
    startTime: '2026-09-15T08:30:00.000Z',
  }
  const checkPast = canConfirmAppointment(pastApp, now)
  assert.equal(checkPast.allowed, false)
  assert.ok(checkPast.reason.includes('quá giờ khám'))

  // 6. Lịch hẹn rỗng
  const checkNull = canConfirmAppointment(null, now)
  assert.equal(checkNull.allowed, false)
})

test('NCL-03-CN-008-TC-04: Lọc và hiển thị danh sách lịch hẹn chưa xác nhận theo ngày', () => {
  const now = dayjs('2026-09-15T07:00:00.000Z')

  const sampleList = [
    {
      id: 'app-slot3',
      status: 'SCHEDULED',
      startTime: '2026-09-15T11:00:00.000Z',
    },
    {
      id: 'app-slot1',
      status: 'SCHEDULED',
      startTime: '2026-09-15T08:30:00.000Z',
    },
    {
      id: 'app-past',
      status: 'SCHEDULED',
      startTime: '2026-09-15T06:30:00.000Z', // Quá hạn so với now
    },
    {
      id: 'app-confirmed',
      status: 'CONFIRMED', // Đã xác nhận, không hiển thị trong danh sách chưa xác nhận
      startTime: '2026-09-15T09:00:00.000Z',
    },
    {
      id: 'app-tomorrow',
      status: 'SCHEDULED',
      startTime: '2026-09-16T08:30:00.000Z', // Ngày khác
    },
  ]

  // Lọc cho ngày 2026-09-15
  const unconfirmedToday = filterUnconfirmedAppointments(sampleList, '2026-09-15', now)
  assert.equal(unconfirmedToday.length, 2)
  // Phải được sắp xếp tăng dần theo khung giờ: 08:30 trước, 11:00 sau
  assert.equal(unconfirmedToday[0].id, 'app-slot1')
  assert.equal(unconfirmedToday[1].id, 'app-slot3')

  // API lấy danh sách chưa xác nhận có sẵn trên appointmentApi
  assert.equal(typeof appointmentApi.getUnconfirmed, 'function')
})

test('NCL-03-CN-008-RBAC: Phân quyền xác nhận lịch hẹn và siêu dữ liệu trạng thái CONFIRMED', () => {
  // 1. Vai trò RECEPTIONIST có quyền xác nhận lịch hẹn
  const recPerms = checkQueuePermissions(['ROLE_RECEPTIONIST'], ['PERMISSION_APPOINTMENT_UPDATE'])
  assert.equal(recPerms.canConfirmAppointment, true)

  // 2. Vai trò ADMIN có quyền xác nhận lịch hẹn
  const adminPerms = checkQueuePermissions(['ROLE_ADMIN'], ['PERMISSION_APPOINTMENT_UPDATE'])
  assert.equal(adminPerms.canConfirmAppointment, true)

  // 3. Vai trò DOCTOR không có quyền xác nhận lịch hẹn tại quầy
  const docPerms = checkQueuePermissions(['ROLE_DOCTOR'], [])
  assert.equal(docPerms.canConfirmAppointment, false)

  // 4. Trạng thái CONFIRMED được định nghĩa đúng trong APPOINTMENT_STATUS_META
  assert.ok(APPOINTMENT_STATUS_META.CONFIRMED)
  assert.equal(APPOINTMENT_STATUS_META.CONFIRMED.label, 'Đã xác nhận')
  assert.equal(APPOINTMENT_STATUS_META.CONFIRMED.tone, 'green')

  // 5. Cả SCHEDULED và CONFIRMED đều được phép Check-in vào hàng đợi
  assert.equal(recPerms.canCheckIn, true)
})
