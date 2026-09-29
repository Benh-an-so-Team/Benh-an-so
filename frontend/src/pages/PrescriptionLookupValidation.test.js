import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PRESCRIPTION_STATUS,
  PRESCRIPTION_STATUS_LABELS,
  normalizeCode,
  getPrescriptionStatusLabel,
  isDispensable,
  getDispenseBlockedReason,
  getStatusBadgeConfig,
} from '../utils/prescriptionLookupHelpers.js'

test('1. normalizeCode - chuẩn hóa mã đơn thuốc (trim và uppercase, xử lý biên rỗng)', () => {
  assert.equal(normalizeCode('rx000001'), 'RX000001', 'Chuyển chữ thường sang in hoa')
  assert.equal(normalizeCode('  Rx000007  '), 'RX000007', 'Trim khoảng trắng thừa hai đầu')
  assert.equal(normalizeCode('\trx000003\n'), 'RX000003', 'Trim tab và xuống dòng')
  assert.equal(normalizeCode('RX000008'), 'RX000008', 'Giữ nguyên mã đã chuẩn')
  
  // Biên rỗng / khoảng trắng
  assert.equal(normalizeCode(''), '', 'Chuỗi rỗng trả về rỗng')
  assert.equal(normalizeCode('   '), '', 'Chuỗi chỉ có khoảng trắng trả về rỗng')
  assert.equal(normalizeCode(null), '', 'null trả về rỗng')
  assert.equal(normalizeCode(undefined), '', 'undefined trả về rỗng')
  assert.equal(normalizeCode(12345), '', 'Dữ liệu không phải string trả về rỗng')
})

test('2. isDispensable - kiểm tra điều kiện được phép cấp phát theo đúng 5 trạng thái', () => {
  // Được cấp phát (true)
  assert.equal(isDispensable(PRESCRIPTION_STATUS.PENDING_DISPENSE), true, 'PENDING_DISPENSE (Chưa cấp) -> được cấp phát')
  assert.equal(isDispensable(PRESCRIPTION_STATUS.PARTIALLY_DISPENSED), true, 'PARTIALLY_DISPENSED (Đã cấp một phần) -> được cấp phát')

  // Không được cấp phát (false)
  assert.equal(isDispensable(PRESCRIPTION_STATUS.DISPENSED), false, 'DISPENSED (Đã cấp phát) -> KHÔNG được cấp phát')
  assert.equal(isDispensable(PRESCRIPTION_STATUS.CANCELLED), false, 'CANCELLED (Đã hủy) -> KHÔNG được cấp phát')
  assert.equal(isDispensable(PRESCRIPTION_STATUS.REPLACED), false, 'REPLACED (Đã thay thế) -> KHÔNG được cấp phát')

  // Biên ngoại lai
  assert.equal(isDispensable(''), false, 'Trạng thái rỗng -> false')
  assert.equal(isDispensable(null), false, 'null -> false')
  assert.equal(isDispensable(undefined), false, 'undefined -> false')
  assert.equal(isDispensable('UNKNOWN_STATUS'), false, 'Trạng thái lạ -> false')
})

test('3. getPrescriptionStatusLabel - nhãn tiếng Việt cho 5 trạng thái đơn thuốc', () => {
  assert.equal(getPrescriptionStatusLabel(PRESCRIPTION_STATUS.PENDING_DISPENSE), 'Chưa cấp')
  assert.equal(getPrescriptionStatusLabel(PRESCRIPTION_STATUS.PARTIALLY_DISPENSED), 'Đã cấp một phần')
  assert.equal(getPrescriptionStatusLabel(PRESCRIPTION_STATUS.DISPENSED), 'Đã cấp phát')
  assert.equal(getPrescriptionStatusLabel(PRESCRIPTION_STATUS.CANCELLED), 'Đã hủy')
  assert.equal(getPrescriptionStatusLabel(PRESCRIPTION_STATUS.REPLACED), 'Đã thay thế')

  assert.equal(getPrescriptionStatusLabel(null), 'Không xác định')
  assert.equal(getPrescriptionStatusLabel(undefined), 'Không xác định')
  assert.equal(getPrescriptionStatusLabel('CUSTOM_STATE'), 'CUSTOM_STATE')
})

test('4. getDispenseBlockedReason - lý do không thể cấp phát khi đơn bị khóa/hủy/đã cấp', () => {
  // Trạng thái được cấp phát -> không có lý do chặn (null)
  assert.equal(getDispenseBlockedReason(PRESCRIPTION_STATUS.PENDING_DISPENSE), null)
  assert.equal(getDispenseBlockedReason(PRESCRIPTION_STATUS.PARTIALLY_DISPENSED), null)

  // Trạng thái bị chặn
  const reasonDispensed = getDispenseBlockedReason(PRESCRIPTION_STATUS.DISPENSED)
  assert.ok(reasonDispensed && reasonDispensed.includes('đã được cấp phát'), 'Lý do đã cấp phát rõ ràng')

  const reasonCancelled = getDispenseBlockedReason(PRESCRIPTION_STATUS.CANCELLED)
  assert.ok(reasonCancelled && reasonCancelled.includes('đã bị hủy'), 'Lý do đã bị hủy rõ ràng')

  const reasonReplaced = getDispenseBlockedReason(PRESCRIPTION_STATUS.REPLACED)
  assert.ok(reasonReplaced && reasonReplaced.includes('đã bị thay thế'), 'Lý do đã thay thế rõ ràng')

  const reasonUnknown = getDispenseBlockedReason('UNKNOWN')
  assert.ok(reasonUnknown && reasonUnknown.includes('không thể cấp phát'), 'Lý do chặn mặc định')
})

test('5. getStatusBadgeConfig - màu sắc và nhãn tag UI', () => {
  assert.deepEqual(getStatusBadgeConfig(PRESCRIPTION_STATUS.PENDING_DISPENSE), {
    color: 'blue',
    label: 'Chưa cấp',
  })
  assert.deepEqual(getStatusBadgeConfig(PRESCRIPTION_STATUS.PARTIALLY_DISPENSED), {
    color: 'gold',
    label: 'Đã cấp một phần',
  })
  assert.deepEqual(getStatusBadgeConfig(PRESCRIPTION_STATUS.DISPENSED), {
    color: 'default',
    label: 'Đã cấp phát',
  })
  assert.deepEqual(getStatusBadgeConfig(PRESCRIPTION_STATUS.CANCELLED), {
    color: 'error',
    label: 'Đã hủy',
  })
  assert.deepEqual(getStatusBadgeConfig(PRESCRIPTION_STATUS.REPLACED), {
    color: 'purple',
    label: 'Đã thay thế',
  })
})
