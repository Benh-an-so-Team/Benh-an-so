import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  canViewOverdueSigning,
  canSendSigningReminder,
  formatOverdueHours,
  getOverdueSeverity,
  formatReminderChannel,
  formatReminderStatus,
  validateSendReminderForm,
  calculateOverdueKpis,
  filterOverdueRecords,
  getDoctorDisplayName,
  formatMedicalRecordStatus,
  SYSTEM_DOCTORS,
} from '../../utils/overdueMedicalRecordHelpers.js'
import { getNavigationItems } from '../../components/layout/navigationConfig.js'

const frontendDir = fs.existsSync(path.resolve('src')) ? process.cwd() : path.resolve('frontend')

// ============================================================================
// TC-01: View overdue list with attending doctor and overdueHours
// ============================================================================
test('TC-01: formatOverdueHours and getOverdueSeverity calculate correct labels and tags', () => {
  // < 24h
  assert.equal(formatOverdueHours(0), '0 giờ')
  assert.equal(formatOverdueHours(5), '5 giờ')
  const moderate = getOverdueSeverity(5)
  assert.equal(moderate.level, 'MODERATE')
  assert.equal(moderate.tagColor, 'warning')

  // 24h - 72h
  assert.equal(formatOverdueHours(24), '1 ngày')
  assert.equal(formatOverdueHours(28), '1 ngày 4 giờ')
  const high = getOverdueSeverity(36)
  assert.equal(high.level, 'HIGH')
  assert.equal(high.tagColor, 'volcano')

  // > 72h
  assert.equal(formatOverdueHours(75), '3 ngày 3 giờ')
  const critical = getOverdueSeverity(75)
  assert.equal(critical.level, 'CRITICAL')
  assert.equal(critical.tagColor, 'magenta')
})

test('TC-01: calculateOverdueKpis accurately aggregates metrics from overdue records list', () => {
  const mockRecords = [
    { medicalRecordId: 'r1', doctorId: 'doc1', overdueHours: 5, reminderCount: 0 },
    { medicalRecordId: 'r2', doctorId: 'doc1', overdueHours: 30, reminderCount: 2 },
    { medicalRecordId: 'r3', doctorId: 'doc2', overdueHours: 80, reminderCount: 1 },
  ]

  const kpis = calculateOverdueKpis(mockRecords)
  assert.equal(kpis.totalRecords, 3)
  assert.equal(kpis.criticalRecords, 2) // 30h and 80h are >= 24h
  assert.equal(kpis.uniqueDoctors, 2) // doc1 and doc2
  assert.equal(kpis.totalRemindersSent, 3) // 0 + 2 + 1

  // With serverTotalElements from API metadata
  const serverKpis = calculateOverdueKpis(mockRecords, 150)
  assert.equal(serverKpis.totalRecords, 150, 'KPI totalRecords must use server totalElements when available')
  assert.equal(serverKpis.criticalRecords, 2)
})

// ============================================================================
// TC-02: Sending reminder logs event with channel, notes, timestamp and status
// ============================================================================
test('TC-02: validateSendReminderForm enforces character limits and channel options', () => {
  // Valid notes
  const valid = validateSendReminderForm({ notes: 'Kính gửi Bác sĩ hoàn thành ký bệnh án.' })
  assert.equal(valid.isValid, true)
  assert.equal(valid.errors.length, 0)

  // Empty notes is allowed (channel will default)
  const emptyNotes = validateSendReminderForm({ notes: '' })
  assert.equal(emptyNotes.isValid, true)

  // Notes exceeding 500 characters
  const tooLong = validateSendReminderForm({ notes: 'A'.repeat(501) })
  assert.equal(tooLong.isValid, false)
  assert.match(tooLong.errors[0], /500 ký tự/)
})

test('TC-02: formatReminderChannel and formatReminderStatus handle all supported channels and statuses', () => {
  assert.equal(formatReminderChannel('SYSTEM').text, 'Hệ thống nội bộ')
  assert.equal(formatReminderChannel('EMAIL').text, 'Email bác sĩ')
  assert.equal(formatReminderChannel('SMS').text, 'Tin nhắn SMS')

  assert.equal(formatReminderStatus('SENT').text, 'Đã gửi thành công')
  assert.equal(formatReminderStatus('FAILED').text, 'Gửi thất bại')
})

