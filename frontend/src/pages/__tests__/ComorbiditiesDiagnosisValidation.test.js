import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  COMMON_COMORBIDITIES_SUGGESTIONS,
  normalizeComorbidityItem,
  validateCanAddComorbidity,
  validateDiagnosesSubmission,
  formatComorbiditiesSummary,
} from '../../utils/comorbiditiesHelpers.js'
import { buildDiagnosisPayload } from '../../utils/workflowContract.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendSrcDir = path.resolve(__dirname, '../..')

test('NCL-13-CN-006-TC-01: Luồng thành công - Chọn CĐ chính và thêm nhiều bệnh mắc kèm lưu tách bạch', () => {
  // Tiền điều kiện: Bác sĩ đã chọn chẩn đoán chính
  const primaryIcd = {
    id: 'a1000000-0000-0000-0000-000000000019',
    code: 'J00',
    name: 'Viêm mũi họng cấp (cảm thường)',
    note: 'Triệu chứng khởi phát 2 ngày',
  }

  // Hành động: Thêm hai bệnh mắc kèm
  const secondary1 = {
    id: 'a1000000-0000-0000-0000-000000000020',
    code: 'I10',
    name: 'Tăng huyết áp vô căn (nguyên phát)',
    note: 'Độ 2, đang dùng Amlodipine 5mg',
  }

  const secondary2 = {
    id: 'a1000000-0000-0000-0000-000000000021',
    code: 'E11',
    name: 'Đái tháo đường không phụ thuộc insulin (typ 2)',
    note: 'HbA1c 6.8%, kiểm soát ổn định',
  }

  // Kiểm tra có thể thêm secondary1
  const check1 = validateCanAddComorbidity({
    primaryIcd,
    secondaryIcds: [],
    candidateIcd: secondary1,
  })
  assert.equal(check1.valid, true, 'Secondary 1 must be valid to add')

  // Kiểm tra có thể thêm secondary2
  const check2 = validateCanAddComorbidity({
    primaryIcd,
    secondaryIcds: [secondary1],
    candidateIcd: secondary2,
  })
  assert.equal(check2.valid, true, 'Secondary 2 must be valid to add')

  const secondaryIcds = [secondary1, secondary2]

  // Kiểm tra hợp lệ trước khi lưu
  const submissionCheck = validateDiagnosesSubmission({
    primaryIcd,
    secondaryIcds,
  })
  assert.equal(submissionCheck.valid, true, 'Submission check must pass for valid primary and secondaries')
  assert.equal(submissionCheck.errors.length, 0)

  // Kết quả mong đợi: Cả chẩn đoán chính và bệnh mắc kèm được lưu tách bạch
  const payload = buildDiagnosisPayload({
    primaryDiagnosis: primaryIcd,
    secondaryDiagnoses: secondaryIcds,
    note: 'Khám tổng quát',
  })

  // 1. Chẩn đoán chính
  assert.equal(payload.primaryDiagnosis.diagnosisCatalogId, primaryIcd.id)
  assert.equal(payload.primaryDiagnosis.note, primaryIcd.note)

  // 2. Danh sách bệnh mắc kèm
  assert.equal(payload.secondaryDiagnoses.length, 2, 'Must contain 2 secondary diagnoses')
  assert.equal(payload.secondaryDiagnoses[0].diagnosisCatalogId, secondary1.id)
  assert.equal(payload.secondaryDiagnoses[0].note, secondary1.note)
  assert.equal(payload.secondaryDiagnoses[1].diagnosisCatalogId, secondary2.id)
  assert.equal(payload.secondaryDiagnoses[1].note, secondary2.note)

  // 3. Chuỗi tóm tắt phân tách rõ ràng
  const summary = formatComorbiditiesSummary(primaryIcd, secondaryIcds)
  assert.ok(summary.includes('Chẩn đoán chính: [J00] Viêm mũi họng cấp'))
  assert.ok(summary.includes('Bệnh mắc kèm: 1. [I10] Tăng huyết áp vô căn (nguyên phát)'))
  assert.ok(summary.includes('2. [E11] Đái tháo đường không phụ thuộc insulin (typ 2)'))
})

