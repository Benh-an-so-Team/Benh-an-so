import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'

import {
  DOCTOR_INSTRUCTION_PRESETS,
  DANGER_SIGNS_WARNING,
  QUICK_REVISIT_OFFSETS,
  TREATMENT_PLAN_PRESETS,
  calculateRevisitDate,
  cleanInstructionsErrorMessage,
  formatRevisitDateDisplay,
  validateRevisitDate,
} from '../../utils/instructionsAndTreatmentPlanHelpers.js'

import { buildMedicalRecordPayload } from '../../utils/workflowContract.js'
import medicalRecordApi from '../../api/medicalRecordApi.js'

test('TC-01: Ghi lời dặn & mốc hẹn tái khám hợp lệ khi bệnh án đang khám (IN_PROGRESS)', () => {
  const visitDate = '2026-09-17'
  const validRevisitDate = '2026-09-24' // +7 ngày

  const validation = validateRevisitDate(validRevisitDate, visitDate)
  assert.equal(validation.valid, true)
  assert.equal(validation.error, undefined)

  // Kiểm tra payload tạo thành
  const payload = buildMedicalRecordPayload({
    visitId: 'vis-101',
    values: {
      treatmentPlan: TREATMENT_PLAN_PRESETS[0],
      doctorInstructions: DOCTOR_INSTRUCTION_PRESETS[0],
      revisitDate: validRevisitDate,
    },
    vitalSigns: {},
  })

  assert.equal(payload.visitId, 'vis-101')
  assert.equal(payload.treatmentPlan, TREATMENT_PLAN_PRESETS[0])
  assert.equal(payload.doctorInstructions, DOCTOR_INSTRUCTION_PRESETS[0])
  assert.equal(payload.revisitDate, '2026-09-24')
})

test('TC-01b: Chặn ngày hẹn tái khám trước ngày khám bệnh (Ràng buộc logic y tế)', () => {
  const visitDate = '2026-09-17'
  const invalidRevisitDate = '2026-09-10' // trước ngày khám

  const validation = validateRevisitDate(invalidRevisitDate, visitDate)
  assert.equal(validation.valid, false)
  assert.match(validation.error, /không được trước ngày khám/i)
})

test('TC-01c: Chấp nhận ngày hẹn tái khám trùng ngày khám (tái khám ngay trong ngày)', () => {
  const visitDate = '2026-09-17'
  const sameDayRevisitDate = '2026-09-17'

  const validation = validateRevisitDate(sameDayRevisitDate, visitDate)
  assert.equal(validation.valid, true)
})

test('TC-01d: Cho phép để trống mốc hẹn tái khám nếu chưa cần chỉ định tái khám', () => {
  const validation = validateRevisitDate(null, '2026-09-17')
  assert.equal(validation.valid, true)

  const validationEmpty = validateRevisitDate('', '2026-09-17')
  assert.equal(validationEmpty.valid, true)
})

test('TC-02: Kiểm tra định dạng ngày tái khám và tính năng gợi ý nhanh', () => {
  const baseDate = '2026-09-17'

  // Kiểm tra tính toán các mốc ngày (+3, +7, +14, +30)
  const datePlus3 = calculateRevisitDate(baseDate, 3)
  assert.equal(datePlus3.format('YYYY-MM-DD'), '2026-09-20')

  const datePlus7 = calculateRevisitDate(baseDate, 7)
  assert.equal(datePlus7.format('YYYY-MM-DD'), '2026-09-24')

  const datePlus14 = calculateRevisitDate(baseDate, 14)
  assert.equal(datePlus14.format('YYYY-MM-DD'), '2026-10-01')

  const datePlus30 = calculateRevisitDate(baseDate, 30)
  assert.equal(datePlus30.format('YYYY-MM-DD'), '2026-10-17')

  // Kiểm tra hiển thị văn bản chi tiết mốc tái khám
  const display7 = formatRevisitDateDisplay(datePlus7, baseDate)
  assert.match(display7, /24\/09\/2026/)
  assert.match(display7, /sau 7 ngày/)

  const displaySameDay = formatRevisitDateDisplay(baseDate, baseDate)
  assert.match(displaySameDay, /Hôm nay/)
})

test('TC-03: Xử lý lỗi QTN-18 khi hồ sơ bệnh án đã ký duyệt (Locked/Signed)', () => {
  const lockedBackendError = {
    response: {
      status: 409,
      data: {
        code: 'MEDICAL_RECORD_ALREADY_LOCKED',
        message: 'Medical record is already locked',
      },
    },
  }

  const message = cleanInstructionsErrorMessage(lockedBackendError)
  assert.match(message, /QTN-18/i)
  assert.match(message, /Lập bản đính chính/i)
})

test('TC-03b: Xử lý lỗi QTN-07 khi người dùng không có quyền bác sĩ phụ trách', () => {
  const accessDeniedError = {
    response: {
      status: 403,
      data: {
        code: 'ACCESS_DENIED',
        message: 'Access denied: not attending doctor',
      },
    },
  }

  const message = cleanInstructionsErrorMessage(accessDeniedError)
  assert.match(message, /QTN-07/i)
  assert.match(message, /không có quyền/i)
})

test('TC-04: Danh mục mẫu lời dặn, kế hoạch điều trị và cảnh báo dấu hiệu nguy hiểm', () => {
  assert.ok(TREATMENT_PLAN_PRESETS.length >= 4, 'Cần có ít nhất 4 mẫu kế hoạch điều trị')
  assert.ok(DOCTOR_INSTRUCTION_PRESETS.length >= 4, 'Cần có ít nhất 4 mẫu lời dặn bác sĩ')
  assert.ok(QUICK_REVISIT_OFFSETS.length >= 4, 'Cần có ít nhất 4 mốc chọn nhanh ngày tái khám')

  // Cảnh báo dấu hiệu nguy hiểm phải đầy đủ các triệu chứng đỏ
  assert.match(DANGER_SIGNS_WARNING, /CẢNH BÁO NGUY HIỂM/i)
  assert.match(DANGER_SIGNS_WARNING, /Sốt cao/i)
  assert.match(DANGER_SIGNS_WARNING, /Khó thở/i)
  assert.match(DANGER_SIGNS_WARNING, /đau tức ngực/i)
  assert.match(DANGER_SIGNS_WARNING, /Chóng mặt/i)
})

test('TC-05: Kiểm tra API client đã tích hợp updateInstructionsAndTreatmentPlan', () => {
  assert.equal(typeof medicalRecordApi.updateInstructionsAndTreatmentPlan, 'function')
})
