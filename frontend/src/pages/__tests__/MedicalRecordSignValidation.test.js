import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateMedicalRecordForSigning,
  generateSimulatedSignatureData,
  parseSignatureData,
  isMedicalRecordSigned,
  isMedicalRecordContentLocked,
} from '../../utils/medicalRecordSignHelpers.js'
import { getApiErrorMessage, DOMAIN_ERROR_MESSAGES } from '../../utils/apiError.js'
import { formatRecordStatus } from '../../utils/helpers.js'
import { RECORD_STATUS_OPTIONS } from '../../utils/constants.js'

test('TC01: Bác sĩ phụ trách lượt khám ghi nhận đầy đủ chẩn đoán và triệu chứng -> Hợp lệ để ký', () => {
  const params = {
    currentUserId: 'doc-001',
    userRoles: ['ROLE_DOCTOR'],
    encounterContext: {
      visit: {
        id: 'vis-001',
        doctorId: 'doc-001',
        status: 'IN_PROGRESS',
      },
      doctor: { id: 'doc-001', fullName: 'BS. Nguyễn Văn A' },
      medicalRecord: { status: 'OPEN' },
    },
    formValues: {
      symptoms: 'Sốt cao, đau họng, ho có đờm',
      chiefComplaint: 'Sốt cao',
      examinationNote: 'Họng đỏ, amidan sưng nhẹ',
      treatmentPlan: 'Nghỉ ngơi, uống nhiều nước',
      conclusion: '[J02.9] Viêm họng cấp',
    },
    primaryIcd: {
      id: 'icd-001',
      code: 'J02.9',
      name: 'Viêm họng cấp',
    },
    recordStatus: 'OPEN',
  }

  const result = validateMedicalRecordForSigning(params)
  assert.equal(result.canSign, true)
  assert.equal(result.reason, null)
  assert.equal(result.missingFields.length, 0)
})

test('TC02: Chưa chọn chẩn đoán chính ICD-10 -> Bị chặn ký với lý do thiếu chẩn đoán', () => {
  const params = {
    currentUserId: 'doc-001',
    userRoles: ['ROLE_DOCTOR'],
    encounterContext: {
      visit: { id: 'vis-001', doctorId: 'doc-001', status: 'IN_PROGRESS' },
      medicalRecord: { status: 'OPEN' },
    },
    formValues: {
      symptoms: 'Đau đầu',
      chiefComplaint: 'Đau đầu',
    },
    primaryIcd: null,
    recordStatus: 'OPEN',
  }

  const result = validateMedicalRecordForSigning(params)
  assert.equal(result.canSign, false)
  assert.match(result.reason, /Chẩn đoán chính/i)
  assert.ok(result.missingFields.includes('Chẩn đoán chính (Mã ICD-10)'))
})

test('TC03: Chưa nhập triệu chứng hoặc lý do khám -> Bị chặn ký với lý do thiếu triệu chứng', () => {
  const params = {
    currentUserId: 'doc-001',
    userRoles: ['ROLE_DOCTOR'],
    encounterContext: {
      visit: { id: 'vis-001', doctorId: 'doc-001', status: 'IN_PROGRESS', reason: '' },
      medicalRecord: { status: 'OPEN' },
    },
    formValues: {
      symptoms: '   ',
      chiefComplaint: '',
      conclusion: 'Viêm họng',
    },
    primaryIcd: { id: 'icd-001', code: 'J02.9', name: 'Viêm họng cấp' },
    recordStatus: 'OPEN',
  }

  const result = validateMedicalRecordForSigning(params)
  assert.equal(result.canSign, false)
  assert.match(result.reason, /Lý do khám \/ Triệu chứng/i)
  assert.ok(result.missingFields.includes('Lý do khám / Triệu chứng bệnh'))
})

test('TC04: Người dùng không phải Bác sĩ (ví dụ Lễ tân, Dược sĩ) -> Bị chặn quyền ký', () => {
  const params = {
    currentUserId: 'staff-001',
    userRoles: ['ROLE_RECEPTIONIST'],
    encounterContext: {
      visit: { id: 'vis-001', doctorId: 'doc-001', status: 'IN_PROGRESS' },
    },
    formValues: { symptoms: 'Sốt', chiefComplaint: 'Sốt' },
    primaryIcd: { id: 'icd-001', code: 'J02.9', name: 'Viêm họng' },
  }

  const result = validateMedicalRecordForSigning(params)
  assert.equal(result.canSign, false)
  assert.match(result.reason, /vai trò Bác sĩ/i)
})

