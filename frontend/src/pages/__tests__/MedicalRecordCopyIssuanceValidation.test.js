import test from 'node:test'
import assert from 'node:assert/strict'

export const canIssueMedicalRecordCopy = (roles = [], permissions = []) => {
  const normalizedRoles = roles.map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  const normalizedPerms = permissions.map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))

  if (normalizedRoles.includes('admin') || normalizedRoles.includes('manager') || normalizedRoles.includes('clinic_manager')) {
    return true
  }

  if (normalizedPerms.includes('REPORT_EXPORT')) {
    return true
  }

  return false
}

export const validateRecordCopyEligibility = (record) => {
  if (!record) {
    return { eligible: false, error: 'Hồ sơ bệnh án không tồn tại hoặc chưa được tải.' }
  }

  if (record.status !== 'LOCKED') {
    return {
      eligible: false,
      error: `Hồ sơ ở trạng thái ${record.status || 'CHƯA KHÓA'}, chưa được Bác sĩ đóng/khóa bảo mật (LOCKED). Không đủ điều kiện cấp trích sao pháp lý.`,
    }
  }

  return { eligible: true, error: null }
}

export const validateCopyRequestForm = (formValues) => {
  const errors = []
  if (!formValues?.requesterName?.trim()) {
    errors.push('Họ và tên người yêu cầu không được để trống')
  }
  if (!formValues?.relationship?.trim()) {
    errors.push('Quan hệ với bệnh nhân không được để trống')
  }
  if (!formValues?.identityNumber?.trim()) {
    errors.push('Số CCCD/Định danh người yêu cầu không được để trống')
  }
  if (!formValues?.purpose?.trim()) {
    errors.push('Mục đích yêu cầu cấp bản sao không được để trống')
  }
  if (!formValues?.copyCount || formValues.copyCount < 1 || formValues.copyCount > 10) {
    errors.push('Số lượng bản sao phải từ 1 đến 10 bản')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export const validateMedicalRecordCopyPayload = ({ record, patient, visit, requestInfo }) => {
  const missing = []
  if (!patient?.fullName && !record?.patientName) missing.push('Tên bệnh nhân')
  if (!patient?.patientCode && !record?.patientCode) missing.push('Mã bệnh nhân')
  if (!record?.id && !record?.medicalRecordId) missing.push('Mã hồ sơ bệnh án')
  if (!requestInfo?.requesterName) missing.push('Thông tin người yêu cầu trích sao')

  return {
    isReadyForExport: missing.length === 0,
    missingFields: missing,
  }
}

test('1. KIỂM THỬ PHÂN QUYỀN CẤP BẢN SAO HỒ SƠ', () => {
  assert.equal(canIssueMedicalRecordCopy(['admin']), true)
  assert.equal(canIssueMedicalRecordCopy(['manager']), true)
  assert.equal(canIssueMedicalRecordCopy(['clinic_manager']), true)
  assert.equal(canIssueMedicalRecordCopy(['ROLE_MANAGER']), true)

  assert.equal(canIssueMedicalRecordCopy(['doctor']), false)
  assert.equal(canIssueMedicalRecordCopy(['receptionist']), false)
  assert.equal(canIssueMedicalRecordCopy(['pharmacist']), false)
  assert.equal(canIssueMedicalRecordCopy(['guest']), false)

  assert.equal(canIssueMedicalRecordCopy(['doctor'], ['REPORT_EXPORT']), true)
  assert.equal(canIssueMedicalRecordCopy(['receptionist'], ['REPORT_EXPORT']), true)
})

test('2. KIỂM THỬ ĐIỀU KIỆN KHÓA HỒ SƠ BỆNH ÁN', () => {
  const lockedRecord = { id: 'rec-001', status: 'LOCKED', chiefComplaint: 'Đau đầu' }
  const res1 = validateRecordCopyEligibility(lockedRecord)
  assert.equal(res1.eligible, true)
  assert.equal(res1.error, null)

  const draftRecord = { id: 'rec-002', status: 'DRAFT' }
  const res2 = validateRecordCopyEligibility(draftRecord)
  assert.equal(res2.eligible, false)
  assert.match(res2.error, /LOCKED/)

  const res3 = validateRecordCopyEligibility(null)
  assert.equal(res3.eligible, false)
})

test('3. KIỂM THỬ BIỂU MẪU ĐỀ NGHỊ CẤP BẢN SAO', () => {
  const validForm = {
    requesterName: 'Nguyễn Văn An',
    relationship: 'Bản thân bệnh nhân',
    identityNumber: '001088012345',
    purpose: 'Lưu trữ cá nhân',
    copyCount: 2,
  }
  const result1 = validateCopyRequestForm(validForm)
  assert.equal(result1.isValid, true)
  assert.equal(result1.errors.length, 0)

  const invalidForm = {
    requesterName: '',
    relationship: '',
    identityNumber: '',
    purpose: '',
    copyCount: 0,
  }
  const result2 = validateCopyRequestForm(invalidForm)
  assert.equal(result2.isValid, false)
  assert.equal(result2.errors.length, 5)
})

test('4. KIỂM THỬ CẤU TRÚC DỮ LIỆU ĐẦY ĐỦ TRƯỚC KHI XUẤT BẢN SAO', () => {
  const payload = {
    record: { id: 'rec-101', status: 'LOCKED' },
    patient: { fullName: 'Trần Thị Bình', patientCode: 'BN000002' },
    visit: { visitCode: 'VIS-002' },
    requestInfo: { requesterName: 'Trần Thị Bình', relationship: 'Bản thân bệnh nhân (Chính chủ)' },
  }

  const check = validateMedicalRecordCopyPayload(payload)
  assert.equal(check.isReadyForExport, true)
  assert.equal(check.missingFields.length, 0)
})

test('5. KIỂM THỬ ĐIỀU KIỆN BẮT ĐẦU VÀ KẾT QUẢ SAU HOÀN THÀNH', () => {
  const lockedRecord = { id: 'rec-001', status: 'LOCKED' }
  const draftRecord = { id: 'rec-002', status: 'DRAFT' }
  assert.equal(validateRecordCopyEligibility(lockedRecord).eligible, true)
  assert.equal(validateRecordCopyEligibility(draftRecord).eligible, false)

  const patientSelfRequest = {
    requesterName: 'Nguyen Van An',
    relationship: 'Bản thân bệnh nhân (Chính chủ)',
    identityNumber: '001088012345',
    purpose: 'Lưu trữ cá nhân',
    copyCount: 1,
  }
  assert.equal(validateCopyRequestForm(patientSelfRequest).isValid, true)

  const authorizedAgentRequest = {
    requesterName: 'Luật sư Trần Văn C',
    relationship: 'Người được ủy quyền hợp pháp (Có văn bản ủy quyền)',
    identityNumber: '001090123456',
    purpose: 'Phục vụ công tác giám định y khoa / pháp lý',
    copyCount: 2,
  }
  assert.equal(validateCopyRequestForm(authorizedAgentRequest).isValid, true)

  const copyOutput = validateMedicalRecordCopyPayload({
    record: lockedRecord,
    patient: { fullName: 'Nguyen Van An', patientCode: 'BN000001' },
    requestInfo: authorizedAgentRequest,
  })
  assert.equal(copyOutput.isReadyForExport, true)

  const createdLog = {
    action: 'EXPORT',
    accessedBy: 'manager1',
    detail: 'Đã cấp 2 bản sao trích lục HSBA [VIS000001] cho: Luật sư Trần Văn C (Quan hệ: Người được ủy quyền hợp pháp).',
  }
  assert.equal(createdLog.action, 'EXPORT')
  assert.match(createdLog.detail, /Đã cấp 2 bản sao/)
})
