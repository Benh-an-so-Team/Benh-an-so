import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const frontendDir = fs.existsSync(path.resolve('src')) ? process.cwd() : path.resolve('frontend')

test('PatientMedicalHistoryModal.jsx exists and has required features', () => {
  const modalPath = path.join(frontendDir, 'src/components/clinical/PatientMedicalHistoryModal.jsx')
  assert.ok(fs.existsSync(modalPath), 'PatientMedicalHistoryModal.jsx must exist')

  const content = fs.readFileSync(modalPath, 'utf-8')
  assert.ok(content.includes('patientApi.getHistory'), 'Must call patientApi.getHistory to fetch patient medical history')
  assert.ok(content.includes('patientApi.getById'), 'Must fetch patient details')
  assert.ok(content.includes('PatientAllergyBanner'), 'Must include PatientAllergyBanner for drug allergy awareness')
  assert.ok(content.includes('onOpenEncounter'), 'Must support opening encounter details')
  assert.ok(content.includes('getRecordStatusTag'), 'Must format medical record statuses')
  assert.ok(content.includes('getVisitStatusTag'), 'Must format visit statuses')
  assert.ok(content.includes('timeline'), 'Must support timeline view mode')
})

test('AppointmentQueue.jsx computes doctorQueueGroups.completed correctly', () => {
  const apptPath = path.join(frontendDir, 'src/pages/AppointmentQueue.jsx')
  const content = fs.readFileSync(apptPath, 'utf-8')

  assert.ok(
    content.includes("completed: [...items.filter((q) => q.status === 'COMPLETED')]"),
    'Must filter items with status COMPLETED for doctorQueueGroups.completed'
  )
})

test('AppointmentQueue.jsx displays completed patients block in doctor queue tab', () => {
  const apptPath = path.join(frontendDir, 'src/pages/AppointmentQueue.jsx')
  const completedListPath = path.join(frontendDir, 'src/components/appointment-queue/CompletedTodayList.jsx')
  const content = fs.readFileSync(apptPath, 'utf-8') + (fs.existsSync(completedListPath) ? fs.readFileSync(completedListPath, 'utf-8') : '')

  assert.ok(
    content.includes('🟢 BỆNH NHÂN ĐÃ KHÁM XONG TRONG NGÀY'),
    'Must render 🟢 BỆNH NHÂN ĐÃ KHÁM XONG TRONG NGÀY section in doctor_queue'
  )
  assert.ok(
    content.includes('Xem lại bệnh án'),
    'Must provide button to view medical record of completed patient'
  )
  assert.ok(
    content.includes('FileTextOutlined'),
    'Must import FileTextOutlined from @ant-design/icons'
  )
})

test('AppointmentQueue.jsx provides patient history buttons across queue cards', () => {
  const apptPath = path.join(frontendDir, 'src/pages/AppointmentQueue.jsx')
  const content = fs.readFileSync(apptPath, 'utf-8')

  assert.ok(
    content.includes('openPatientHistory'),
    'Must define openPatientHistory handler'
  )
  assert.ok(
    content.includes('PatientMedicalHistoryModal'),
    'Must mount PatientMedicalHistoryModal in AppointmentQueue'
  )
})

test('AppointmentQueue.jsx provides dedicated completed_history tab for doctors', () => {
  const apptPath = path.join(frontendDir, 'src/pages/AppointmentQueue.jsx')
  const content = fs.readFileSync(apptPath, 'utf-8')

  assert.ok(
    content.includes("key: 'completed_history'"),
    'Must define completed_history tab key'
  )
  assert.ok(
    content.includes("Lịch Sử Bệnh Nhân Đã Khám"),
    'Must have Lịch Sử Bệnh Nhân Đã Khám label'
  )
  assert.ok(
    content.includes("['doctor_queue', 'completed_history'].includes(item.key)"),
    'Doctor role must have access to both doctor_queue and completed_history tabs'
  )
})