// ============================================================================
// TC-03: Signed records are strictly excluded from overdue list
// ============================================================================
test('TC-03: filterOverdueRecords strictly excludes signed records (status: SIGNED)', () => {
  const records = [
    {
      medicalRecordId: 'rec-1',
      visitCode: 'KB-001',
      patientFullName: 'Nguyễn Văn A',
      doctorFullName: 'BS. Lê Văn B',
      doctorId: 'doc-1',
      status: 'IN_PROGRESS',
      overdueHours: 10,
    },
    {
      medicalRecordId: 'rec-2',
      visitCode: 'KB-002',
      patientFullName: 'Trần Thị C',
      doctorFullName: 'BS. Lê Văn B',
      doctorId: 'doc-1',
      status: 'SIGNED', // Signed record! Must be excluded
      overdueHours: 35,
    },
    {
      medicalRecordId: 'rec-3',
      visitCode: 'KB-003',
      patientFullName: 'Phạm Văn D',
      doctorFullName: 'BS. Hoàng Nam',
      doctorId: 'doc-2',
      status: 'IN_PROGRESS',
      overdueHours: 85,
    },
  ]

  const filtered = filterOverdueRecords(records)
  assert.equal(filtered.length, 2, 'Signed record rec-2 must be excluded')
  assert.ok(!filtered.some((r) => r.medicalRecordId === 'rec-2'))

  // Filter by doctor
  const doc1Filtered = filterOverdueRecords(records, { doctorId: 'doc-1' })
  assert.equal(doc1Filtered.length, 1)
  assert.equal(doc1Filtered[0].medicalRecordId, 'rec-1')

  // Filter by search query
  const queryFiltered = filterOverdueRecords(records, { searchQuery: 'Phạm Văn D' })
  assert.equal(queryFiltered.length, 1)
  assert.equal(queryFiltered[0].medicalRecordId, 'rec-3')

  // Filter by severity level
  const criticalFiltered = filterOverdueRecords(records, { severityLevel: 'CRITICAL' })
  assert.equal(criticalFiltered.length, 1)
  assert.equal(criticalFiltered[0].medicalRecordId, 'rec-3')
})

// ============================================================================
// TC-04: Role-based access control (Receptionist denied, Manager/Doctor granted)
// ============================================================================
test('TC-04: Receptionist role is denied access to view and send signing reminders', () => {
  const receptionistRoles = ['receptionist']
  const receptionistPerms = ['PATIENT_READ', 'APPOINTMENT_READ']

  assert.equal(
    canViewOverdueSigning(receptionistRoles, receptionistPerms),
    false,
    'Receptionist must NOT have view access'
  )
  assert.equal(
    canSendSigningReminder(receptionistRoles, receptionistPerms),
    false,
    'Receptionist must NOT have remind access'
  )

  // Navigation menu check
  const navItems = getNavigationItems(receptionistRoles, receptionistPerms)
  const hasOverdueMenu = navItems.some((item) => item.key === '/medical-records/overdue-signing')
  assert.equal(hasOverdueMenu, false, 'Navigation menu must hide overdue-signing for receptionist')
})

test('TC-04: Doctor role has read-only view access to overdue signing screen and navigation', () => {
  const doctorRoles = ['doctor']
  const doctorPerms = ['MEDICAL_RECORD_OVERDUE_READ', 'MEDICAL_RECORD_READ', 'MEDICAL_RECORD_UPDATE']

  assert.equal(
    canViewOverdueSigning(doctorRoles, doctorPerms),
    true,
    'Doctor must have view access to overdue signing'
  )
  assert.equal(
    canSendSigningReminder(doctorRoles, doctorPerms),
    false,
    'Doctor must NOT have remind access (read-only)'
  )

  // Navigation menu check for doctor
  const docNavItems = getNavigationItems(doctorRoles, doctorPerms)
  const docHasOverdueMenu = docNavItems.some((item) => item.key === '/medical-records/overdue-signing')
  assert.equal(docHasOverdueMenu, true, 'Navigation menu must show overdue-signing for doctor')

  // Pharmacist is denied access
  const pharmacistRoles = ['pharmacist']
  const pharmacistPerms = ['PHARMACY_READ']
  assert.equal(canViewOverdueSigning(pharmacistRoles, pharmacistPerms), false, 'Pharmacist must NOT have view access')
  assert.equal(canSendSigningReminder(pharmacistRoles, pharmacistPerms), false, 'Pharmacist must NOT have remind access')
})

