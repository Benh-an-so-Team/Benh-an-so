import test from 'node:test'
import assert from 'node:assert/strict'
import { getCategoryFromIcdCode, getDiseaseGroupName } from '../../utils/icd10Data.js'

export const isDoctorRole = (roles = []) => {
  const allowed = ['admin', 'doctor', 'role_admin', 'role_doctor']
  return roles.some((role) => allowed.includes(String(role).toLowerCase()))
}

export const validateMedicalEncounter = (visitId, formValues, primaryIcd) => {
  const errors = []

  if (!visitId) {
    errors.push('Thiếu visitId của lượt khám')
  }
  if (!formValues?.symptoms || !formValues.symptoms.trim()) {
    errors.push('Vui lòng nhập triệu chứng lâm sàng')
  }
  if (!primaryIcd && (!formValues?.diagnosisText || !formValues.diagnosisText.trim())) {
    errors.push('Vui lòng chọn Mã bệnh ICD-10 hoặc nhập nội dung Chẩn đoán chính!')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export const calculateTotalOrderFee = (orders = []) => {
  return orders.reduce((sum, item) => sum + (Number(item.price) || 0), 0)
}

export const filterIcdOptions = (options = [], query = '') => {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return options
  return options.filter((item) => {
    const code = (item.code || '').toLowerCase()
    const name = (item.name || '').toLowerCase()
    const group = (item.diseaseGroup || item.category || '').toLowerCase()
    return code.includes(q) || name.includes(q) || group.includes(q)
  })
}

export const buildDiagnosisSummary = (primaryIcd, secondaryIcds = []) => {
  if (!primaryIcd?.code) return ''
  const primaryText = `[${primaryIcd.code}] ${primaryIcd.name}`
  const secondaryTexts = (secondaryIcds || [])
    .filter((item) => item?.code)
    .map((item) => `[${item.code}] ${item.name}`)
  return [primaryText, ...secondaryTexts].join('; ')
}

test('1. Kiểm thử THIẾU CHẨN ĐOÁN (Missing Diagnosis Validation)', () => {
  const invalidInput = {
    symptoms: 'Ho, sốt nhẹ 38 độ',
    diagnosisText: '',
  }
  const result1 = validateMedicalEncounter('visit-1', invalidInput, null)
  assert.equal(result1.isValid, false)
  assert.ok(result1.errors.includes('Vui lòng chọn Mã bệnh ICD-10 hoặc nhập nội dung Chẩn đoán chính!'))

  const validInputWithIcd = {
    symptoms: 'Ho, sốt nhẹ 38 độ',
  }
  const primaryIcd = { code: 'J00', name: 'Viêm mũi họng cấp' }
  const result2 = validateMedicalEncounter('visit-1', validInputWithIcd, primaryIcd)
  assert.equal(result2.isValid, true)
  assert.equal(result2.errors.length, 0)

  const validInputWithText = {
    symptoms: 'Đau thắt lưng',
    diagnosisText: 'Thoái hóa cột sống thắt lưng',
  }
  const result3 = validateMedicalEncounter('visit-1', validInputWithText, null)
  assert.equal(result3.isValid, true)
  assert.equal(result3.errors.length, 0)
})

test('4. Không cho mở encounter chỉ bằng patientId', () => {
  const result = validateMedicalEncounter(null, { patientId: 'patient-1', symptoms: 'Đau đầu' }, {
    id: 'catalog-1',
    code: 'R51',
    name: 'Đau đầu',
  })
  assert.equal(result.isValid, false)
  assert.ok(result.errors.includes('Thiếu visitId của lượt khám'))
})

test('2. Kiểm thử QUYỀN TRUY CẬP VÀI TRÒ (User Role Authorization Check)', () => {
  assert.equal(isDoctorRole(['doctor']), true)
  assert.equal(isDoctorRole(['ROLE_DOCTOR']), true)
  assert.equal(isDoctorRole(['admin']), true)

  assert.equal(isDoctorRole(['receptionist']), false)
  assert.equal(isDoctorRole(['pharmacist']), false)
  assert.equal(isDoctorRole(['patient']), false)
  assert.equal(isDoctorRole([]), false)
})

test('3. Kiểm thử TÍNH TỔNG CHI PHÍ CHỈ ĐỊNH CẬN LÂM SÀNG', () => {
  const sampleOrders = [
    { code: 'ORD-001', name: 'Công thức máu', price: 95000 },
    { code: 'ORD-010', name: 'X-quang ngực', price: 120000 },
    { code: 'ORD-012', name: 'Siêu âm bụng', price: 150000 },
  ]
  const total = calculateTotalOrderFee(sampleOrders)
  assert.equal(total, 365000)
})

test('5. Kiểm thử tra cứu mã bệnh ICD-10 và mapping nhóm bệnh', () => {
  const catalog = [
    { id: '1', code: 'J00', name: 'Cảm lạnh thông thường', diseaseGroup: 'Hô hấp' },
    { id: '2', code: 'J06.9', name: 'Nhiễm trùng hô hấp trên cấp', diseaseGroup: 'Hô hấp' },
    { id: '3', code: 'I10', name: 'Tăng huyết áp vô căn', diseaseGroup: 'Tim mạch' },
    { id: '4', code: 'K29.7', name: 'Viêm dạ dày', diseaseGroup: 'Tiêu hóa' },
    { id: '5', code: 'E11.9', name: 'Đái tháo đường típ 2', diseaseGroup: 'Nội tiết' },
  ]

  const searchByCode = filterIcdOptions(catalog, 'j0')
  assert.equal(searchByCode.length, 2)
  assert.equal(searchByCode[0].code, 'J00')
  assert.equal(searchByCode[1].code, 'J06.9')

  const searchByName = filterIcdOptions(catalog, 'dạ dày')
  assert.equal(searchByName.length, 1)
  assert.equal(searchByName[0].code, 'K29.7')

  const searchByGroup = filterIcdOptions(catalog, 'tim mạch')
  assert.equal(searchByGroup.length, 1)
  assert.equal(searchByGroup[0].code, 'I10')

  assert.equal(getDiseaseGroupName('J00', 'Hô hấp'), 'Hô hấp')
  assert.equal(getDiseaseGroupName('I10', ''), 'Tim mạch - Mạch máu')
  assert.equal(getDiseaseGroupName('K29.7', null), 'Tiêu hóa')
})

test('6. Kiểm thử đóng gói kết luận chẩn đoán kèm mã ICD chính và phụ', () => {
  const primary = { code: 'I10', name: 'Tăng huyết áp vô căn' }
  const secondary = [
    { code: 'E11.9', name: 'Đái tháo đường típ 2 không có biến chứng' },
    { code: 'E78.0', name: 'Tăng cholesterol máu' },
  ]

  const summary = buildDiagnosisSummary(primary, secondary)
  assert.equal(
    summary,
    '[I10] Tăng huyết áp vô căn; [E11.9] Đái tháo đường típ 2 không có biến chứng; [E78.0] Tăng cholesterol máu',
  )

  const singleSummary = buildDiagnosisSummary(primary, [])
  assert.equal(singleSummary, '[I10] Tăng huyết áp vô căn')
})
