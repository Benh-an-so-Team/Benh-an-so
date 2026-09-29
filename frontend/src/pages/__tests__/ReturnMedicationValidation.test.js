import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CLINICAL_TIMEZONE,
  MAX_REASON_LENGTH,
  calculateProjectedStatus,
  calculateReturnRefundAmount,
  formatDateInTimezone,
  isDispensedToday,
  mapReturnErrorMessage,
  validateReturnForm,
} from '../../utils/medicationReturnHelpers.js'

test('validateReturnForm: Chặn lý do trả thuốc rỗng hoặc toàn khoảng trắng', () => {
  const items = [{ dispenseItemId: 'd1', quantity: 5, maxReturnable: 10 }]

  assert.equal(validateReturnForm('', items).isValid, false)
  assert.match(validateReturnForm('', items).error, /lý do/)

  assert.equal(validateReturnForm('   ', items).isValid, false)
  assert.match(validateReturnForm('   ', items).error, /lý do/)

  assert.equal(validateReturnForm(null, items).isValid, false)
  assert.equal(validateReturnForm(undefined, items).isValid, false)
})

test('validateReturnForm: Chặn lý do trả thuốc vượt quá 500 ký tự', () => {
  const items = [{ dispenseItemId: 'd1', quantity: 2, maxReturnable: 5 }]
  const longReason = 'a'.repeat(501)

  const res = validateReturnForm(longReason, items)
  assert.equal(res.isValid, false)
  assert.match(res.error, /500 ký tự/)

  // 500 ký tự hợp lệ
  const valid500 = 'a'.repeat(500)
  assert.equal(validateReturnForm(valid500, items).isValid, true)
})

test('validateReturnForm: Chặn khi không có dòng nào có quantity > 0', () => {
  const reason = 'Bệnh nhân đổi phác đồ'

  // Items rỗng
  assert.equal(validateReturnForm(reason, []).isValid, false)
  assert.match(validateReturnForm(reason, []).error, /lớn hơn 0/)

  // Tất cả số lượng = 0
  const allZero = [
    { dispenseItemId: 'd1', quantity: 0, maxReturnable: 10 },
    { dispenseItemId: 'd2', quantity: 0, maxReturnable: 5 },
  ]
  const zeroRes = validateReturnForm(reason, allZero)
  assert.equal(zeroRes.isValid, false)
  assert.match(zeroRes.error, /lớn hơn 0/)
})

test('validateReturnForm: Chặn số lượng âm hoặc không phải số nguyên', () => {
  const reason = 'Cấp nhầm số lượng'

  const negative = [{ dispenseItemId: 'd1', quantity: -3, maxReturnable: 10 }]
  assert.equal(validateReturnForm(reason, negative).isValid, false)

  const decimal = [{ dispenseItemId: 'd1', quantity: 2.5, maxReturnable: 10 }]
  assert.equal(validateReturnForm(reason, decimal).isValid, false)
  assert.match(validateReturnForm(reason, decimal).error, /số nguyên dương/)
})

test('validateReturnForm: Chặn khi số lượng trả vượt quá số lượng tối đa có thể trả (maxReturnable)', () => {
  const reason = 'Bệnh nhân dùng không hết'
  const items = [
    {
      dispenseItemId: 'd1',
      quantity: 12,
      maxReturnable: 10,
      medicineName: 'Paracetamol 500mg',
    },
  ]

  const res = validateReturnForm(reason, items)
  assert.equal(res.isValid, false)
  assert.match(res.error, /vượt quá số lượng tối đa/)
  assert.match(res.error, /Paracetamol 500mg/)
})

test('validateReturnForm: Chấp nhận dữ liệu hợp lệ và format đúng contract Backend', () => {
  const reason = ' Bệnh nhân không có nhu cầu dùng tiếp '
  const items = [
    { dispenseItemId: 'item-uuid-1', quantity: 3, maxReturnable: 10 },
    { dispenseItemId: 'item-uuid-2', quantity: 0, maxReturnable: 5 },
    { dispenseItemId: 'item-uuid-3', quantity: 4, maxReturnable: 4 },
  ]

  const res = validateReturnForm(reason, items)
  assert.equal(res.isValid, true)
  assert.equal(res.error, null)
  assert.deepEqual(res.validItems, [
    { dispenseItemId: 'item-uuid-1', quantity: 3 },
    { dispenseItemId: 'item-uuid-3', quantity: 4 },
  ])
})

test('isDispensedToday: Nhận diện chính xác ngày hôm nay theo múi giờ Asia/Ho_Chi_Minh', () => {
  // Mốc tham chiếu: 14:30 ngày 21/09/2026 tại VN (UTC: 2026-09-21T07:30:00Z)
  const refDate = new Date('2026-09-21T07:30:00Z')

  // Cùng ngày tại VN (sáng 08:00 VN = 01:00 UTC)
  assert.equal(isDispensedToday('2026-09-21T01:00:00Z', refDate), true)

  // Khác ngày: Ngày hôm trước tại VN (20/09/2026 23:00 VN = 16:00 UTC)
  assert.equal(isDispensedToday('2026-09-20T16:00:00Z', refDate), false)

  // Khác ngày: Ngày hôm sau tại VN (22/09/2026 01:00 VN = 21/09/2026 18:00 UTC)
  assert.equal(isDispensedToday('2026-09-21T18:00:00Z', refDate), false)

  // Input null hoặc không hợp lệ
  assert.equal(isDispensedToday(null, refDate), false)
  assert.equal(isDispensedToday(undefined, refDate), false)
  assert.equal(isDispensedToday('invalid-date', refDate), false)
})

