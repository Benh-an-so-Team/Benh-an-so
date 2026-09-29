import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dayjs from 'dayjs'

import {
  buildDoctorDeepLink,
  calculateDoctorDashboardSummary,
  findCurrentOrNextAppointment,
  formatAppointmentTime,
  formatRemainingOrOverdueTime,
  formatWaitTime,
  isClinicalResultAbnormal,
  mapAppointmentStatus,
  mapQueueStatus,
  sortPendingMedicalRecords,
} from '../../utils/doctorDashboardHelpers.js'
import { getDefaultHomePath } from '../../utils/roleRouting.js'
import { getNavigationItems, navigationSections } from '../../components/layout/navigationConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendSrcDir = path.resolve(__dirname, '../..')

// 1. Role routing tests
test('getDefaultHomePath directs doctor role to /doctor/dashboard', () => {
  assert.equal(getDefaultHomePath(['doctor']), '/doctor/dashboard')
  assert.equal(getDefaultHomePath(['ROLE_DOCTOR']), '/doctor/dashboard')
  assert.equal(getDefaultHomePath(['doctor', 'receptionist']), '/doctor/dashboard')
})

test('getDefaultHomePath directs other roles appropriately', () => {
  assert.equal(getDefaultHomePath(['admin']), '/')
  assert.equal(getDefaultHomePath(['manager']), '/')
  assert.equal(getDefaultHomePath(['clinic_manager']), '/')
  assert.equal(getDefaultHomePath(['receptionist']), '/appointments')
  assert.equal(getDefaultHomePath(['pharmacist']), '/pharmacy')
  assert.equal(getDefaultHomePath(['patient']), '/portal/dashboard')
})

// 2. Navigation items tests
test('navigationConfig displays "Bảng điều khiển Bác sĩ" pointing to /doctor/dashboard for doctor', () => {
  const doctorItems = getNavigationItems(['doctor'], ['DASHBOARD_DOCTOR_READ', 'MEDICAL_RECORD_READ'])
  const doctorDashboardItem = doctorItems.find((i) => i.key === '/doctor/dashboard')
  assert.ok(doctorDashboardItem, 'Doctor must have /doctor/dashboard menu item')
  assert.equal(doctorDashboardItem.label, 'Bảng điều khiển Bác sĩ')

  // Clinic-wide operations dashboard '/' must NOT be shown to doctor
  const clinicDashboardItemForDoctor = doctorItems.find((i) => i.key === '/')
  assert.equal(clinicDashboardItemForDoctor, undefined, 'Doctor must not see clinic-wide operational dashboard')

  // But admin/manager DOES see '/'
  const adminItems = getNavigationItems(['admin'], [])
  const clinicDashboardItemForAdmin = adminItems.find((i) => i.key === '/')
  assert.ok(clinicDashboardItemForAdmin, 'Admin must see clinic-wide operational dashboard')
})

test('navigationConfig overview section includes /doctor/dashboard', () => {
  const overviewSection = navigationSections.find((s) => s.key === 'overview')
  assert.ok(overviewSection, 'Overview section must exist')
  assert.ok(overviewSection.paths.includes('/doctor/dashboard'), 'Overview section must contain /doctor/dashboard')
})

// 3. formatWaitTime tests
test('formatWaitTime calculates waiting minutes and detects long wait >= 30m', () => {
  const now = dayjs('2026-09-29T10:00:00Z')

  // < 1 minute
  const res0 = formatWaitTime('2026-09-29T09:59:45Z', now)
  assert.equal(res0.text, 'Vừa mới đến')
  assert.equal(res0.isLongWait, false)

  // 15 minutes
  const res15 = formatWaitTime('2026-09-29T09:45:00Z', now)
  assert.equal(res15.text, 'Đã chờ 15 phút')
  assert.equal(res15.isLongWait, false)

  // 30 minutes (threshold)
  const res30 = formatWaitTime('2026-09-29T09:30:00Z', now)
  assert.equal(res30.text, 'Đã chờ 30 phút')
  assert.equal(res30.isLongWait, true)

  // 80 minutes (1h 20p)
  const res80 = formatWaitTime('2026-09-29T08:40:00Z', now)
  assert.equal(res80.text, 'Đã chờ 1h 20p')
  assert.equal(res80.isLongWait, true)
})

