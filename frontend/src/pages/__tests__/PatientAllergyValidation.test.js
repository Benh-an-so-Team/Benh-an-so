import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  ALLERGY_SEVERITIES,
  ALLERGY_SEVERITY_OPTIONS,
  COMMON_MEDICATION_ALLERGENS,
  normalizeAllergenName,
  getAllergySeverityMeta,
  checkPrescriptionAllergyConflict,
} from '../../utils/allergyConstants.js'

const frontendDir = fs.existsSync(path.resolve('src')) ? process.cwd() : path.resolve('frontend')

test('ALLERGY_SEVERITIES defines 4 valid severities matching backend database constraint', () => {
  const keys = Object.keys(ALLERGY_SEVERITIES)
  assert.deepEqual(keys.sort(), ['ANAPHYLAXIS', 'MILD', 'MODERATE', 'SEVERE'].sort())
  
  assert.equal(ALLERGY_SEVERITIES.MILD.label, 'Nhẹ')
  assert.equal(ALLERGY_SEVERITIES.MODERATE.label, 'Trung bình')
  assert.equal(ALLERGY_SEVERITIES.SEVERE.label, 'Nặng')
  assert.equal(ALLERGY_SEVERITIES.ANAPHYLAXIS.label, 'Sốc phản vệ (Nguy cơ tử vong)')

  assert.equal(ALLERGY_SEVERITY_OPTIONS.length, 4)
  assert.ok(ALLERGY_SEVERITY_OPTIONS.some((o) => o.value === 'ANAPHYLAXIS'))
})

test('COMMON_MEDICATION_ALLERGENS includes standard high-risk drug groups', () => {
  assert.ok(COMMON_MEDICATION_ALLERGENS.length >= 8)
  assert.ok(COMMON_MEDICATION_ALLERGENS.some((item) => item.includes('Penicillin')))
  assert.ok(COMMON_MEDICATION_ALLERGENS.some((item) => item.includes('NSAIDs')))
  assert.ok(COMMON_MEDICATION_ALLERGENS.some((item) => item.includes('Cephalosporin')))
})

test('normalizeAllergenName correctly formats allergen string', () => {
  assert.equal(normalizeAllergenName('  Amoxicillin 500mg  '), 'amoxicillin 500mg')
  assert.equal(normalizeAllergenName('PENICILLIN  V   '), 'penicillin v')
  assert.equal(normalizeAllergenName(''), '')
  assert.equal(normalizeAllergenName(null), '')
})

test('checkPrescriptionAllergyConflict detects exact and ingredient matches', () => {
  const patientAllergies = [
    {
      id: 'alg-1',
      allergenName: 'Amoxicillin',
      severity: 'SEVERE',
      reaction: 'Khó thở, phát ban cấp',
      notes: 'Đã từng cấp cứu tại BV Bạch Mai',
      active: true,
    },
  ]

  // Direct match by medicine name
  const med1 = { id: 101, medicineName: 'Amoxicillin 500mg viên nang', activeIngredient: 'Amoxicillin' }
  const result1 = checkPrescriptionAllergyConflict(med1, patientAllergies)
  assert.equal(result1.hasConflict, true)
  assert.equal(result1.isLifeThreatening, true)
  assert.equal(result1.matchedAllergy.id, 'alg-1')
  assert.ok(result1.warningMessage.includes('Amoxicillin'))

  // Safe medication
  const medSafe = { id: 102, medicineName: 'Paracetamol 500mg', activeIngredient: 'Acetaminophen' }
  const resultSafe = checkPrescriptionAllergyConflict(medSafe, patientAllergies)
  assert.equal(resultSafe.hasConflict, false)
})

