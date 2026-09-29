import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DAY_OF_WEEK_LABELS,
  SLOT_CONFIG,
  SLOT_STATUS,
  canAccessDoctorWeeklyTable,
  cleanWeeklyTableErrorMessage,
  evaluateSlotAction,
  formatAppointmentStatusVi,
  formatSlotTimeRange,
  formatWeekRange,
} from '../../utils/doctorWeeklyTableHelpers.js'

test('NCL-03-CN-010-TC-01: Định dạng dữ liệu ma trận lịch tuần theo cột bác sĩ và hàng khung giờ', () => {
  // 1. Kiểm tra nhãn các ngày trong tuần đầy đủ từ Thứ 2 đến Chủ nhật
  assert.equal(DAY_OF_WEEK_LABELS.MONDAY, 'Thứ Hai')
  assert.equal(DAY_OF_WEEK_LABELS.TUESDAY, 'Thứ Ba')
  assert.equal(DAY_OF_WEEK_LABELS.WEDNESDAY, 'Thứ Tư')
  assert.equal(DAY_OF_WEEK_LABELS.THURSDAY, 'Thứ Năm')
  assert.equal(DAY_OF_WEEK_LABELS.FRIDAY, 'Thứ Sáu')
  assert.equal(DAY_OF_WEEK_LABELS.SATURDAY, 'Thứ Bảy')
  assert.equal(DAY_OF_WEEK_LABELS.SUNDAY, 'Chủ Nhật')

  // 2. Định dạng dải ngày tuần
  const rangeStr = formatWeekRange('2026-09-14', '2026-09-20')
  assert.match(rangeStr, /14\/09\/2026/)
  assert.match(rangeStr, /20\/09\/2026/)

  // 3. Định dạng khung giờ slot 30 phút
  assert.equal(formatSlotTimeRange('08:00:00', '08:30:00'), '08:00 - 08:30')
  assert.equal(formatSlotTimeRange('14:30:00', '15:00:00'), '14:30 - 15:00')

  // 4. Kiểm tra cấu hình màu sắc và nhãn của từng trạng thái slot
  assert.equal(SLOT_CONFIG[SLOT_STATUS.AVAILABLE].label, 'Còn trống')
  assert.equal(SLOT_CONFIG[SLOT_STATUS.BOOKED].label, 'Đã đặt')
  assert.equal(SLOT_CONFIG[SLOT_STATUS.ON_LEAVE].label, 'Nghỉ phép')
  assert.equal(SLOT_CONFIG[SLOT_STATUS.OFF_DUTY].label, 'Không có ca')
  assert.equal(SLOT_CONFIG[SLOT_STATUS.PAST].label, 'Đã qua')
})

test('NCL-03-CN-010-TC-02: Bấm vào ô trống AVAILABLE cho phép mở luồng đặt lịch nhanh', () => {
  const availableSlot = {
    slotStartTime: '09:00:00',
    slotEndTime: '09:30:00',
    status: SLOT_STATUS.AVAILABLE,
    isBookable: true,
  }

  const res = evaluateSlotAction(availableSlot, 'BS. Nguyễn Văn A', '2026-09-15')
  assert.equal(res.canBook, true)
  assert.equal(res.reason, 'AVAILABLE')
  assert.match(res.message, /Khung giờ còn trống/)
})

test('NCL-03-CN-010-TC-03: Bấm vào ô khoảng nghỉ ON_LEAVE bị chặn theo quy tắc QTN-30', () => {
  const leaveSlot = {
    slotStartTime: '10:00:00',
    slotEndTime: '10:30:00',
    status: SLOT_STATUS.ON_LEAVE,
    isBookable: false,
    timeOffReason: 'Nghỉ phép thường niên',
  }

  const res = evaluateSlotAction(leaveSlot, 'BS. Trần Thị B', '2026-09-15')
  assert.equal(res.canBook, false)
  assert.equal(res.reason, 'ON_LEAVE')
  assert.match(res.message, /nghỉ phép/)
  assert.match(res.message, /Nghỉ phép thường niên/)
})

test('Chuẩn hóa trạng thái lịch hẹn sang tiếng Việt thuần qua formatAppointmentStatusVi', () => {
  assert.equal(formatAppointmentStatusVi('SCHEDULED').label, 'Đã đặt hẹn')
  assert.equal(formatAppointmentStatusVi('CONFIRMED').label, 'Đã xác nhận')
  assert.equal(formatAppointmentStatusVi('CHECKED_IN').label, 'Đã tiếp nhận')
  assert.equal(formatAppointmentStatusVi('IN_PROGRESS').label, 'Đang khám')
  assert.equal(formatAppointmentStatusVi('COMPLETED').label, 'Đã hoàn thành')
  assert.equal(formatAppointmentStatusVi('CANCELLED').label, 'Đã hủy')
  assert.equal(formatAppointmentStatusVi('NO_SHOW').label, 'Không đến khám')
  assert.equal(formatAppointmentStatusVi('WAITING').label, 'Chờ khám')
})

