import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'
import { buildFefoPreview } from '../../utils/workflowContract.js'

function validateReceiptItem(item, today = dayjs().startOf('day')) {
  if (!item.medicineId) {
    return { valid: false, error: 'Vui lòng chọn thuốc.' }
  }
  if (!item.batchNumber || !String(item.batchNumber).trim()) {
    return { valid: false, error: 'Vui lòng nhập số lô.' }
  }
  if (!item.expiryDate) {
    return { valid: false, error: 'Vui lòng chọn hạn dùng.' }
  }
  const expDay = dayjs(item.expiryDate).startOf('day')
  if (!expDay.isAfter(today)) {
    return { valid: false, error: 'Hạn sử dụng phải là ngày trong tương lai.' }
  }
  const qty = Number(item.quantity)
  if (item.quantity == null || isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
    return { valid: false, error: 'Số lượng nhập phải là số nguyên lớn hơn 0.' }
  }
  const price = Number(item.importPrice)
  if (item.importPrice == null || isNaN(price) || price < 0) {
    return { valid: false, error: 'Đơn giá nhập không được âm.' }
  }
  return { valid: true }
}

function buildReceiptPayload(values) {
  const rawItems = Array.isArray(values.items) ? values.items : []
  return {
    note: String(values.note || '').trim() || null,
    items: rawItems.map((item) => ({
      medicineId: item.medicineId,
      batchNumber: String(item.batchNumber).trim(),
      expiryDate: dayjs(item.expiryDate).format('YYYY-MM-DD'),
      quantity: Number(item.quantity),
      importPrice: Number(item.importPrice || 0),
    })),
  }
}

function mapAlertStatus(item) {
  if (item.alertStatus === 'EXPIRED' || Number(item.daysToExpiry) < 0) {
    return 'EXPIRED'
  }
  if (item.alertStatus === 'NEAR_EXPIRY') {
    return 'NEAR_EXPIRY'
  }
  return 'NORMAL'
}

function validateOverrideReason(reason) {
  if (!reason || !String(reason).trim()) {
    return { valid: false, error: 'Vui lòng nhập lý do bỏ qua cảnh báo (không được để trống hoặc chỉ có khoảng trắng).' }
  }
  return { valid: true, trimmedReason: String(reason).trim() }
}

function checkUserPermission(roles) {
  const rList = (Array.isArray(roles) ? roles : [roles])
    .map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
    .filter(Boolean)
  return rList.includes('pharmacist') || rList.includes('admin')
}

test('1.1. Bắt buộc nhập lý do bỏ qua cảnh báo tương tác thuốc (không trống hoặc chỉ có whitespace)', () => {
  assert.equal(validateOverrideReason('').valid, false)
  assert.equal(validateOverrideReason('   ').valid, false)
  assert.equal(validateOverrideReason('\t\n').valid, false)

  const validResult = validateOverrideReason('Bệnh nhân đáp ứng tốt, đã theo dõi sát huyết áp.')
  assert.equal(validResult.valid, true)
  assert.equal(validResult.trimmedReason, 'Bệnh nhân đáp ứng tốt, đã theo dõi sát huyết áp.')
})

test('1.2. Đóng gói interactionOverrides gửi lên Backend khi kê đơn thuốc có tương tác', () => {
  const warnings = [
    { ruleId: 'rule-uuid-1', drugIdA: 'med-1', drugIdB: 'med-2', severity: 'SEVERE' },
    { ruleId: 'rule-uuid-2', drugIdA: 'med-1', drugIdB: 'med-3', severity: 'MODERATE' },
  ]
  const overrideReason = 'Theo dõi sát phản ứng lâm sàng'
  const overridesPayload = warnings.map((w) => ({
    ruleId: w.ruleId,
    overrideReason: overrideReason.trim(),
  }))

  assert.equal(overridesPayload.length, 2)
  assert.deepEqual(overridesPayload[0], { ruleId: 'rule-uuid-1', overrideReason: 'Theo dõi sát phản ứng lâm sàng' })
  assert.deepEqual(overridesPayload[1], { ruleId: 'rule-uuid-2', overrideReason: 'Theo dõi sát phản ứng lâm sàng' })
})