test('TC05: Bác sĩ không phụ trách lượt khám (khác doctorId) -> Bị chặn ký', () => {
  const params = {
    currentUserId: 'doc-999', // Không khớp doc-001
    userRoles: ['ROLE_DOCTOR'],
    encounterContext: {
      visit: { id: 'vis-001', doctorId: 'doc-001', status: 'IN_PROGRESS' },
      doctor: { id: 'doc-001', fullName: 'BS. Người khác' },
    },
    formValues: { symptoms: 'Sốt', chiefComplaint: 'Sốt' },
    primaryIcd: { id: 'icd-001', code: 'J02.9', name: 'Viêm họng' },
  }

  const result = validateMedicalRecordForSigning(params)
  assert.equal(result.canSign, false)
  assert.match(result.reason, /Bác sĩ phụ trách/i)
})

test('TC06: Bệnh án đã SIGNED hoặc LOCKED -> Bị chặn không cho ký lại', () => {
  const signedParams = {
    currentUserId: 'doc-001',
    userRoles: ['ROLE_DOCTOR'],
    encounterContext: {
      visit: { id: 'vis-001', doctorId: 'doc-001', status: 'IN_PROGRESS' },
    },
    formValues: { symptoms: 'Sốt' },
    primaryIcd: { code: 'J02.9', name: 'Viêm họng' },
    recordStatus: 'SIGNED',
  }
  assert.equal(validateMedicalRecordForSigning(signedParams).canSign, false)

  const lockedParams = {
    ...signedParams,
    recordStatus: 'LOCKED',
  }
  assert.equal(validateMedicalRecordForSigning(lockedParams).canSign, false)
})

test('TC07: Lượt khám đã bị HỦY (CANCELLED) hoặc HOÀN TẤT (COMPLETED) -> Bị chặn ký', () => {
  const cancelledVisitParams = {
    currentUserId: 'doc-001',
    userRoles: ['ROLE_DOCTOR'],
    encounterContext: {
      visit: { id: 'vis-001', doctorId: 'doc-001', status: 'CANCELLED' },
    },
    formValues: { symptoms: 'Sốt' },
    primaryIcd: { code: 'J02.9', name: 'Viêm họng' },
    recordStatus: 'OPEN',
  }
  assert.equal(validateMedicalRecordForSigning(cancelledVisitParams).canSign, false)
})

test('TC08: Sinh chuỗi chữ ký số mô phỏng (Simulated Digital Signature Format)', () => {
  const timestamp = 1724400000000
  const sigData = generateSimulatedSignatureData({
    doctorId: 'doc-uuid-123',
    doctorName: 'BS. Lê Thị Mai',
    timestamp,
  })

  assert.ok(sigData.startsWith('SIMULATED_SIGNATURE:doc-uuid-123:1724400000000:'))
  assert.ok(sigData.includes(encodeURIComponent('BS. Lê Thị Mai')))
  assert.ok(sigData.includes('CERT-'))
})

test('TC09: Sinh chuỗi chữ ký số dạng Canvas vẽ tay (Canvas Digital Signature JSON)', () => {
  const drawingBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const sigData = generateSimulatedSignatureData({
    doctorId: 'doc-uuid-123',
    doctorName: 'BS. Lê Thị Mai',
    customSignature: drawingBase64,
  })

  const parsed = JSON.parse(sigData)
  assert.equal(parsed.type, 'CANVAS_DIGITAL_SIGNATURE')
  assert.equal(parsed.doctorId, 'doc-uuid-123')
  assert.equal(parsed.doctorName, 'BS. Lê Thị Mai')
  assert.equal(parsed.signatureDrawing, drawingBase64)
  assert.ok(parsed.certHash.startsWith('CERT-'))
})

