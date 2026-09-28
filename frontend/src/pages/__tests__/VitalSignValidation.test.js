import test from 'node:test'
import assert from 'node:assert/strict'

import {
  VITAL_SIGN_LIMITS,
  ABNORMAL_FLAGS_META,
  calculateBmi,
  getBmiCategory,
  evaluateAbnormalFlags,
  validateVitalSignForm,
  formatBloodPressure,
  parseBloodPressureString,
  mapVitalSignErrorMessage,
  canUserManageVitalSigns,
} from '../../utils/vitalSignHelpers.js'
import { vitalSignApi } from '../../api/vitalSignApi.js'

test('NCL-04-CN-007-TC-01: Luồng thành công - Nhập đầy đủ chỉ số hợp lệ', () => {
  const input = {
    pulse: 75,
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    temperature: '37.0',
    respiratoryRate: 16,
    weight: 65,
    height: 170,
    spo2: 98,
    note: 'Bệnh nhân nghỉ ngơi trước đo 5 phút',
  }

  const validation = validateVitalSignForm(input)
  assert.strictEqual(validation.valid, true, 'Validation phải thành công')
  assert.deepStrictEqual(validation.errors, {})

  // BMI calculation: 65 / (1.7^2) = 65 / 2.89 = 22.491 -> 22.5
  const bmi = calculateBmi(input.weight, input.height)
  assert.strictEqual(bmi, 22.5)

  const bmiCat = getBmiCategory(bmi)
  assert.strictEqual(bmiCat.label, 'Bình thường')
  assert.strictEqual(bmiCat.tag, 'NORMAL')

  // Không có chỉ số bất thường
  const flags = evaluateAbnormalFlags({ ...input, bmi })
  assert.strictEqual(flags.length, 0, 'Chỉ số bình thường không sinh cờ bất thường')
})

test('NCL-04-CN-007-TC-02: Dữ liệu không hợp lệ - Nhiệt độ 90°C bị từ chối ngoài khoảng', () => {
  const input = {
    temperature: '90.0',
  }

  const validation = validateVitalSignForm(input)
  assert.strictEqual(validation.valid, false, 'Phải từ chối nhiệt độ 90°C')
  assert.ok(
    validation.errors.temperature?.includes('Nhiệt độ ngoài khoảng hợp lệ'),
    'Thông báo lỗi phải nêu rõ ngoài khoảng hợp lệ',
  )
})

test('NCL-04-CN-007-TC-02: Dữ liệu không hợp lệ - Mạch ngoài khoảng (30 - 250)', () => {
  const tooLow = validateVitalSignForm({ pulse: 25 })
  assert.strictEqual(tooLow.valid, false)
  assert.ok(tooLow.errors.pulse?.includes('Mạch ngoài khoảng hợp lệ'))

  const tooHigh = validateVitalSignForm({ pulse: 280 })
  assert.strictEqual(tooHigh.valid, false)
  assert.ok(tooHigh.errors.pulse?.includes('Mạch ngoài khoảng hợp lệ'))
})

test('NCL-04-CN-007-TC-02: Dữ liệu không hợp lệ - Huyết áp tâm thu <= tâm trương', () => {
  const input = {
    bloodPressureSystolic: 80,
    bloodPressureDiastolic: 120,
  }

  const validation = validateVitalSignForm(input)
  assert.strictEqual(validation.valid, false)
  assert.ok(
    validation.errors.bloodPressure?.includes('Huyết áp tâm thu phải lớn hơn huyết áp tâm trương'),
  )

  const equalBp = validateVitalSignForm({
    bloodPressureSystolic: 100,
    bloodPressureDiastolic: 100,
  })
  assert.strictEqual(equalBp.valid, false)
  assert.ok(
    equalBp.errors.bloodPressure?.includes('Huyết áp tâm thu phải lớn hơn huyết áp tâm trương'),
  )
})

