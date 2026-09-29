import test from 'node:test'
import assert from 'node:assert/strict'

export function validatePaymentEligibility(visit) {
  if (!visit) {
    return { eligible: false, error: 'Không tìm thấy lượt khám.' }
  }

  const visitStatus = visit.status || 'COMPLETED'
  const isVisitCompleted = visitStatus === 'COMPLETED' || visitStatus === 'WAITING_FOR_PAYMENT'
  if (!isVisitCompleted) {
    return { eligible: false, error: 'Lượt khám chưa đủ điều kiện thanh toán (chưa hoàn tất khám bệnh).' }
  }

  const prescriptionStatus = visit.prescriptionStatus
  if (prescriptionStatus === 'PENDING_DISPENSE') {
    return { eligible: false, error: 'Đơn thuốc chưa được cấp phát (dược sĩ chưa hoàn tất xuất kho).' }
  }

  if (visit.paymentStatus === 'PAID') {
    return { eligible: false, error: 'Khoản thu cho lượt khám này đã được thanh toán.' }
  }

  return { eligible: true }
}

export function calculateBillingTotal(examFee = 0, prescriptionItems = []) {
  const exam = Number(examFee || 0)
  const medTotal = prescriptionItems.reduce((acc, item) => {
    const qty = Number(item.quantity || 0)
    const price = Number(item.unitPrice || item.price || 0)
    return acc + (qty * price)
  }, 0)

  return {
    examFee: exam,
    medicineFee: medTotal,
    totalAmount: exam + medTotal,
  }
}

export function validateInvoiceAdjustment(payload, canAdjust = false) {
  if (!canAdjust) {
    return { valid: false, error: 'Bạn không có quyền điều chỉnh hóa đơn. Chức năng chỉ dành cho Quản lý phòng khám (MANAGER).' }
  }

  const reason = String(payload?.adjustmentReason || '').trim()
  if (!reason) {
    return { valid: false, error: 'Vui lòng nhập lý do điều chỉnh hóa đơn (bắt buộc).' }
  }

  const lines = Array.isArray(payload?.lines) ? payload.lines : []
  if (lines.length === 0) {
    return { valid: false, error: 'Hóa đơn điều chỉnh phải có ít nhất 1 dòng điều chỉnh.' }
  }

  const firstLine = lines[0]
  const unitPrice = Number(firstLine?.unitPrice)
  if (isNaN(unitPrice) || unitPrice === 0) {
    return { valid: false, error: 'Số tiền điều chỉnh không được bằng 0.' }
  }

  return { valid: true }
}

test('TC-PAY-01: Chặn thanh toán cho lượt khám đang IN_PROGRESS', () => {
  const visit = { visitId: 'v-1', status: 'IN_PROGRESS' }
  const result = validatePaymentEligibility(visit)
  assert.strictEqual(result.eligible, false)
  assert.match(result.error, /chưa đủ điều kiện/)
})

test('TC-PAY-03: Chặn thanh toán khi đơn thuốc PENDING_DISPENSE', () => {
  const visit = { visitId: 'v-2', status: 'COMPLETED', prescriptionStatus: 'PENDING_DISPENSE' }
  const result = validatePaymentEligibility(visit)
  assert.strictEqual(result.eligible, false)
  assert.match(result.error, /chưa được cấp phát/)
})

test('TC-PAY-04 & 05: Cho phép thanh toán khi lượt khám COMPLETED và đơn thuốc DISPENSED', () => {
  const visit = { visitId: 'v-3', status: 'COMPLETED', prescriptionStatus: 'DISPENSED' }
  const result = validatePaymentEligibility(visit)
  assert.strictEqual(result.eligible, true)
})

test('TC-PAY-TOTAL: Tính toán tổng tiền phí khám + tiền thuốc chuẩn xác', () => {
  const examFee = 100000
  const items = [
    { quantity: 20, unitPrice: 1500 },
    { quantity: 14, unitPrice: 3500 },
  ]
  const summary = calculateBillingTotal(examFee, items)
  assert.strictEqual(summary.examFee, 100000)
  assert.strictEqual(summary.medicineFee, 79000)
  assert.strictEqual(summary.totalAmount, 179000)
})

test('TC-ADJ-01: Chặn điều chỉnh hóa đơn nếu người dùng không phải MANAGER', () => {
  const payload = { adjustmentReason: 'Giảm tiền thuốc', lines: [{ itemName: 'Giảm giá', unitPrice: -20000 }] }
  const result = validateInvoiceAdjustment(payload, false)
  assert.strictEqual(result.valid, false)
  assert.match(result.error, /không có quyền/)
})

test('TC-ADJ-03: Bắt buộc nhập lý do điều chỉnh hóa đơn', () => {
  const payload = { adjustmentReason: '   ', lines: [{ itemName: 'Giảm giá', unitPrice: -20000 }] }
  const result = validateInvoiceAdjustment(payload, true)
  assert.strictEqual(result.valid, false)
  assert.match(result.error, /lý do/i)
})

test('TC-ADJ-04 & 05: Cho phép Quản lý điều chỉnh giảm hợp lệ với số tiền âm', () => {
  const payload = { adjustmentReason: 'Giảm tiền do ghi nhầm', lines: [{ itemName: 'Điều chỉnh giảm', unitPrice: -20000 }] }
  const result = validateInvoiceAdjustment(payload, true)
  assert.strictEqual(result.valid, true)
})
