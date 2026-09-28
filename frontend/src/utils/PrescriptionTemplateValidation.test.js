import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ROUTE_OPTIONS,
  ROUTE_LABELS,
  getRouteLabel,
  canSaveAsTemplate,
  hasSafetyWarnings,
  mapTemplateErrorMessage,
  mapDraftItemToFormItem,
} from './prescriptionTemplateHelpers.js'

test('1. ROUTE_OPTIONS contains exactly 15 valid medical administration routes matching Backend enum', () => {
  assert.equal(ROUTE_OPTIONS.length, 15)

  const expectedRoutes = [
    'ORAL',
    'SUBLINGUAL',
    'BUCCAL',
    'INTRAVENOUS',
    'INTRAMUSCULAR',
    'SUBCUTANEOUS',
    'TOPICAL',
    'OPHTHALMIC',
    'OTIC',
    'NASAL',
    'INHALATION',
    'RECTAL',
    'VAGINAL',
    'TRANSDERMAL',
    'OTHER',
  ]

  const actualValues = ROUTE_OPTIONS.map((r) => r.value)
  for (const expected of expectedRoutes) {
    assert.ok(actualValues.includes(expected), `Missing route: ${expected}`)
  }

  assert.equal(getRouteLabel('ORAL'), 'Uống')
  assert.equal(getRouteLabel('BUCCAL'), 'Ngậm áp má')
  assert.equal(getRouteLabel('VAGINAL'), 'Đặt âm đạo')
  assert.equal(getRouteLabel('OTHER'), 'Cách dùng khác')
})

test('2. hasSafetyWarnings returns true if ANY warning array is non-empty', () => {
  // Empty or null cases -> false
  assert.equal(hasSafetyWarnings(null), false)
  assert.equal(hasSafetyWarnings({}), false)
  assert.equal(
    hasSafetyWarnings({
      interactionWarnings: [],
      allergyWarnings: [],
      contraindicationWarnings: [],
    }),
    false,
  )

  // Only interaction warnings -> true
  assert.equal(
    hasSafetyWarnings({
      interactionWarnings: [{ ruleId: 'rule-1', severity: 'SEVERE' }],
      allergyWarnings: [],
      contraindicationWarnings: [],
    }),
    true,
  )

  // Only allergy warnings -> true
  assert.equal(
    hasSafetyWarnings({
      interactionWarnings: [],
      allergyWarnings: [{ medicineId: 'med-1', allergenName: 'Aspirin' }],
      contraindicationWarnings: [],
    }),
    true,
  )

  // Only contraindication warnings -> true
  assert.equal(
    hasSafetyWarnings({
      interactionWarnings: [],
      allergyWarnings: [],
      contraindicationWarnings: [{ ruleId: 'contra-1', severity: 'ABSOLUTE' }],
    }),
    true,
  )

  // Multiple warnings -> true
  assert.equal(
    hasSafetyWarnings({
      interactionWarnings: [{ ruleId: 'rule-1' }],
      allergyWarnings: [{ medicineId: 'med-1' }],
      contraindicationWarnings: [{ ruleId: 'contra-1' }],
    }),
    true,
  )
})