test('2.1. Validate chưa chọn thuốc -> Vui lòng chọn thuốc.', () => {
  const item = { medicineId: undefined, batchNumber: 'LOT-001', expiryDate: dayjs().add(1, 'year'), quantity: 10, importPrice: 1000 }
  const res = validateReceiptItem(item)
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Vui lòng chọn thuốc.')
})

test('2.2. Validate thiếu số lô -> Vui lòng nhập số lô.', () => {
  const item1 = { medicineId: 'med-uuid-1', batchNumber: '', expiryDate: dayjs().add(1, 'year'), quantity: 10, importPrice: 1000 }
  assert.equal(validateReceiptItem(item1).error, 'Vui lòng nhập số lô.')

  const item2 = { medicineId: 'med-uuid-1', batchNumber: '   ', expiryDate: dayjs().add(1, 'year'), quantity: 10, importPrice: 1000 }
  assert.equal(validateReceiptItem(item2).error, 'Vui lòng nhập số lô.')
})

test('2.3. Validate thiếu hạn dùng hoặc hạn dùng trong quá khứ / ngày hiện tại', () => {
  const itemNoExp = { medicineId: 'med-uuid-1', batchNumber: 'LOT-001', expiryDate: null, quantity: 10, importPrice: 1000 }
  assert.equal(validateReceiptItem(itemNoExp).error, 'Vui lòng chọn hạn dùng.')

  const itemPastExp = { medicineId: 'med-uuid-1', batchNumber: 'LOT-001', expiryDate: dayjs().subtract(1, 'day'), quantity: 10, importPrice: 1000 }
  assert.equal(validateReceiptItem(itemPastExp).error, 'Hạn sử dụng phải là ngày trong tương lai.')

  const itemTodayExp = { medicineId: 'med-uuid-1', batchNumber: 'LOT-001', expiryDate: dayjs(), quantity: 10, importPrice: 1000 }
  assert.equal(validateReceiptItem(itemTodayExp).error, 'Hạn sử dụng phải là ngày trong tương lai.')
})

test('2.4. Validate số lượng nhập <= 0 hoặc không phải số nguyên', () => {
  const itemZero = { medicineId: 'med-uuid-1', batchNumber: 'LOT-001', expiryDate: dayjs().add(1, 'year'), quantity: 0, importPrice: 1000 }
  assert.equal(validateReceiptItem(itemZero).error, 'Số lượng nhập phải là số nguyên lớn hơn 0.')

  const itemNegative = { medicineId: 'med-uuid-1', batchNumber: 'LOT-001', expiryDate: dayjs().add(1, 'year'), quantity: -5, importPrice: 1000 }
  assert.equal(validateReceiptItem(itemNegative).error, 'Số lượng nhập phải là số nguyên lớn hơn 0.')

  const itemFloat = { medicineId: 'med-uuid-1', batchNumber: 'LOT-001', expiryDate: dayjs().add(1, 'year'), quantity: 10.5, importPrice: 1000 }
  assert.equal(validateReceiptItem(itemFloat).error, 'Số lượng nhập phải là số nguyên lớn hơn 0.')
})

test('2.5. Validate đơn giá nhập âm', () => {
  const itemNegPrice = { medicineId: 'med-uuid-1', batchNumber: 'LOT-001', expiryDate: dayjs().add(1, 'year'), quantity: 10, importPrice: -100 }
  assert.equal(validateReceiptItem(itemNegPrice).error, 'Đơn giá nhập không được âm.')
})