test('TC10: Phân tích parseSignatureData đọc chính xác thông tin con dấu điện tử', () => {
  const simulatedString = 'SIMULATED_SIGNATURE:doc-001:1724400000000:BS.%20Nguy%E1%BB%85n%20V%C4%83n%20A:CERT-ABC123'
  const parsedSimulated = parseSignatureData(simulatedString)

  assert.equal(parsedSimulated.isSigned, true)
  assert.equal(parsedSimulated.doctorName, 'BS. Nguyễn Văn A')
  assert.equal(parsedSimulated.certHash, 'CERT-ABC123')
  assert.ok(parsedSimulated.signedAt)

  const jsonString = JSON.stringify({
    type: 'CANVAS_DIGITAL_SIGNATURE',
    doctorName: 'BS. Trần Văn B',
    certHash: 'CERT-XYZ999',
    signedAt: '2026-08-23T10:00:00Z',
    signatureDrawing: 'data:image/png;base64,test',
  })
  const parsedJson = parseSignatureData(jsonString)
  assert.equal(parsedJson.isSigned, true)
  assert.equal(parsedJson.doctorName, 'BS. Trần Văn B')
  assert.equal(parsedJson.certHash, 'CERT-XYZ999')
  assert.equal(parsedJson.drawing, 'data:image/png;base64,test')
})

test('TC11: Helper isMedicalRecordSigned và isMedicalRecordContentLocked kiểm tra chính xác', () => {
  assert.equal(isMedicalRecordSigned('DRAFT'), false)
  assert.equal(isMedicalRecordSigned('OPEN'), false)
  assert.equal(isMedicalRecordSigned('SIGNED'), true)
  assert.equal(isMedicalRecordSigned('LOCKED'), true)
  assert.equal(isMedicalRecordSigned('ARCHIVED'), true)
  assert.equal(isMedicalRecordSigned({ status: 'SIGNED' }), true)
  assert.equal(isMedicalRecordContentLocked('SIGNED'), true)
})

test('TC12: formatRecordStatus và RECORD_STATUS_OPTIONS hiển thị chuẩn trạng thái SIGNED (Đã ký)', () => {
  const statusSigned = formatRecordStatus('SIGNED')
  assert.equal(statusSigned.label, 'Đã ký')
  assert.ok(statusSigned.color)

  const option = RECORD_STATUS_OPTIONS.find((opt) => opt.value === 'SIGNED')
  assert.ok(option)
  assert.equal(option.label, 'Đã ký')
})

test('TC13 & TC14 & TC15: Ánh xạ mã lỗi Backend sang thông điệp tiếng Việt thân thiện', () => {
  const missingDiagErr = {
    response: { data: { code: 'MEDICAL_RECORD_MISSING_DIAGNOSIS' } },
  }
  assert.equal(
    getApiErrorMessage(missingDiagErr),
    'Bệnh án chưa có chẩn đoán. Vui lòng ghi nhận chẩn đoán ICD-10 trước khi ký xác nhận.',
  )

  const unauthSignerErr = {
    response: { data: { code: 'MEDICAL_RECORD_UNAUTHORIZED_SIGNER' } },
  }
  assert.equal(
    getApiErrorMessage(unauthSignerErr),
    'Chỉ bác sĩ phụ trách lượt khám mới có quyền ký xác nhận bệnh án này.',
  )

  const lockedErr = {
    response: { data: { code: 'MEDICAL_RECORD_LOCKED' } },
  }
  assert.equal(
    getApiErrorMessage(lockedErr),
    'Hồ sơ bệnh án đã được ký hoặc khóa, không thể chỉnh sửa trực tiếp.',
  )

  const alreadyLockedErr = {
    response: { data: { code: 'MEDICAL_RECORD_ALREADY_LOCKED' } },
  }
  assert.equal(
    getApiErrorMessage(alreadyLockedErr),
    'Hồ sơ bệnh án đã được ký hoặc khóa, không thể chỉnh sửa trực tiếp.',
  )

  const notSignedErr = {
    response: { data: { code: 'MEDICAL_RECORD_NOT_SIGNED' } },
  }
  assert.equal(
    getApiErrorMessage(notSignedErr),
    'Bệnh án chưa được ký xác nhận. Vui lòng ký bệnh án trước khi hoàn tất hoặc khóa.',
  )
})