test('3. canSaveAsTemplate grants permission ONLY to prescribing doctor for non-cancelled prescriptions', () => {
  const doctorId = '11111111-2222-3333-4444-555555555555'
  const otherDoctorId = '99999999-8888-7777-6666-555555555555'

  const validPrescription = {
    id: 'rx-100',
    prescribedBy: doctorId,
    status: 'PENDING_DISPENSE',
  }

  // Case 1: Same doctor, valid pending prescription -> Allowed
  const res1 = canSaveAsTemplate({
    prescription: validPrescription,
    currentUserId: doctorId,
    userRoles: ['DOCTOR'],
  })
  assert.equal(res1.allowed, true)
  assert.equal(res1.reason, null)

  // Case 2: Same doctor, completed dispensed prescription -> Allowed
  const res2 = canSaveAsTemplate({
    prescription: { ...validPrescription, status: 'DISPENSED' },
    currentUserId: doctorId,
    userRoles: ['role_doctor'],
  })
  assert.equal(res2.allowed, true)

  // Case 3: Cancelled prescription -> Rejected
  const res3 = canSaveAsTemplate({
    prescription: { ...validPrescription, status: 'CANCELLED' },
    currentUserId: doctorId,
    userRoles: ['DOCTOR'],
  })
  assert.equal(res3.allowed, false)
  assert.match(res3.reason, /đã hủy/)

  // Case 4: Different doctor -> Rejected
  const res4 = canSaveAsTemplate({
    prescription: validPrescription,
    currentUserId: otherDoctorId,
    userRoles: ['DOCTOR'],
  })
  assert.equal(res4.allowed, false)
  assert.match(res4.reason, /Chỉ bác sĩ đã kê đơn/)

  // Case 5: Non-doctor role (e.g. Pharmacist, Nurse, Admin without doctor role) -> Rejected
  const res5 = canSaveAsTemplate({
    prescription: validPrescription,
    currentUserId: doctorId,
    userRoles: ['PHARMACIST'],
  })
  assert.equal(res5.allowed, false)
  assert.match(res5.reason, /Chỉ Bác sĩ mới có quyền/)

  // Case 6: Null prescription -> Rejected
  const res6 = canSaveAsTemplate({
    prescription: null,
    currentUserId: doctorId,
    userRoles: ['DOCTOR'],
  })
  assert.equal(res6.allowed, false)

  // Case 7: UUID format variations (uppercase / hyphens stripped) -> Allowed
  const res7 = canSaveAsTemplate({
    prescription: { ...validPrescription, prescribedBy: '11111111222233334444555555555555' },
    currentUserId: '11111111-2222-3333-4444-555555555555',
    userRoles: ['doctor'],
  })
  assert.equal(res7.allowed, true)
})

test('4. mapTemplateErrorMessage maps various HTTP and business exceptions accurately', () => {
  // 403 Access Denied
  assert.match(
    mapTemplateErrorMessage({
      response: {
        status: 403,
        data: { message: 'Only the doctor who prescribed can save this prescription as a template.' },
      },
    }),
    /Chỉ bác sĩ đã kê đơn thuốc này mới có quyền lưu thành đơn mẫu/,
  )

  assert.match(
    mapTemplateErrorMessage({
      response: {
        status: 403,
        data: { message: 'Doctors may only apply their own prescription templates.' },
      },
    }),
    /Bác sĩ chỉ có thể áp dụng đơn thuốc mẫu do chính mình tạo/,
  )

  // 400 Diagnosis not in medical record
  assert.match(
    mapTemplateErrorMessage({
      response: {
        status: 400,
        data: { message: "Diagnosis does not belong to the prescription's medical record: J06.9" },
      },
    }),
    /Mã chẩn đoán được chọn không thuộc bệnh án của đơn thuốc này/,
  )

  // 400 Cancelled prescription
  assert.match(
    mapTemplateErrorMessage({
      response: {
        status: 400,
        data: { message: 'A cancelled prescription cannot be saved as a template.' },
      },
    }),
    /Không thể lưu đơn thuốc đã hủy thành mẫu/,
  )

  // 404 Not Found
  assert.match(
    mapTemplateErrorMessage({
      response: {
        status: 404,
        data: { message: 'Prescription template not found: tpl-123' },
      },
    }),
    /Không tìm thấy đơn thuốc mẫu yêu cầu/,
  )

  // Fallback
  assert.ok(mapTemplateErrorMessage(null).length > 0)
})

test('5. mapDraftItemToFormItem correctly converts draft item to editable form item', () => {
  const draftItem = {
    medicineId: 'med-paracetamol-123',
    medicineCode: 'TH001',
    medicineName: 'Paracetamol 500mg',
    dosage: '2 viên',
    frequency: 3,
    route: 'ORAL',
    durationDays: 5,
    quantity: 30,
    instructions: 'Uống sau bữa ăn',
  }

  const formItem = mapDraftItemToFormItem(draftItem)

  assert.equal(formItem.medicineId, 'med-paracetamol-123')
  assert.equal(formItem.dosage, '2 viên')
  assert.equal(formItem.frequency, 3)
  assert.equal(formItem.route, 'ORAL')
  assert.equal(formItem.durationDays, 5)
  assert.equal(formItem.quantity, 30)
  assert.equal(formItem.instructions, 'Uống sau bữa ăn')
  assert.equal(formItem.isOriginal, false)
  assert.equal(formItem.quantityManuallyEdited, true)
  assert.ok(formItem.clientId.startsWith('template-item-'))
})