test('NCL-04-CN-007-TC-02: Dữ liệu không hợp lệ - Nhịp thở, SpO2, Cân nặng, Chiều cao', () => {
  // Nhịp thở ngoài khoảng 5 - 60
  assert.strictEqual(validateVitalSignForm({ respiratoryRate: 2 }).valid, false)
  assert.strictEqual(validateVitalSignForm({ respiratoryRate: 70 }).valid, false)

  // SpO2 ngoài khoảng 50 - 100
  assert.strictEqual(validateVitalSignForm({ spo2: 45 }).valid, false)
  assert.strictEqual(validateVitalSignForm({ spo2: 105 }).valid, false)

  // Cân nặng ngoài khoảng 0.5 - 300.0
  assert.strictEqual(validateVitalSignForm({ weight: 0.2 }).valid, false)
  assert.strictEqual(validateVitalSignForm({ weight: 350 }).valid, false)

  // Chiều cao ngoài khoảng 20.0 - 250.0
  assert.strictEqual(validateVitalSignForm({ height: 10 }).valid, false)
  assert.strictEqual(validateVitalSignForm({ height: 300 }).valid, false)

  // Không nhập chỉ số nào
  const emptyValidation = validateVitalSignForm({})
  assert.strictEqual(emptyValidation.valid, false)
  assert.ok(emptyValidation.errors.general?.includes('Cần nhập ít nhất một chỉ số sinh tồn'))

  // Ghi chú quá 500 ký tự
  const longNote = 'A'.repeat(501)
  assert.strictEqual(validateVitalSignForm({ pulse: 75, note: longNote }).valid, false)
})

test('NCL-04-CN-007-TC-03: Cảnh báo vượt ngưỡng - Huyết áp cao và Sốt được đánh dấu nổi bật', () => {
  // Huyết áp cao (Tâm thu >= 140 hoặc Tâm trương >= 90)
  const highBp = evaluateAbnormalFlags({
    bloodPressureSystolic: 150,
    bloodPressureDiastolic: 95,
  })
  assert.ok(highBp.includes('HYPERTENSION'), 'Phải phát hiện HYPERTENSION')
  assert.strictEqual(ABNORMAL_FLAGS_META.HYPERTENSION.label, 'Huyết áp cao')
  assert.strictEqual(ABNORMAL_FLAGS_META.HYPERTENSION.color, 'red')

  // Huyết áp thấp (Tâm thu < 90 hoặc Tâm trương < 60)
  const lowBp = evaluateAbnormalFlags({
    bloodPressureSystolic: 85,
    bloodPressureDiastolic: 55,
  })
  assert.ok(lowBp.includes('HYPOTENSION'))

  // Sốt (Nhiệt độ > 37.5)
  const fever = evaluateAbnormalFlags({
    temperature: '38.5',
  })
  assert.ok(fever.includes('FEVER'), 'Phải phát hiện FEVER')
  assert.strictEqual(ABNORMAL_FLAGS_META.FEVER.label, 'Sốt')

  // Hạ thân nhiệt (Nhiệt độ < 36.0)
  const hypothermia = evaluateAbnormalFlags({
    temperature: '35.2',
  })
  assert.ok(hypothermia.includes('HYPOTHERMIA'))

  // Nhịp tim nhanh (> 100) và Nhịp tim chậm (< 60)
  assert.ok(evaluateAbnormalFlags({ pulse: 115 }).includes('TACHYCARDIA'))
  assert.ok(evaluateAbnormalFlags({ pulse: 52 }).includes('BRADYCARDIA'))

  // Nhịp thở nhanh (> 20) và chậm (< 12)
  assert.ok(evaluateAbnormalFlags({ respiratoryRate: 26 }).includes('TACHYPNEA'))
  assert.ok(evaluateAbnormalFlags({ respiratoryRate: 9 }).includes('BRADYPNEA'))

  // Giảm oxy máu (SpO2 < 95%)
  assert.ok(evaluateAbnormalFlags({ spo2: 91 }).includes('HYPOXEMIA'))

  // Thừa cân / Thiếu cân
  assert.ok(evaluateAbnormalFlags({ weight: 90, height: 165 }).includes('OVERWEIGHT'))
  assert.ok(evaluateAbnormalFlags({ weight: 40, height: 170 }).includes('UNDERWEIGHT'))
})

