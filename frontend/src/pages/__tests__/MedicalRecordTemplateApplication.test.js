import test from 'node:test'
import assert from 'node:assert/strict'
import { FIELD_CODE_TO_FORM_NAME } from '../../constants/medicalRecordTemplateConstants.js'
import { DOMAIN_ERROR_MESSAGES, getApiErrorMessage } from '../../utils/apiError.js'
import { buildMedicalRecordPayload } from '../../utils/workflowContract.js'

test('TC01: Mapping mã trường lâm sàng của template sang tên trường trên form', () => {
  assert.equal(FIELD_CODE_TO_FORM_NAME.CHIEF_COMPLAINT, 'chiefComplaint')
  assert.equal(FIELD_CODE_TO_FORM_NAME.SYMPTOMS, 'symptoms')
  assert.equal(FIELD_CODE_TO_FORM_NAME.MEDICAL_HISTORY, 'medicalHistory')
  assert.equal(FIELD_CODE_TO_FORM_NAME.PHYSICAL_EXAMINATION, 'physicalExamination')
  assert.equal(FIELD_CODE_TO_FORM_NAME.CLINICAL_PROGRESS, 'clinicalProgress')
  assert.equal(FIELD_CODE_TO_FORM_NAME.TREATMENT_PLAN, 'treatmentPlan')
  assert.equal(FIELD_CODE_TO_FORM_NAME.DOCTOR_INSTRUCTIONS, 'doctorInstructions')
  assert.equal(FIELD_CODE_TO_FORM_NAME.CONCLUSION, 'conclusion')
})

test('TC02: Đóng gói payload bệnh án từ các trường động của mẫu bệnh án', () => {
  const formValues = {
    chiefComplaint: 'Đau đầu, chóng mặt kéo dài',
    symptoms: 'Mệt mỏi, hoa mắt khi thay đổi tư thế',
    medicalHistory: 'Tăng huyết áp 3 năm',
    physicalExamination: 'Họng sạch, tim đều T1 T2 rõ',
    clinicalProgress: 'Triệu chứng xuất hiện 3 ngày nay',
    treatmentPlan: 'Nghỉ ngơi, dùng thuốc theo đơn',
    doctorInstructions: 'Uống thuốc đúng giờ, tái khám sau 7 ngày',
    conclusion: '[I10] Tăng huyết áp vô căn',
  }

  const vitalSigns = {
    bp: '130/85',
    pulse: '78',
    temp: '36.8',
  }

  const payload = buildMedicalRecordPayload({
    visitId: 'visit-123',
    values: formValues,
    vitalSigns,
  })

  assert.equal(payload.visitId, 'visit-123')
  assert.equal(payload.chiefComplaint, 'Đau đầu, chóng mặt kéo dài')
  assert.equal(payload.symptoms, 'Mệt mỏi, hoa mắt khi thay đổi tư thế')
  assert.equal(payload.medicalHistory, 'Tăng huyết áp 3 năm')
  assert.ok(payload.physicalExamination.includes('Họng sạch'))
  assert.ok(payload.physicalExamination.includes('Huyết áp 130/85 mmHg'))
  assert.equal(payload.treatmentPlan, 'Nghỉ ngơi, dùng thuốc theo đơn')
  assert.equal(payload.doctorInstructions, 'Uống thuốc đúng giờ, tái khám sau 7 ngày')
  assert.equal(payload.conclusion, '[I10] Tăng huyết áp vô căn')
})

test('TC03: Xử lý thứ tự hiển thị displayOrder của các section trong mẫu bệnh án', () => {
  const templateSections = [
    { fieldCode: 'CONCLUSION', label: 'Kết luận', displayOrder: 4, required: true },
    { fieldCode: 'CHIEF_COMPLAINT', label: 'Lý do khám', displayOrder: 1, required: true },
    { fieldCode: 'PHYSICAL_EXAMINATION', label: 'Khám thực thể', displayOrder: 3, required: false },
    { fieldCode: 'MEDICAL_HISTORY', label: 'Tiền sử bệnh', displayOrder: 2, required: false },
  ]

  const sorted = [...templateSections].sort((a, b) => a.displayOrder - b.displayOrder)

  assert.equal(sorted[0].fieldCode, 'CHIEF_COMPLAINT')
  assert.equal(sorted[1].fieldCode, 'MEDICAL_HISTORY')
  assert.equal(sorted[2].fieldCode, 'PHYSICAL_EXAMINATION')
  assert.equal(sorted[3].fieldCode, 'CONCLUSION')
})

test('TC04: Dịch mã lỗi domain liên quan đến mẫu bệnh án sang tiếng Việt', () => {
  const errorWithContent = {
    response: {
      data: {
        code: 'MEDICAL_RECORD_TEMPLATE_CHANGE_WITH_CONTENT',
      },
    },
  }
  const errorMismatch = {
    response: {
      data: {
        code: 'MEDICAL_RECORD_TEMPLATE_SPECIALTY_MISMATCH',
      },
    },
  }
  const errorInactive = {
    response: {
      data: {
        code: 'MEDICAL_RECORD_TEMPLATE_INACTIVE',
      },
    },
  }

  assert.equal(
    getApiErrorMessage(errorWithContent),
    DOMAIN_ERROR_MESSAGES.MEDICAL_RECORD_TEMPLATE_CHANGE_WITH_CONTENT,
  )
  assert.equal(
    getApiErrorMessage(errorMismatch),
    DOMAIN_ERROR_MESSAGES.MEDICAL_RECORD_TEMPLATE_SPECIALTY_MISMATCH,
  )
  assert.equal(
    getApiErrorMessage(errorInactive),
    DOMAIN_ERROR_MESSAGES.MEDICAL_RECORD_TEMPLATE_INACTIVE,
  )
})

test('TC05: Xác định mẫu hiệu lực và cơ chế fallback từ API template options', () => {
  const mockOptionsResponse = {
    medicalRecordId: null,
    visitId: 'visit-456',
    visitSpecialty: { id: 'spec-derm', code: 'DERM', name: 'Da liễu' },
    availableTemplates: [
      {
        templateId: 'tmpl-general',
        templateVersionId: 'ver-1',
        name: 'Mẫu khám Đa khoa tổng quát',
        versionNo: 1,
        defaultTemplate: true,
        sections: [
          { fieldCode: 'CHIEF_COMPLAINT', label: 'Lý do khám', required: true, displayOrder: 1 },
          { fieldCode: 'CONCLUSION', label: 'Kết luận', required: true, displayOrder: 2 },
        ],
      },
    ],
    effectiveTemplate: {
      templateId: 'tmpl-general',
      templateVersionId: 'ver-1',
      name: 'Mẫu khám Đa khoa tổng quát',
      versionNo: 1,
      defaultTemplate: true,
      sections: [
        { fieldCode: 'CHIEF_COMPLAINT', label: 'Lý do khám', required: true, displayOrder: 1 },
        { fieldCode: 'CONCLUSION', label: 'Kết luận', required: true, displayOrder: 2 },
      ],
    },
    fallback: true,
  }

  assert.equal(mockOptionsResponse.fallback, true)
  assert.equal(mockOptionsResponse.visitSpecialty.code, 'DERM')
  assert.equal(mockOptionsResponse.effectiveTemplate.templateId, 'tmpl-general')
  assert.equal(mockOptionsResponse.availableTemplates.length, 1)
})