test('isDispensedToday: Kiểm tra mốc biên nửa đêm chuẩn xác', () => {
  const refDate = new Date('2026-09-21T12:00:00Z') // Ngày 21/09/2026

  // 23:59:59.999 VN ngày 21/09/2026 (16:59:59.999Z) -> VẪN LÀ HÔM NAY
  assert.equal(isDispensedToday('2026-09-21T16:59:59.999Z', refDate), true)

  // 00:00:01 VN ngày 22/09/2026 (17:00:01Z ngày 21/09) -> ĐÃ SANG NGÀY MAI
  assert.equal(isDispensedToday('2026-09-21T17:00:01.000Z', refDate), false)
})

test('mapReturnErrorMessage: Map đầy đủ các mã lỗi Backend sang tiếng Việt cụ thể', () => {
  // 403 Forbidden
  assert.match(
    mapReturnErrorMessage({ response: { status: 403 } }),
    /không có quyền.*Dược sĩ/i
  )

  // 409 Phiếu không lập trong ngày hôm nay
  const errNotToday = {
    response: {
      status: 409,
      data: { message: 'The dispensing slip was not created today and cannot be returned.' },
    },
  }
  assert.equal(
    mapReturnErrorMessage(errNotToday),
    'Chỉ có thể trả thuốc cho phiếu cấp phát được lập TRONG NGÀY HÔM NAY.'
  )

  // 409 Viện phí chưa hoàn tiền
  const errPayment = {
    response: {
      status: 409,
      data: { message: 'PrescriptionReturnPaymentNotRefundedException: payment not refunded' },
    },
  }
  assert.equal(
    mapReturnErrorMessage(errPayment),
    'Lượt khám này đã được thu phí và chưa hoàn tiền. Vui lòng hoàn tiền trước khi trả thuốc.'
  )

  // 400 Lý do rỗng
  const errReason = {
    response: {
      status: 400,
      data: { message: 'Return reason is required.' },
    },
  }
  assert.equal(mapReturnErrorMessage(errReason), 'Vui lòng nhập lý do trả thuốc.')

  // 400 Số lượng vượt quá
  const errQty = {
    response: {
      status: 400,
      data: { message: 'Returned quantity exceeds the remaining returnable quantity.' },
    },
  }
  assert.equal(
    mapReturnErrorMessage(errQty),
    'Số lượng trả lại không hợp lệ hoặc vượt quá số lượng còn lại có thể trả.'
  )

  // 404 Not found
  assert.match(
    mapReturnErrorMessage({ response: { status: 404 } }),
    /Không tìm thấy đơn thuốc/
  )

  // 500 Server error
  assert.match(
    mapReturnErrorMessage({ response: { status: 500 } }),
    /Lỗi hệ thống máy chủ/
  )
})

test('calculateProjectedStatus: Dự báo chuyển trạng thái CANCELLED khi trả hết toàn bộ số lượng', () => {
  const historyItems = [
    { id: 'item-1', dispensedQuantity: 10, returnedQuantity: 0 },
    { id: 'item-2', dispensedQuantity: 5, returnedQuantity: 0 },
  ]

  // Trả hết toàn bộ (10 + 5)
  const returnQuantities = {
    'item-1': 10,
    'item-2': 5,
  }

  const result = calculateProjectedStatus(historyItems, returnQuantities)
  assert.equal(result.projectedStatus, 'CANCELLED')
  assert.equal(result.isFullCancellation, true)
  assert.equal(result.label, 'Đã hủy')
  assert.match(result.description, /tự động chuyển sang trạng thái ĐÃ HỦY/)
})

test('calculateProjectedStatus: Dự báo trạng thái PARTIALLY_DISPENSED khi chỉ nhận lại 1 phần', () => {
  const historyItems = [
    { id: 'item-1', dispensedQuantity: 10, returnedQuantity: 0 },
    { id: 'item-2', dispensedQuantity: 5, returnedQuantity: 0 },
  ]

  // Chỉ nhận lại 4 đơn vị của item-1
  const returnQuantities = {
    'item-1': 4,
    'item-2': 0,
  }

  const result = calculateProjectedStatus(historyItems, returnQuantities)
  assert.equal(result.projectedStatus, 'PARTIALLY_DISPENSED')
  assert.equal(result.isFullCancellation, false)
  assert.equal(result.label, 'Cấp phát một phần')
  assert.match(result.description, /CẤP PHÁT MỘT PHẦN/)
})

test('calculateProjectedStatus: UNCHANGED khi chưa chọn số lượng nào', () => {
  const historyItems = [{ id: 'item-1', dispensedQuantity: 10, returnedQuantity: 0 }]
  const returnQuantities = { 'item-1': 0 }

  const result = calculateProjectedStatus(historyItems, returnQuantities)
  assert.equal(result.projectedStatus, 'UNCHANGED')
  assert.equal(result.isFullCancellation, false)
})

test('calculateReturnRefundAmount: Tính tiền hoàn chính xác', () => {
  const items = [
    { medicineId: 'm1', quantity: 5, unitPrice: 10000 },
    { medicineId: 'm2', quantity: 2, unitPrice: 25000 },
    { medicineId: 'm3', quantity: 0, unitPrice: 50000 },
  ]
  const total = calculateReturnRefundAmount(items)
  assert.equal(total, 5 * 10000 + 2 * 25000) // 100,000 VND
})