test('NCL-04-CN-007-TC-04: Lịch sử diễn tiến - Sắp xếp theo trình tự thời gian qua các lượt khám', () => {
  const records = [
    { id: '1', recordedAt: '2026-09-10T08:00:00Z', pulse: 80, bloodPressureSystolic: 120, bloodPressureDiastolic: 80 },
    { id: '2', recordedAt: '2026-09-15T09:30:00Z', pulse: 95, bloodPressureSystolic: 135, bloodPressureDiastolic: 85 },
    { id: '3', recordedAt: '2026-09-17T07:15:00Z', pulse: 72, bloodPressureSystolic: 118, bloodPressureDiastolic: 78 },
  ]

  // Sắp xếp giảm dần theo thời gian (mới nhất đầu tiên)
  const sortedDesc = [...records].sort(
    (a, b) => new Date(b.recordedAt) - new Date(a.recordedAt),
  )

  assert.strictEqual(sortedDesc[0].id, '3')
  assert.strictEqual(sortedDesc[1].id, '2')
  assert.strictEqual(sortedDesc[2].id, '1')

  // Kiểm tra helper formatBloodPressure
  assert.strictEqual(formatBloodPressure(120, 80), '120/80 mmHg')
  assert.strictEqual(formatBloodPressure(null, null), '—')

  // Kiểm tra helper parseBloodPressureString
  assert.deepStrictEqual(parseBloodPressureString('130/85'), { systolic: 130, diastolic: 85 })
  assert.deepStrictEqual(parseBloodPressureString('140 / 90'), { systolic: 140, diastolic: 90 })
  assert.deepStrictEqual(parseBloodPressureString('invalid'), { systolic: null, diastolic: null })
})

test('QTN-07 & QTN-02: Kiểm tra phân quyền và ánh xạ thông điệp lỗi Backend', () => {
  // QTN-07: Lỗi khi lượt khám không hợp lệ
  const visitStatusErr = {
    response: {
      data: { code: 'VISIT_INVALID_STATUS', message: 'Chỉ được ghi nhận chỉ số sinh tồn khi lượt khám đang diễn ra.' },
    },
  }
  assert.ok(
    mapVitalSignErrorMessage(visitStatusErr).includes('Chỉ được ghi nhận chỉ số sinh tồn khi lượt khám đang diễn ra'),
  )

  // QTN-07: Bệnh án đã khóa
  const lockedErr = {
    response: {
      data: { code: 'MEDICAL_RECORD_LOCKED', message: 'Bệnh án đã được ký số' },
    },
  }
  assert.ok(
    mapVitalSignErrorMessage(lockedErr).includes('Bệnh án đã được ký số hoặc bị khóa nội dung (QTN-07)'),
  )

  // QTN-02 & Quyền: Bác sĩ khác không có quyền
  const permErr = {
    response: {
      status: 403,
      data: { message: 'Chỉ bác sĩ phụ trách lượt khám mới có quyền ghi/sửa chỉ số sinh tồn.' },
    },
  }
  assert.strictEqual(
    mapVitalSignErrorMessage(permErr),
    'Chỉ bác sĩ phụ trách lượt khám mới có quyền ghi/sửa chỉ số sinh tồn.',
  )

  // Kiểm tra helper canUserManageVitalSigns
  const doctorUser = { id: 'doc-123', roles: ['ROLE_DOCTOR'] }
  assert.strictEqual(canUserManageVitalSigns(doctorUser, 'doc-123'), true)
  assert.strictEqual(canUserManageVitalSigns(doctorUser, 'doc-other'), false)

  const adminUser = { id: 'admin-1', roles: ['ROLE_ADMIN'] }
  assert.strictEqual(canUserManageVitalSigns(adminUser, 'doc-other'), true)
})

test('vitalSignApi: Kiểm tra cấu hình endpoints và methods', () => {
  assert.strictEqual(typeof vitalSignApi.record, 'function')
  assert.strictEqual(typeof vitalSignApi.update, 'function')
  assert.strictEqual(typeof vitalSignApi.getById, 'function')
  assert.strictEqual(typeof vitalSignApi.getByVisitId, 'function')
  assert.strictEqual(typeof vitalSignApi.getPatientHistory, 'function')
})