// 4. formatAppointmentTime tests
test('formatAppointmentTime formats start and end time', () => {
  const formatted = formatAppointmentTime('2026-09-29T08:30:00Z', '2026-09-29T09:00:00Z')
  assert.ok(formatted.includes(':'), 'Should format time with colon')

  const single = formatAppointmentTime('2026-09-29T08:30:00Z')
  assert.ok(single.includes(':'), 'Should format start time')

  assert.equal(formatAppointmentTime(null), '--:--')
})

// 5. mapAppointmentStatus and mapQueueStatus tests
test('mapAppointmentStatus maps appointment statuses to Vietnamese labels', () => {
  assert.equal(mapAppointmentStatus('PENDING').label, 'Chưa đến')
  assert.equal(mapAppointmentStatus('CONFIRMED').label, 'Chưa đến')
  assert.equal(mapAppointmentStatus('CHECKED_IN').label, 'Đã đến')
  assert.equal(mapAppointmentStatus('IN_PROGRESS').label, 'Đang khám')
  assert.equal(mapAppointmentStatus('COMPLETED').label, 'Đã khám')
  assert.equal(mapAppointmentStatus('CANCELLED').label, 'Đã hủy')
})

test('mapQueueStatus maps queue statuses to Vietnamese labels', () => {
  assert.equal(mapQueueStatus('WAITING').label, 'Đang chờ')
  assert.equal(mapQueueStatus('CALLED').label, 'Đã gọi vào')
  assert.equal(mapQueueStatus('IN_PROGRESS').label, 'Đang khám')
  assert.equal(mapQueueStatus('WAITING_FOR_RESULT').label, 'Chờ kết quả')
})

// 6. findCurrentOrNextAppointment tests
test('findCurrentOrNextAppointment prioritizes in-progress then checked-in then upcoming', () => {
  const appts = [
    { appointmentId: 'apt-1', status: 'COMPLETED' },
    { appointmentId: 'apt-2', status: 'IN_PROGRESS' },
    { appointmentId: 'apt-3', status: 'CHECKED_IN' },
    { appointmentId: 'apt-4', status: 'CONFIRMED' },
  ]
  assert.equal(findCurrentOrNextAppointment(appts), 'apt-2')

  const apptsNoInProgress = [
    { appointmentId: 'apt-1', status: 'COMPLETED' },
    { appointmentId: 'apt-3', status: 'CHECKED_IN' },
    { appointmentId: 'apt-4', status: 'CONFIRMED' },
  ]
  assert.equal(findCurrentOrNextAppointment(apptsNoInProgress), 'apt-3')

  const apptsUpcomingOnly = [
    { appointmentId: 'apt-1', status: 'COMPLETED' },
    { appointmentId: 'apt-4', status: 'CONFIRMED' },
  ]
  assert.equal(findCurrentOrNextAppointment(apptsUpcomingOnly), 'apt-4')
})

// 7. sortPendingMedicalRecords tests
test('sortPendingMedicalRecords sorts overdue records first by overdueHours desc', () => {
  const records = [
    { medicalRecordId: 'rec-1', isOverdue: false, deadlineAt: '2026-09-29T18:00:00Z' },
    { medicalRecordId: 'rec-2', isOverdue: true, overdueHours: 5 },
    { medicalRecordId: 'rec-3', isOverdue: true, overdueHours: 28 },
    { medicalRecordId: 'rec-4', isOverdue: false, deadlineAt: '2026-09-29T14:00:00Z' },
  ]

  const sorted = sortPendingMedicalRecords(records)
  assert.equal(sorted[0].medicalRecordId, 'rec-3', 'Overdue 28h must be first')
  assert.equal(sorted[1].medicalRecordId, 'rec-2', 'Overdue 5h must be second')
  assert.equal(sorted[2].medicalRecordId, 'rec-4', 'Soonest deadline (14:00) must be third')
  assert.equal(sorted[3].medicalRecordId, 'rec-1', 'Later deadline (18:00) must be fourth')
})