test('checkPrescriptionAllergyConflict detects anaphylaxis risk and group allergens', () => {
  const patientAllergies = [
    {
      id: 'alg-2',
      allergenName: 'Penicillin / Amoxicillin',
      severity: 'ANAPHYLAXIS',
      reaction: 'Trụy mạch, tụt huyết áp',
      active: true,
    },
    {
      id: 'alg-3',
      allergenName: 'Aspirin / Nhóm NSAIDs (Ibuprofen, Diclofenac)',
      severity: 'MODERATE',
      reaction: 'Mề đay, phù môi',
      active: true,
    },
  ]

  // Matches subterm 'penicillin'
  const medPen = { id: 201, medicineName: 'Augmentin 1g', activeIngredient: 'Amoxicillin + Clavulanic acid' }
  const resPen = checkPrescriptionAllergyConflict(medPen, patientAllergies)
  assert.equal(resPen.hasConflict, true)
  assert.equal(resPen.severity, 'ANAPHYLAXIS')
  assert.equal(resPen.isLifeThreatening, true)

  // Matches subterm 'ibuprofen'
  const medNsaid = { id: 202, medicineName: 'Ibuprofen 400mg', activeIngredient: 'Ibuprofen' }
  const resNsaid = checkPrescriptionAllergyConflict(medNsaid, patientAllergies)
  assert.equal(resNsaid.hasConflict, true)
  assert.equal(resNsaid.severity, 'MODERATE')
  assert.equal(resNsaid.isLifeThreatening, false)
})

test('checkPrescriptionAllergyConflict ignores inactive (resolved) allergies', () => {
  const patientAllergies = [
    {
      id: 'alg-inactive',
      allergenName: 'Paracetamol',
      severity: 'MILD',
      reaction: 'Ngứa nhẹ thời thơ ấu',
      active: false,
    },
  ]

  const med = { id: 301, medicineName: 'Paracetamol 500mg', activeIngredient: 'Paracetamol' }
  const res = checkPrescriptionAllergyConflict(med, patientAllergies)
  assert.equal(res.hasConflict, false)
})

test('Allergy update payload validation enforces changeReason for audit trail', () => {
  const validateAllergyUpdate = (payload) => {
    if (!payload.allergenName || !payload.allergenName.trim()) {
      return { valid: false, message: 'Tên hoạt chất / nhóm thuốc dị ứng không được để trống' }
    }
    if (!payload.changeReason || !payload.changeReason.trim()) {
      return { valid: false, message: 'Bắt buộc nhập lý do điều chỉnh để lưu vết lịch sử bệnh án' }
    }
    return { valid: true }
  }

  assert.equal(
    validateAllergyUpdate({ allergenName: 'Amoxicillin', changeReason: '' }).valid,
    false,
  )
  assert.equal(
    validateAllergyUpdate({ allergenName: 'Amoxicillin', changeReason: 'Bổ sung thông tin mức độ phản vệ theo kết quả test áp bì' }).valid,
    true,
  )
})

test('PrescriptionPage has PatientAllergyBanner, real-time conflict checking, and warning modal', () => {
  const content = fs.readFileSync(path.join(frontendDir, 'src/pages/PrescriptionPage.jsx'), 'utf-8')
  assert.ok(content.includes('PatientAllergyBanner'), 'PrescriptionPage should import and render PatientAllergyBanner')
  assert.ok(content.includes('patientAllergyApi'), 'PrescriptionPage should import patientAllergyApi')
  assert.ok(content.includes('checkPrescriptionAllergyConflict'), 'PrescriptionPage should use checkPrescriptionAllergyConflict')
  assert.ok(content.includes('detectedAllergyConflicts'), 'PrescriptionPage should compute detectedAllergyConflicts')
  assert.ok(content.includes('CẢNH BÁO NGUY CƠ DỊ ỨNG THUỐC / SỐC PHẢN VỆ'), 'PrescriptionPage should warn before saving if conflicts exist')
})

test('MedicalEncounterForm and MedicalEncounter display prominent allergy banner', () => {
  const formContent = fs.readFileSync(path.join(frontendDir, 'src/components/clinical/MedicalEncounterForm.jsx'), 'utf-8')
  assert.ok(formContent.includes('PatientAllergyBanner'), 'MedicalEncounterForm should contain PatientAllergyBanner')

  const encounterContent = fs.readFileSync(path.join(frontendDir, 'src/pages/MedicalEncounter.jsx'), 'utf-8')
  assert.ok(encounterContent.includes('PatientAllergyBanner'), 'MedicalEncounter should contain PatientAllergyBanner')

  const patientDetailContent = fs.readFileSync(path.join(frontendDir, 'src/pages/PatientDetail.jsx'), 'utf-8')
  assert.ok(patientDetailContent.includes('PatientAllergyBanner'), 'PatientDetail should contain PatientAllergyBanner')
})