test('NCL-13-CN-006-TC-02: Dữ liệu không hợp lệ - Trùng chẩn đoán chính hoặc trùng danh sách bệnh kèm', () => {
  const primaryIcd = {
    id: 'a1000000-0000-0000-0000-000000000019',
    code: 'J00',
    name: 'Viêm mũi họng cấp',
  }

  const existingSecondary = [
    {
      id: 'a1000000-0000-0000-0000-000000000020',
      code: 'I10',
      name: 'Tăng huyết áp vô căn',
    },
  ]

  // Trường hợp 1: Thêm đúng mã đã là chẩn đoán chính làm bệnh mắc kèm
  const duplicatePrimaryCandidate = {
    id: 'a1000000-0000-0000-0000-000000000019',
    code: 'j00', // Không phân biệt chữ hoa thường
    name: 'Viêm mũi họng cấp',
  }

  const resPrimaryDup = validateCanAddComorbidity({
    primaryIcd,
    secondaryIcds: existingSecondary,
    candidateIcd: duplicatePrimaryCandidate,
  })

  assert.equal(resPrimaryDup.valid, false, 'Should reject candidate matching primary diagnosis')
  assert.equal(resPrimaryDup.type, 'DUPLICATE_PRIMARY')
  assert.ok(
    resPrimaryDup.error.includes('đã được chọn làm chẩn đoán chính'),
    'Error message must indicate duplicate with primary diagnosis'
  )

  // Trường hợp 2: Thêm đúng mã đã có trong danh sách bệnh mắc kèm
  const duplicateSecondaryCandidate = {
    id: 'a1000000-0000-0000-0000-000000000020',
    code: 'I10',
    name: 'Tăng huyết áp',
  }

  const resSecDup = validateCanAddComorbidity({
    primaryIcd,
    secondaryIcds: existingSecondary,
    candidateIcd: duplicateSecondaryCandidate,
  })

  assert.equal(resSecDup.valid, false, 'Should reject candidate matching existing secondary diagnosis')
  assert.equal(resSecDup.type, 'DUPLICATE_SECONDARY')
  assert.ok(
    resSecDup.error.includes('đã có trong danh sách bệnh mắc kèm'),
    'Error message must indicate duplicate in secondary list'
  )

  // Trường hợp 3: Ứng viên rỗng hoặc thiếu thông tin
  const emptyCandidate = { code: '', name: '' }
  const resEmpty = validateCanAddComorbidity({
    primaryIcd,
    secondaryIcds: existingSecondary,
    candidateIcd: emptyCandidate,
  })
  assert.equal(resEmpty.valid, false)
  assert.equal(resEmpty.type, 'EMPTY_DIAGNOSIS')
})

test('NCL-13-CN-006-TC-03: Thiếu dữ liệu - Bác sĩ chỉ nhập bệnh mắc kèm mà thiếu CĐ chính (QTN-22)', () => {
  // Tiền điều kiện: Bác sĩ chỉ nhập bệnh mắc kèm, chưa chọn chẩn đoán chính
  const primaryIcd = null
  const secondaryIcds = [
    {
      id: 'a1000000-0000-0000-0000-000000000020',
      code: 'I10',
      name: 'Tăng huyết áp',
    },
  ]

  // Hành động: Kiểm tra hợp lệ khi lưu chẩn đoán
  const submissionCheck = validateDiagnosesSubmission({
    primaryIcd,
    secondaryIcds,
  })

  // Kết quả mong đợi: Hệ thống chặn và yêu cầu phải có đúng một chẩn đoán chính theo QTN-22
  assert.equal(submissionCheck.valid, false, 'Submission must be invalid when primary diagnosis is missing')
  assert.equal(submissionCheck.errorCode, 'QTN_22_PRIMARY_REQUIRED')
  assert.ok(
    submissionCheck.errors[0].includes('đúng một chẩn đoán chính'),
    'Error message must require exactly one primary diagnosis'
  )

  // Kiểm tra payload generator ném lỗi nếu thiếu primary diagnosis
  assert.throws(
    () => buildDiagnosisPayload({ primaryDiagnosis: null, secondaryDiagnoses: secondaryIcds }),
    /primary diagnosisCatalogId is required/
  )
})

test('Ghi chú lâm sàng cho từng bệnh mắc kèm và chuẩn hóa danh mục', () => {
  const item = {
    id: 'cat-1',
    code: 'E11',
    name: 'Đái tháo đường typ 2',
    diseaseGroup: 'Nội tiết',
    note: 'Mắc 5 năm, có biến chứng võng mạc',
  }

  const normalized = normalizeComorbidityItem(item)
  assert.equal(normalized.code, 'E11')
  assert.equal(normalized.name, 'Đái tháo đường typ 2')
  assert.equal(normalized.note, 'Mắc 5 năm, có biến chứng võng mạc')
  assert.equal(normalized.diseaseGroup, 'Nội tiết')
})

