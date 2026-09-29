import test from 'node:test'
import assert from 'node:assert/strict'
import { validateItemStock } from '../../utils/prescriptionInventoryValidation.js'

export const canAdjustPrescription = ({
  userRoles = [],
  currentUserId,
  assignedDoctorId,
  medicalRecordLocked = false,
  queueBlocked = false,
  prescriptionStatus,
}) => {
  const allowedRoles = ['doctor', 'admin', 'role_doctor', 'role_admin']
  const isDoctor = userRoles.some((r) => allowedRoles.includes(String(r).toLowerCase()))
  const isAssignedDoctor = Boolean(currentUserId && assignedDoctorId && String(currentUserId) === String(assignedDoctorId))

  if (!isDoctor) return { allowed: false, reason: 'Chỉ bác sĩ mới có quyền điều chỉnh đơn thuốc.' }
  if (!isAssignedDoctor) return { allowed: false, reason: 'Chỉ bác sĩ phụ trách lượt khám này mới được quyền điều chỉnh.' }
  if (medicalRecordLocked) return { allowed: false, reason: 'Bệnh án đã khóa nên không thể điều chỉnh đơn thuốc.' }
  if (queueBlocked) return { allowed: false, reason: 'Lượt khám đang chờ kết quả cận lâm sàng hoặc chưa ở trạng thái IN_PROGRESS.' }
  if (prescriptionStatus !== 'PENDING_DISPENSE') {
    return {
      allowed: false,
      reason: prescriptionStatus === 'DISPENSED'
        ? 'Thuốc đã được cấp phát, không thể điều chỉnh.'
        : prescriptionStatus === 'CANCELLED'
          ? 'Đơn thuốc đã bị hủy.'
          : 'Chỉ đơn thuốc ở trạng thái chờ cấp phát (PENDING_DISPENSE) mới được điều chỉnh.',
    }
  }

  return { allowed: true }
}