test('TC-04: Admin and Clinic Manager have appropriate permissions and navigation visible', () => {
  // Admin has both view and send
  assert.equal(canViewOverdueSigning(['admin'], []), true)
  assert.equal(canSendSigningReminder(['admin'], []), true)

  // Clinic Manager has both view and send
  assert.equal(canViewOverdueSigning(['clinic_manager'], []), true)
  assert.equal(canSendSigningReminder(['clinic_manager'], []), true)

  // Manager has both view and send
  assert.equal(canViewOverdueSigning(['manager'], []), true)
  assert.equal(canSendSigningReminder(['manager'], []), true)

  // Check navigation items for Clinic Manager
  const managerNav = getNavigationItems(['clinic_manager'], ['MEDICAL_RECORD_REMIND_SIGN'])
  const managerHasMenu = managerNav.some((item) => item.key === '/medical-records/overdue-signing')
  assert.equal(managerHasMenu, true, 'Clinic Manager must see overdue-signing in navigation')
})

// ============================================================================
// UI & Button Standardization checks
// ============================================================================
test('OverdueMedicalRecordSigningPage complies with button standard and file structure', () => {
  const pagePath = path.join(frontendDir, 'src/pages/OverdueMedicalRecordSigningPage.jsx')
  assert.ok(fs.existsSync(pagePath), 'OverdueMedicalRecordSigningPage.jsx must exist')

  const content = fs.readFileSync(pagePath, 'utf-8')
  assert.ok(content.includes('NCL-11-CN-006'), 'Page must reference NCL-11-CN-006')
  assert.ok(content.includes('QTN-29'), 'Page must reference QTN-29')
  assert.ok(content.includes('height: 38'), 'Page must adhere to 38px button height standard')
  assert.ok(content.includes('minWidth: 96'), 'Modal buttons must adhere to min-width standard')
  assert.ok(!content.includes('font-size: 9px'), 'No tiny fonts (<10px)')
  assert.ok(!content.includes('font-size: 8px'), 'No tiny fonts (<10px)')

  // Check .js extensions on internal imports (PR #232 Review fix)
  assert.ok(content.includes("from '../api/medicalRecordApi.js'"), 'medicalRecordApi must have .js extension')
  assert.ok(content.includes("from '../api/userApi.js'"), 'userApi must have .js extension')
  assert.ok(content.includes("from '../utils/overdueMedicalRecordHelpers.js'"), 'overdueMedicalRecordHelpers must have .js extension')

  // Check medical record status tag (Phát hiện 3 - No IN_PROGRESS label)
  assert.ok(!content.includes('Chưa ký (IN_PROGRESS)'), 'Should not label record as IN_PROGRESS')
  assert.ok(content.includes('formatMedicalRecordStatus'), 'Should format medical record status properly')
})

test('formatMedicalRecordStatus formats DRAFT and OPEN status tags accurately', () => {
  const draft = formatMedicalRecordStatus('DRAFT')
  assert.equal(draft.label, 'Chưa ký số (DRAFT)')
  assert.equal(draft.color, 'orange')

  const open = formatMedicalRecordStatus('OPEN')
  assert.equal(open.label, 'Đang mở (OPEN)')
  assert.equal(open.color, 'cyan')

  const fallback = formatMedicalRecordStatus('')
  assert.equal(fallback.label, 'Chưa ký số (DRAFT)')
  assert.equal(fallback.color, 'orange')
})

// ============================================================================
// Doctor Name Resolution checks
// ============================================================================
test('Doctor Name Resolution: getDoctorDisplayName properly resolves doctor names without showing raw UUID', () => {
  const doctor1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
  const doctor2Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'

  // Resolves from SYSTEM_DOCTORS
  assert.equal(getDoctorDisplayName(doctor1Id), 'BS. Dr. Nguyen Minh Anh')
  assert.equal(getDoctorDisplayName(doctor2Id), 'BS. Dr. Tran Quang Huy')

  // Resolves from custom list
  const customList = [{ id: 'doc-custom', fullName: 'BS. Lê Thị Hoa' }]
  assert.equal(getDoctorDisplayName('doc-custom', customList), 'BS. Lê Thị Hoa')

  // Resolves from current user
  const currentUser = {
    id: 'doc-logged-in',
    username: 'doctor_logged',
    fullName: 'Hoàng Văn Thái',
  }
  assert.equal(getDoctorDisplayName('doc-logged-in', [], currentUser), 'BS. Hoàng Văn Thái')

  // Fallback for unknown UUID
  assert.equal(getDoctorDisplayName('12345678-0000-0000-0000-000000000000'), 'Bác sĩ (12345678...)')
})