test('Chẩn đoán kèm theo tự do (Free-text name) khi chưa có mã ICD-10 trong danh mục', () => {
  const primaryIcd = {
    id: 'cat-primary',
    code: 'J00',
    name: 'Cảm cúm',
  }

  const freeTextSecondary = {
    id: null,
    code: '',
    name: 'Hội chứng mệt mỏi sau nhiễm virus chưa phân loại',
    note: 'Bệnh nhân than phiền kiệt sức kéo dài',
  }

  const canAdd = validateCanAddComorbidity({
    primaryIcd,
    secondaryIcds: [],
    candidateIcd: freeTextSecondary,
  })
  assert.equal(canAdd.valid, true, 'Free text comorbidity must be allowed when name is present')

  const payload = buildDiagnosisPayload({
    primaryDiagnosis: primaryIcd,
    secondaryDiagnoses: [freeTextSecondary],
  })

  assert.equal(payload.secondaryDiagnoses.length, 1)
  assert.equal(payload.secondaryDiagnoses[0].name, 'Hội chứng mệt mỏi sau nhiễm virus chưa phân loại')
  assert.equal(payload.secondaryDiagnoses[0].note, 'Bệnh nhân than phiền kiệt sức kéo dài')
  assert.equal(payload.secondaryDiagnoses[0].diagnosisCatalogId, undefined)
})

test('COMMON_COMORBIDITIES_SUGGESTIONS chứa danh sách bệnh thường gặp', () => {
  assert.ok(COMMON_COMORBIDITIES_SUGGESTIONS.length >= 8, 'Must have at least 8 common comorbidities')
  const codes = COMMON_COMORBIDITIES_SUGGESTIONS.map((i) => i.code)
  assert.ok(codes.includes('I10'), 'Must include hypertension I10')
  assert.ok(codes.includes('E11'), 'Must include diabetes E11')
  assert.ok(codes.includes('K21'), 'Must include GERD K21')
})

test('File structure and component integration verification', () => {
  // Verify ComorbiditiesSection.jsx exists
  const sectionFile = path.join(frontendSrcDir, 'components', 'clinical', 'ComorbiditiesSection.jsx')
  assert.ok(fs.existsSync(sectionFile), 'ComorbiditiesSection.jsx must exist')
  const sectionContent = fs.readFileSync(sectionFile, 'utf-8')
  assert.ok(sectionContent.includes('ComorbiditiesSection'), 'Must export ComorbiditiesSection')
  assert.ok(sectionContent.includes('COMMON_COMORBIDITIES_SUGGESTIONS'), 'Must use common suggestions')
  assert.ok(sectionContent.includes('DiagnosisCatalogAutocomplete'), 'Must integrate Autocomplete')
  assert.ok(sectionContent.includes('onSwitchToPrimary'), 'Must have switch to primary action')
  assert.ok(sectionContent.includes('onUpdateSecondaryNote'), 'Must support updating notes')

  // Verify MedicalEncounterForm.jsx integrates ComorbiditiesSection
  const formFile = path.join(frontendSrcDir, 'components', 'clinical', 'MedicalEncounterForm.jsx')
  const formContent = fs.readFileSync(formFile, 'utf-8')
  assert.ok(formContent.includes('ComorbiditiesSection'), 'MedicalEncounterForm must integrate ComorbiditiesSection')

  // Verify MedicalEncounter.jsx enforces QTN-22 with validateDiagnosesSubmission
  const encounterFile = path.join(frontendSrcDir, 'pages', 'MedicalEncounter.jsx')
  const encounterContent = fs.readFileSync(encounterFile, 'utf-8')
  assert.ok(encounterContent.includes('validateCanAddComorbidity'), 'MedicalEncounter must use validateCanAddComorbidity')
  assert.ok(encounterContent.includes('validateDiagnosesSubmission'), 'MedicalEncounter must use validateDiagnosesSubmission')
  assert.ok(encounterContent.includes('onUpdateSecondaryNote'), 'MedicalEncounter must pass onUpdateSecondaryNote')
  assert.ok(encounterContent.includes('onSwitchToPrimary'), 'MedicalEncounter must pass onSwitchToPrimary')
})
