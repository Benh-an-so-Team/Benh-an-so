import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidElectronicPrescriptionCode,
  isStandardRxCode,
  formatPrescriptionCode,
  verifyPrescriptionCodeImmutability,
  filterPrescriptionsByKeyword,
  getElectronicPrescriptionBadgeProps,
} from '../../utils/electronicPrescriptionValidation.js'

test('1. Kiểm tra định dạng Mã đơn thuốc điện tử (Electronic Prescription Code Format)', () => {
  // Chuẩn RX với 6 chữ số trở lên từ Backend
  assert.equal(isStandardRxCode('RX000001'), true)
  assert.equal(isStandardRxCode('RX123456'), true)
  assert.equal(isStandardRxCode('rx000042'), true)
  assert.equal(isStandardRxCode('RX9223372036854775807'), true)

  // Không phải chuẩn RX (quá ngắn hoặc sai tiền tố)
  assert.equal(isStandardRxCode('RX123'), false)
  assert.equal(isStandardRxCode('DT-123456'), false)
  assert.equal(isStandardRxCode('ABC'), false)
  assert.equal(isStandardRxCode(''), false)
  assert.equal(isStandardRxCode(null), false)

  // Hợp lệ theo chuẩn chung
  assert.equal(isValidElectronicPrescriptionCode('RX000001'), true)
  assert.equal(isValidElectronicPrescriptionCode('DT-2026033001'), true)
  assert.equal(isValidElectronicPrescriptionCode(''), false)
  assert.equal(isValidElectronicPrescriptionCode(null), false)
})

test('2. Chuẩn hóa hiển thị Mã đơn thuốc điện tử (Format Prescription Code)', () => {
  assert.equal(formatPrescriptionCode('rx000001'), 'RX000001')
  assert.equal(formatPrescriptionCode('  RX000099  '), 'RX000099')
  assert.equal(formatPrescriptionCode('', 'fallback-id-123'), 'fallback-id-123')
  assert.equal(formatPrescriptionCode(null, null), '—')
})

test('3. Kiểm tra tính BẤT BIẾN của Mã đơn thuốc điện tử qua các lần điều chỉnh (Immutability)', () => {
  // TH1: Khi điều chỉnh đơn, mã RX gốc được bảo toàn
  const resSame = verifyPrescriptionCodeImmutability('RX000001', 'RX000001')
  assert.equal(resSame.isImmutable, true)
  assert.equal(resSame.code, 'RX000001')

  // TH2: Trùng mã nhưng khác chữ hoa/thường hoặc khoảng trắng -> Hợp lệ & chuẩn hóa
  const resCase = verifyPrescriptionCodeImmutability('RX000001', ' rx000001 ')
  assert.equal(resCase.isImmutable, true)
  assert.equal(resCase.code, 'RX000001')

  // TH3: Cố tình đổi mã đơn thuốc -> Bị từ chối vi phạm tính bất biến
  const resDiff = verifyPrescriptionCodeImmutability('RX000001', 'RX000002')
  assert.equal(resDiff.isImmutable, false)
  assert.ok(resDiff.error.includes('không được phép thay đổi'))

  // TH4: Thiếu mã
  const resMissing = verifyPrescriptionCodeImmutability('', '')
  assert.equal(resMissing.isImmutable, false)
})

test('4. Tìm kiếm & lọc đơn thuốc theo Mã đơn điện tử và từ khóa liên quan (Filter by Keyword)', () => {
  const samplePrescriptions = [
    {
      id: 'p-1',
      prescriptionCode: 'RX000001',
      patientCode: 'BN001',
      patientName: 'Nguyễn Văn An',
      visitCode: 'KB-2026-001',
      doctorName: 'BS. Lê Văn Cường',
      status: 'PENDING_DISPENSE',
    },
    {
      id: 'p-2',
      prescriptionCode: 'RX000002',
      patientCode: 'BN002',
      patientName: 'Trần Thị Bình',
      visitCode: 'KB-2026-002',
      doctorName: 'BS. Phạm Thu Hà',
      status: 'DISPENSED',
    },
    {
      id: 'p-3',
      prescriptionCode: 'RX000045',
      patientCode: 'BN003',
      patientName: 'Lê Hoàng Nam',
      visitCode: 'KB-2026-003',
      doctorName: 'BS. Lê Văn Cường',
      status: 'CANCELLED',
    },
  ]

  // Tìm theo mã đơn điện tử chính xác
  const byCode = filterPrescriptionsByKeyword(samplePrescriptions, 'RX000001')
  assert.equal(byCode.length, 1)
  assert.equal(byCode[0].prescriptionCode, 'RX000001')

  // Tìm theo phần của mã đơn (case-insensitive)
  const byPartialCode = filterPrescriptionsByKeyword(samplePrescriptions, 'rx00000')
  assert.equal(byPartialCode.length, 2)

  // Tìm theo tên bệnh nhân
  const byName = filterPrescriptionsByKeyword(samplePrescriptions, 'Trần Thị')
  assert.equal(byName.length, 1)
  assert.equal(byName[0].prescriptionCode, 'RX000002')

  // Tìm theo mã lượt khám
  const byVisit = filterPrescriptionsByKeyword(samplePrescriptions, 'KB-2026-003')
  assert.equal(byVisit.length, 1)
  assert.equal(byVisit[0].prescriptionCode, 'RX000045')

  // Từ khóa rỗng -> Trả về tất cả
  const all = filterPrescriptionsByKeyword(samplePrescriptions, '')
  assert.equal(all.length, 3)
})

test('5. Sinh Badge và Metadata thuộc tính hiển thị (Badge Props)', () => {
  const badgePending = getElectronicPrescriptionBadgeProps('RX000001', 'PENDING_DISPENSE')
  assert.equal(badgePending.code, 'RX000001')
  assert.equal(badgePending.isStandardRx, true)
  assert.equal(badgePending.color, '#2563eb')
  assert.ok(badgePending.tooltipText.includes('liên thông quốc gia'))

  const badgeDispensed = getElectronicPrescriptionBadgeProps('RX000002', 'DISPENSED')
  assert.equal(badgeDispensed.color, 'green')

  const badgeCancelled = getElectronicPrescriptionBadgeProps('RX000003', 'CANCELLED')
  assert.equal(badgeCancelled.color, 'default')
})