export const validatePrescriptionAdjustmentForm = ({
  medicalRecordId,
  diagnoses = [],
  items = [],
  medicines = [],
  changeReason = '',
  isEditing = true,
}) => {
  const errors = []

  if (!medicalRecordId) errors.push('Thiếu medicalRecordId.')
  if (!diagnoses || diagnoses.length === 0) errors.push('Bệnh án phải có chẩn đoán trước khi kê đơn.')
  if (!items || items.length === 0) errors.push('Đơn thuốc phải có ít nhất một loại thuốc.')

  const seen = new Set()
  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i]
    if (!item.medicineId) {
      errors.push(`Dòng ${i + 1}: chưa chọn thuốc.`)
    } else if (seen.has(item.medicineId)) {
      errors.push(`Dòng ${i + 1}: thuốc bị trùng trong đơn.`)
    } else {
      seen.add(item.medicineId)
    }

    if (!item.dosage || !item.dosage.trim()) {
      errors.push(`Dòng ${i + 1}: chưa nhập liều dùng.`)
    } else if (item.dosage.trim().length > 100) {
      errors.push(`Dòng ${i + 1}: liều dùng không được vượt quá 100 ký tự.`)
    }

    const freqNum = Number(item.frequency)
    if (
      item.frequency == null ||
      item.frequency === '' ||
      isNaN(freqNum) ||
      !Number.isInteger(freqNum) ||
      freqNum <= 0
    ) {
      errors.push(`Dòng ${i + 1}: tần suất dùng thuốc phải là số nguyên dương (> 0).`)
    }

    if (!item.route) {
      errors.push(`Dòng ${i + 1}: chưa chọn cách dùng thuốc.`)
    }

    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
      errors.push(`Dòng ${i + 1}: số lượng phải là số nguyên dương.`)
    }
    if (!Number.isInteger(Number(item.durationDays)) || Number(item.durationDays) <= 0) {
      errors.push(`Dòng ${i + 1}: số ngày dùng phải là số nguyên dương.`)
    }

    if (medicines && medicines.length > 0 && item.medicineId) {
      const stockRes = validateItemStock(item, medicines)
      if (!stockRes.isValid) {
        errors.push(`Dòng ${i + 1}: ${stockRes.error}`)
      }
    }
  }

  if (isEditing && (!changeReason || !changeReason.trim())) {
    errors.push('Bắt buộc phải nhập lý do điều chỉnh đơn thuốc theo quy chế bệnh án.')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export const buildPrescriptionAdjustmentPayload = ({
  note = '',
  changeReason = '',
  items = [],
  interactionOverrides = [],
}) => {
  return {
    note: note.trim(),
    changeReason: changeReason.trim(),
    items: items.map((item) => ({
      medicineId: item.medicineId,
      dosage: String(item.dosage || '').trim(),
      frequency: Number(item.frequency),
      route: item.route,
      durationDays: Number(item.durationDays),
      quantity: Number(item.quantity),
      instructions: String(item.instructions || '').trim(),
    })),
    interactionOverrides: (interactionOverrides || []).map((o) => ({
      ruleId: o.ruleId,
      overrideReason: o.overrideReason,
    })),
  }
}

test('1. Kiểm thử RÀNG BUỘC TRẠNG THÁI: Chỉ điều chỉnh khi PENDING_DISPENSE', () => {
  const baseContext = {
    userRoles: ['doctor'],
    currentUserId: 'doc-1',
    assignedDoctorId: 'doc-1',
    medicalRecordLocked: false,
    queueBlocked: false,
  }

  const resPending = canAdjustPrescription({ ...baseContext, prescriptionStatus: 'PENDING_DISPENSE' })
  assert.equal(resPending.allowed, true)

  const resDispensed = canAdjustPrescription({ ...baseContext, prescriptionStatus: 'DISPENSED' })
  assert.equal(resDispensed.allowed, false)
  assert.equal(resDispensed.reason, 'Thuốc đã được cấp phát, không thể điều chỉnh.')

  const resCancelled = canAdjustPrescription({ ...baseContext, prescriptionStatus: 'CANCELLED' })
  assert.equal(resCancelled.allowed, false)
  assert.equal(resCancelled.reason, 'Đơn thuốc đã bị hủy.')
})

test('2. Kiểm thử RÀNG BUỘC PHÂN QUYỀN & BỆNH ÁN KHÓA', () => {
  const resLocked = canAdjustPrescription({
    userRoles: ['doctor'],
    currentUserId: 'doc-1',
    assignedDoctorId: 'doc-1',
    medicalRecordLocked: true,
    prescriptionStatus: 'PENDING_DISPENSE',
  })
  assert.equal(resLocked.allowed, false)
  assert.ok(resLocked.reason.includes('Bệnh án đã khóa'))

  const resOtherDoctor = canAdjustPrescription({
    userRoles: ['doctor'],
    currentUserId: 'doc-2',
    assignedDoctorId: 'doc-1',
    medicalRecordLocked: false,
    prescriptionStatus: 'PENDING_DISPENSE',
  })
  assert.equal(resOtherDoctor.allowed, false)
  assert.ok(resOtherDoctor.reason.includes('Chỉ bác sĩ phụ trách'))

  const resPharmacist = canAdjustPrescription({
    userRoles: ['pharmacist'],
    currentUserId: 'pharm-1',
    assignedDoctorId: 'pharm-1',
    medicalRecordLocked: false,
    prescriptionStatus: 'PENDING_DISPENSE',
  })
  assert.equal(resPharmacist.allowed, false)
  assert.ok(resPharmacist.reason.includes('Chỉ bác sĩ'))
})

test('3. Kiểm thử BẮT BUỘC NHẬP LÝ DO ĐIỀU CHỈNH (Change Reason Validation)', () => {
  const validItems = [
    {
      medicineId: 'med-1',
      dosage: '1 viên/lần',
      frequency: 2,
      route: 'ORAL',
      quantity: 10,
      durationDays: 5,
    },
  ]

  const resMissingReason = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: validItems,
    changeReason: '',
    isEditing: true,
  })
  assert.equal(resMissingReason.isValid, false)
  assert.ok(resMissingReason.errors.some((e) => e.includes('lý do điều chỉnh')))

  const resValidReason = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: validItems,
    changeReason: 'Thay đổi theo diễn tiến bệnh của bệnh nhân',
    isEditing: true,
  })
  assert.equal(resValidReason.isValid, true)
  assert.equal(resValidReason.errors.length, 0)
})