test('NCL-03-CN-010-TC-04: Phân quyền truy cập - Chặn vai trò Dược sĩ và cấp quyền cho Lễ tân, Quản lý', () => {
  // 1. Dược sĩ thuần túy (PHARMACIST) -> Bị từ chối truy cập (false)
  const pharmacistUser = {
    id: 'u-pharm-01',
    roles: ['pharmacist'],
    permissions: ['PHARMACY_READ', 'PRESCRIPTION_READ'],
  }
  assert.equal(canAccessDoctorWeeklyTable(pharmacistUser), false)

  // 2. Lễ tân (RECEPTIONIST) -> Được phép truy cập (true)
  const receptionistUser = {
    id: 'u-recep-01',
    roles: ['receptionist'],
    permissions: ['PATIENT_READ', 'APPOINTMENT_READ', 'APPOINTMENT_CREATE'],
  }
  assert.equal(canAccessDoctorWeeklyTable(receptionistUser), true)

  // 3. Quản trị viên (ADMIN) -> Được phép truy cập (true)
  const adminUser = {
    id: 'u-admin-01',
    roles: ['admin'],
    permissions: ['*'],
  }
  assert.equal(canAccessDoctorWeeklyTable(adminUser), true)

  // 4. Quản lý phòng khám (CLINIC_MANAGER) -> Được phép truy cập (true)
  const clinicMgrUser = {
    id: 'u-mgr-01',
    roles: ['clinic_manager'],
    permissions: ['APPOINTMENT_READ'],
  }
  assert.equal(canAccessDoctorWeeklyTable(clinicMgrUser), true)

  // 5. Bác sĩ (DOCTOR) -> Được phép xem lịch hẹn
  const doctorUser = {
    id: 'u-doc-01',
    roles: ['doctor'],
    permissions: ['APPOINTMENT_READ'],
  }
  assert.equal(canAccessDoctorWeeklyTable(doctorUser), true)

  // 6. Không có user -> false
  assert.equal(canAccessDoctorWeeklyTable(null), false)
})

test('Kiểm tra xử lý các ô trạng thái đặc biệt: BOOKED, OFF_DUTY, PAST', () => {
  // 1. Ô đã đặt BOOKED
  const bookedSlot = {
    status: SLOT_STATUS.BOOKED,
    appointment: {
      id: 'apt-01',
      appointmentCode: 'APT-20260915-001',
      patientName: 'Lê Văn C',
      patientPhone: '0912345678',
      reason: 'Đau đầu',
    },
  }
  const evalBooked = evaluateSlotAction(bookedSlot, 'BS. A', '2026-09-15')
  assert.equal(evalBooked.canBook, false)
  assert.equal(evalBooked.isViewable, true)
  assert.equal(evalBooked.appointment.patientName, 'Lê Văn C')

  // 2. Ô không có ca OFF_DUTY
  const offDutySlot = { status: SLOT_STATUS.OFF_DUTY }
  const evalOffDuty = evaluateSlotAction(offDutySlot, 'BS. A', '2026-09-15')
  assert.equal(evalOffDuty.canBook, false)
  assert.equal(evalOffDuty.reason, 'OFF_DUTY')

  // 3. Ô đã qua PAST
  const pastSlot = { status: SLOT_STATUS.PAST }
  const evalPast = evaluateSlotAction(pastSlot, 'BS. A', '2026-09-15')
  assert.equal(evalPast.canBook, false)
  assert.equal(evalPast.reason, 'PAST')
})

test('Ánh xạ mã lỗi Backend sang thông điệp tiếng Việt thân thiện', () => {
  // Lỗi bác sĩ không làm việc / nghỉ phép
  const errQtn30 = { response: { data: { code: 'DOCTOR_NOT_WORKING', message: 'Doctor is not working at this time' } } }
  assert.match(cleanWeeklyTableErrorMessage(errQtn30), /khoảng nghỉ/)

  // Lỗi trùng lịch
  const errQtn04 = { response: { data: { code: 'APPOINTMENT_CONFLICT', message: 'Appointment conflict detected' } } }
  assert.match(cleanWeeklyTableErrorMessage(errQtn04), /trùng/)

  // Lỗi 403 từ chối quyền
  const err403 = { response: { status: 403 } }
  assert.match(cleanWeeklyTableErrorMessage(err403), /403/)
})