// 8. formatRemainingOrOverdueTime tests
test('formatRemainingOrOverdueTime returns correct labels and badge severity', () => {
  const overdueRec = { isOverdue: true, overdueHours: 4 }
  const resOverdue = formatRemainingOrOverdueTime(overdueRec)
  assert.equal(resOverdue.isOverdue, true)
  assert.equal(resOverdue.label, 'Quá hạn 4 giờ')

  const overdueRecDays = { isOverdue: true, overdueHours: 26 }
  const resOverdueDays = formatRemainingOrOverdueTime(overdueRecDays)
  assert.equal(resOverdueDays.label, 'Quá hạn 1 ngày 2h')
  assert.equal(resOverdueDays.badgeType, 'error')

  const now = dayjs('2026-09-29T10:00:00Z')
  const inDeadlineRec = { isOverdue: false, deadlineAt: '2026-09-29T15:00:00Z' }
  const resInDeadline = formatRemainingOrOverdueTime(inDeadlineRec, now)
  assert.equal(resInDeadline.isOverdue, false)
  assert.equal(resInDeadline.label, 'Còn 5 giờ')
})

// 9. isClinicalResultAbnormal tests
test('isClinicalResultAbnormal identifies abnormal flags correctly', () => {
  assert.equal(isClinicalResultAbnormal({ abnormalFlag: 'ABNORMAL' }), true)
  assert.equal(isClinicalResultAbnormal({ abnormalFlag: 'HIGH' }), true)
  assert.equal(isClinicalResultAbnormal({ abnormalFlag: 'LOW' }), true)
  assert.equal(isClinicalResultAbnormal({ abnormalFlag: 'NORMAL' }), false)
  assert.equal(isClinicalResultAbnormal({ status: 'ABNORMAL' }), true)
  assert.equal(isClinicalResultAbnormal(null), false)
})

// 10. calculateDoctorDashboardSummary tests
test('calculateDoctorDashboardSummary derives all 4 KPI counts accurately', () => {
  const appointments = [
    { appointmentId: '1', status: 'CONFIRMED' },
    { appointmentId: '2', status: 'IN_PROGRESS' },
    { appointmentId: '3', status: 'COMPLETED' },
    { appointmentId: '4', status: 'CANCELLED' },
  ]
  const queue = [
    { queueItemId: 'q1', status: 'WAITING' },
    { queueItemId: 'q2', status: 'WAITING' },
    { queueItemId: 'q3', status: 'COMPLETED' },
  ]
  const pendingRecords = [
    { medicalRecordId: 'r1', isOverdue: true },
    { medicalRecordId: 'r2', isOverdue: false },
    { medicalRecordId: 'r3', isOverdue: true },
  ]
  const clinicalResults = [
    { clinicalResultId: 'c1', abnormalFlag: 'NORMAL' },
    { clinicalResultId: 'c2', abnormalFlag: 'HIGH' },
    { clinicalResultId: 'c3', abnormalFlag: 'NORMAL' },
  ]

  const summary = calculateDoctorDashboardSummary(appointments, queue, pendingRecords, clinicalResults)
  assert.equal(summary.todayAppointmentsCount, 3, 'Excludes cancelled')
  assert.equal(summary.remainingAppointmentsCount, 2, 'CONFIRMED and IN_PROGRESS')
  assert.equal(summary.waitingQueueCount, 2, 'WAITING only')
  assert.equal(summary.pendingSignaturesCount, 3, 'Total pending records')
  assert.equal(summary.overdueSignaturesCount, 2, 'Overdue records')
  assert.equal(summary.newClinicalResultsCount, 3, 'Total clinical results')
  assert.equal(summary.abnormalClinicalResultsCount, 1, 'Abnormal results')
})