test('2.6. Khớp chuẩn Request DTO CreateInventoryReceiptRequest gửi lên Backend', () => {
  const formValues = {
    note: '  Nhập kho hợp đồng Dược TW  ',
    items: [
      {
        medicineId: 'med-uuid-1',
        batchNumber: ' LOT-2026-A1 ',
        expiryDate: dayjs('2027-12-31'),
        quantity: 500,
        importPrice: 12500,
      },
    ],
  }
  const payload = buildReceiptPayload(formValues)

  assert.equal(payload.note, 'Nhập kho hợp đồng Dược TW')
  assert.equal(payload.items.length, 1)
  assert.deepEqual(payload.items[0], {
    medicineId: 'med-uuid-1',
    batchNumber: 'LOT-2026-A1',
    expiryDate: '2027-12-31',
    quantity: 500,
    importPrice: 12500,
  })
})

test('2.7. Phân quyền truy cập chức năng nhập kho (Chỉ Dược sĩ và Admin)', () => {
  assert.equal(checkUserPermission(['ROLE_PHARMACIST']), true)
  assert.equal(checkUserPermission(['ROLE_ADMIN']), true)
  assert.equal(checkUserPermission(['pharmacist']), true)
  assert.equal(checkUserPermission(['admin']), true)
  assert.equal(checkUserPermission(['doctor']), false)
  assert.equal(checkUserPermission(['receptionist']), false)
})

test('3.1. Map đúng DTO InventoryExpiryAlertResponse từ Backend', () => {
  const backendAlert = {
    batchId: 'batch-uuid-1',
    medicineId: 'med-uuid-1',
    medicineCode: 'PAR01',
    medicineName: 'Paracetamol 500mg',
    batchNumber: 'LOT-EXP-01',
    expiryDate: '2026-08-01',
    quantity: 50,
    batchStatus: 'ACTIVE',
    daysToExpiry: -11,
    alertStatus: 'EXPIRED',
  }

  assert.equal(backendAlert.daysToExpiry, -11)
  assert.equal(backendAlert.quantity, 50)
  assert.equal(backendAlert.alertStatus, 'EXPIRED')
  assert.equal(mapAlertStatus(backendAlert), 'EXPIRED')
})

test('3.2. Phân loại lô gần hết hạn (NEAR_EXPIRY) và đã hết hạn (EXPIRED)', () => {
  const nearAlert = { alertStatus: 'NEAR_EXPIRY', daysToExpiry: 15 }
  const expiredAlert = { alertStatus: 'EXPIRED', daysToExpiry: -2 }

  assert.equal(mapAlertStatus(nearAlert), 'NEAR_EXPIRY')
  assert.equal(mapAlertStatus(expiredAlert), 'EXPIRED')
})

test('3.3. FEFO Preview tự động chặn và loại bỏ các lô có trạng thái EXPIRED hoặc quá hạn dùng', () => {
  const items = [{ medicineId: 'med-1', quantity: 10, medicineName: 'Paracetamol' }]
  const batches = [
    { batchId: 'b-expired', medicineId: 'med-1', batchNumber: 'LOT-EXP', expiryDate: '2026-01-01', quantity: 100, status: 'EXPIRED', eligibleForDispense: false },
    { batchId: 'b-valid', medicineId: 'med-1', batchNumber: 'LOT-OK', expiryDate: '2027-06-01', quantity: 100, status: 'ACTIVE', eligibleForDispense: true },
  ]

  const preview = buildFefoPreview(items, batches)
  assert.equal(preview[0].allocations.length, 1)
  assert.equal(preview[0].allocations[0].batchId, 'b-valid')
  assert.equal(preview[0].shortageQuantity, 0)
})

test('3.4. FEFO Preview báo thiếu hụt khi chỉ có lô hết hạn trong kho', () => {
  const items = [{ medicineId: 'med-1', quantity: 10, medicineName: 'Paracetamol' }]
  const batches = [
    { batchId: 'b-expired', medicineId: 'med-1', batchNumber: 'LOT-EXP', expiryDate: '2025-12-31', quantity: 50, status: 'EXPIRED', eligibleForDispense: false },
  ]

  const preview = buildFefoPreview(items, batches)
  assert.equal(preview[0].allocations.length, 0)
  assert.equal(preview[0].shortageQuantity, 10)
})