test('4. Kiểm thử THAO TÁC SỬA / THÊM / BỎ THUỐC VÀ DỮ LIỆU ĐẦU VÀO', () => {
  const resEmpty = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: [],
    changeReason: 'Bỏ thuốc',
    isEditing: true,
  })
  assert.equal(resEmpty.isValid, false)
  assert.ok(resEmpty.errors.some((e) => e.includes('ít nhất một loại thuốc')))

  const duplicateItems = [
    { medicineId: 'med-1', dosage: '1 viên', frequency: 2, route: 'ORAL', quantity: 10, durationDays: 5 },
    { medicineId: 'med-1', dosage: '2 viên', frequency: 1, route: 'ORAL', quantity: 5, durationDays: 5 },
  ]
  const resDuplicate = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: duplicateItems,
    changeReason: 'Sửa liều',
    isEditing: true,
  })
  assert.equal(resDuplicate.isValid, false)
  assert.ok(resDuplicate.errors.some((e) => e.includes('thuốc bị trùng')))

  const invalidQuantityItems = [
    { medicineId: 'med-1', dosage: '1 viên', frequency: 2, route: 'ORAL', quantity: -5, durationDays: 0 },
  ]
  const resInvalidQty = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: invalidQuantityItems,
    changeReason: 'Sửa liều',
    isEditing: true,
  })
  assert.equal(resInvalidQty.isValid, false)
  assert.ok(resInvalidQty.errors.some((e) => e.includes('số lượng phải là số nguyên dương')))
  assert.ok(resInvalidQty.errors.some((e) => e.includes('số ngày dùng phải là số nguyên dương')))

  const invalidFrequencyItems = [
    { medicineId: 'med-1', dosage: '1 viên', frequency: 0, route: 'ORAL', quantity: 5, durationDays: 5 },
  ]
  const resInvalidFreq = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: invalidFrequencyItems,
    changeReason: 'Sửa tần suất',
    isEditing: true,
  })
  assert.equal(resInvalidFreq.isValid, false)
  assert.ok(resInvalidFreq.errors.some((e) => e.includes('tần suất dùng thuốc phải là số nguyên dương')))
})

test('5. Kiểm thử CHUẨN HÓA PAYLOAD GỬI LÊN BACKEND PATCH /prescriptions/{id}', () => {
  const payload = buildPrescriptionAdjustmentPayload({
    note: '  Dặn bệnh nhân uống nhiều nước  ',
    changeReason: '  Thay đổi theo diễn tiến bệnh  ',
    items: [
      {
        medicineId: 'med-1',
        dosage: ' 1 viên/lần ',
        frequency: '2',
        route: 'ORAL',
        durationDays: 7,
        quantity: 14,
        instructions: ' Uống sau ăn ',
      },
    ],
    interactionOverrides: [
      { ruleId: 'rule-123', overrideReason: 'Lợi ích vượt trội nguy cơ' },
    ],
  })

  assert.equal(payload.note, 'Dặn bệnh nhân uống nhiều nước')
  assert.equal(payload.changeReason, 'Thay đổi theo diễn tiến bệnh')
  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0].medicineId, 'med-1')
  assert.equal(payload.items[0].dosage, '1 viên/lần')
  assert.equal(payload.items[0].frequency, 2)
  assert.equal(typeof payload.items[0].frequency, 'number')
  assert.equal(payload.items[0].route, 'ORAL')
  assert.equal(payload.items[0].durationDays, 7)
  assert.equal(payload.items[0].quantity, 14)
  assert.equal(payload.items[0].instructions, 'Uống sau ăn')
  assert.equal(payload.interactionOverrides.length, 1)
  assert.equal(payload.interactionOverrides[0].ruleId, 'rule-123')
})

test('6. Kiểm thử CHUẨN HÓA CÁC TRƯỜNG BẮT BUỘC ĐƠN THUỐC (Required Fields Validation)', () => {
  const baseValidItem = {
    medicineId: 'med-1',
    dosage: '1 viên/lần',
    frequency: 2,
    route: 'ORAL',
    durationDays: 5,
    quantity: 10,
  }

  // 6.1. Thiếu cách dùng (route)
  const resMissingRoute = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: [{ ...baseValidItem, route: null }],
    changeReason: 'Đổi thuốc',
  })
  assert.equal(resMissingRoute.isValid, false)
  assert.ok(resMissingRoute.errors.some((e) => e.includes('chưa chọn cách dùng thuốc')))

  // 6.2. Thiếu liều dùng một lần (dosage)
  const resMissingDosage = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: [{ ...baseValidItem, dosage: '' }],
    changeReason: 'Đổi thuốc',
  })
  assert.equal(resMissingDosage.isValid, false)
  assert.ok(resMissingDosage.errors.some((e) => e.includes('chưa nhập liều dùng')))

  // 6.3. Liều dùng vượt quá 100 ký tự
  const resLongDosage = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: [{ ...baseValidItem, dosage: 'a'.repeat(101) }],
    changeReason: 'Đổi thuốc',
  })
  assert.equal(resLongDosage.isValid, false)
  assert.ok(resLongDosage.errors.some((e) => e.includes('không được vượt quá 100 ký tự')))

  // 6.4. Đầy đủ tất cả trường bắt buộc
  const resAllValid = validatePrescriptionAdjustmentForm({
    medicalRecordId: 'rec-1',
    diagnoses: [{ code: 'J00', name: 'Viêm họng' }],
    items: [baseValidItem],
    changeReason: 'Đầy đủ thông tin',
  })
  assert.equal(resAllValid.isValid, true)
  assert.equal(resAllValid.errors.length, 0)
})