// 11. buildDoctorDeepLink tests
test('buildDoctorDeepLink creates deep links directly to encounter/record, not generic list', () => {
  const apptWithVisit = { visitId: 'visit-123', appointmentId: 'apt-1', patientId: 'pat-1' }
  assert.equal(buildDoctorDeepLink('appointment', apptWithVisit), '/medical-records/visits/visit-123')

  const apptWithoutVisit = { appointmentId: 'apt-1', patientId: 'pat-1' }
  assert.equal(buildDoctorDeepLink('appointment', apptWithoutVisit), '/medical-records?appointmentId=apt-1&patientId=pat-1')

  const queueItemWithVisit = { visitId: 'visit-456' }
  assert.equal(buildDoctorDeepLink('queue', queueItemWithVisit), '/medical-records/visits/visit-456')

  const pendingRecWithVisit = { visitId: 'visit-789' }
  assert.equal(buildDoctorDeepLink('medical_record', pendingRecWithVisit), '/medical-records/visits/visit-789')

  const pendingRecWithoutVisit = { medicalRecordId: 'rec-001' }
  assert.equal(buildDoctorDeepLink('medical_record', pendingRecWithoutVisit), '/medical-records?recordId=rec-001')

  const clinicalWithVisit = { visitId: 'visit-888' }
  assert.equal(buildDoctorDeepLink('clinical_result', clinicalWithVisit), '/medical-records/visits/visit-888?tab=results')
})

// 12. File integrity and UI structure tests
test('DoctorDashboardPage.jsx contains all 4 KPI cards and 4 content blocks with friendly empty states', () => {
  const pagePath = path.join(frontendSrcDir, 'pages', 'DoctorDashboardPage.jsx')
  const content = fs.readFileSync(pagePath, 'utf-8')

  // Check 4 KPI cards
  assert.ok(content.includes('kpi-appointments'), 'Must include Today Appointments KPI card')
  assert.ok(content.includes('kpi-queue'), 'Must include Queue KPI card')
  assert.ok(content.includes('kpi-unsigned-records'), 'Must include Unsigned Records KPI card')
  assert.ok(content.includes('kpi-clinical-results'), 'Must include Clinical Results KPI card')

  // Check 4 Content Blocks
  assert.ok(content.includes('Lịch khám hôm nay'), 'Must include Today Appointments block')
  assert.ok(content.includes('Hàng đợi khám'), 'Must include Queue block')
  assert.ok(content.includes('Bệnh án chờ ký'), 'Must include Pending Records block')
  assert.ok(content.includes('Kết quả cận lâm sàng mới'), 'Must include Clinical Results block')

  // Check empty states
  assert.ok(content.includes('Không có lịch khám nào trong hôm nay'), 'Friendly empty state for appointments')
  assert.ok(content.includes('Hàng đợi đang trống, hiện chưa có bệnh nhân chờ'), 'Friendly empty state for queue')
  assert.ok(content.includes('Không có bệnh án nào chờ ký, bạn đã hoàn tất mọi việc'), 'Friendly empty state for unsigned records')
  assert.ok(content.includes('Chưa có kết quả cận lâm sàng mới cần xử lý'), 'Friendly empty state for clinical results')

  // Check skeleton and error retry
  assert.ok(content.includes('doc-skeleton-container'), 'Must have skeleton loader')
  assert.ok(content.includes('doc-block-error'), 'Must have localized error UI')
  assert.ok(content.includes('handleRetryBlock'), 'Must have independent block retry handler')

  // Check auto-refresh and updated time
  assert.ok(content.includes('AUTO_REFRESH_INTERVAL_MS'), 'Must define auto refresh interval')
  assert.ok(content.includes('Cập nhật lần cuối'), 'Must show last updated timestamp')
})

test('AppRoutes.jsx registers /doctor/dashboard route with Doctor and Admin access', () => {
  const routesPath = path.join(frontendSrcDir, 'routes', 'AppRoutes.jsx')
  const content = fs.readFileSync(routesPath, 'utf-8')

  assert.ok(content.includes('DoctorDashboardPage'), 'AppRoutes must import DoctorDashboardPage')
  assert.ok(content.includes('path="doctor/dashboard"'), 'AppRoutes must declare doctor/dashboard route')
})
