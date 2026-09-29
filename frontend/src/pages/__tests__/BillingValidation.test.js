import test from 'node:test'
import assert from 'node:assert/strict'

function checkPaymentPermission(roles) {
  const rList = (Array.isArray(roles) ? roles : [roles])
    .map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
    .filter(Boolean)
  return rList.includes('receptionist') || rList.includes('admin')
}

function calculateVisitTotal(examFee, medicineFee, clinicalFee = 0) {
  const e = Number(examFee || 0)
  const m = Number(medicineFee || 0)
  const c = Number(clinicalFee || 0)
  return e + m + c
}

function isVisitEligibleForPayment(visitStatus) {
  return visitStatus === 'COMPLETED' || visitStatus === 'WAITING_FOR_PAYMENT'
}

function validatePaymentSubmission({ visitId, visitStatus, totalAmount, paymentStatus, canCollect, submitting }) {
  if (!canCollect) {
    return { valid: false, error: 'Bạn không có quyền thực hiện thu phí.' }
  }
  if (!visitId) {
    return { valid: false, error: 'Vui lòng chọn lượt khám cần thu phí.' }
  }
  if (!isVisitEligibleForPayment(visitStatus)) {
    return { valid: false, error: 'Lượt khám chưa đủ điều kiện thanh toán.' }
  }
  if (paymentStatus === 'PAID') {
    return { valid: false, error: 'Khoản thu này đã được thanh toán.' }
  }
  if (totalAmount <= 0) {
    return { valid: false, error: 'Số tiền thu phải lớn hơn 0.' }
  }
  if (submitting) {
    return { valid: false, error: 'Yêu cầu đang được xử lý, vui lòng chờ.' }
  }
  return { valid: true }
}

test('1. Phân quyền thu phí: Chỉ Lễ tân (RECEPTIONIST) và Admin mới được thao tác', () => {
  assert.equal(checkPaymentPermission(['ROLE_RECEPTIONIST']), true)
  assert.equal(checkPaymentPermission(['receptionist']), true)
  assert.equal(checkPaymentPermission(['admin']), true)
  assert.equal(checkPaymentPermission(['ROLE_ADMIN']), true)
  assert.equal(checkPaymentPermission(['doctor']), false)
  assert.equal(checkPaymentPermission(['pharmacist']), false)
  assert.equal(checkPaymentPermission(['staff']), false)
})

test('2. Tính tổng tiền cần thu từ các khoản phí Backend (không hardcode)', () => {
  assert.equal(calculateVisitTotal(100000, 250000, 150000), 500000)
  assert.equal(calculateVisitTotal(100000, 0, 0), 100000)
  assert.equal(calculateVisitTotal(0, 0, 0), 0)
})

test('3. Bắt buộc có visitId mới được thu phí (không tạo thanh toán chỉ bằng patientId)', () => {
  const res = validatePaymentSubmission({ visitId: null, visitStatus: 'COMPLETED', totalAmount: 200000, paymentStatus: 'UNPAID', canCollect: true, submitting: false })
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Vui lòng chọn lượt khám cần thu phí.')
})

test('4. Chặn thanh toán lượt khám ở trạng thái IN_PROGRESS', () => {
  assert.equal(isVisitEligibleForPayment('IN_PROGRESS'), false)
  assert.equal(isVisitEligibleForPayment('WAITING'), false)
  assert.equal(isVisitEligibleForPayment('COMPLETED'), true)

  const res = validatePaymentSubmission({ visitId: 'VIS000006', visitStatus: 'IN_PROGRESS', totalAmount: 200000, paymentStatus: 'UNPAID', canCollect: true, submitting: false })
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Lượt khám chưa đủ điều kiện thanh toán.')
})

test('5. Khóa/Chống thanh toán trùng khi khoản thu đã ở trạng thái PAID', () => {
  const res = validatePaymentSubmission({ visitId: 'visit-uuid-1', visitStatus: 'COMPLETED', totalAmount: 200000, paymentStatus: 'PAID', canCollect: true, submitting: false })
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Khoản thu này đã được thanh toán.')
})

test('6. Khóa nút khi request đang chạy (chống double click)', () => {
  const res = validatePaymentSubmission({ visitId: 'visit-uuid-1', visitStatus: 'COMPLETED', totalAmount: 200000, paymentStatus: 'UNPAID', canCollect: true, submitting: true })
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Yêu cầu đang được xử lý, vui lòng chờ.')
})
