import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAvailableStock,
  sortMedicinesByStockAvailability,
  validateItemStock,
  validatePrescriptionStock,
} from '../../utils/prescriptionInventoryValidation.js'

const mockBackendMedicines = [
  { id: 'med-01', medicineName: 'Paracetamol 500 mg', strength: '500 mg', unit: 'viên', stockQuantity: 100, active: true },
  { id: 'med-02', medicineName: 'Ambroxol 30 mg', strength: '30 mg', unit: 'viên', stockQuantity: 45, active: true },
  { id: 'med-03', medicineName: 'Acetylcysteine 200 mg', strength: '200 mg', unit: 'gói', stockQuantity: 0, active: true },
  { id: 'med-04', medicineName: 'Amiodarone 200 mg', strength: '200 mg', unit: 'viên', stockQuantity: 0, active: true },
  { id: 'med-05', medicineName: 'Ibuprofen 400 mg', strength: '400 mg', unit: 'viên', stockQuantity: 20, active: true },
]

test('TC01: Tồn = 0 -> Thuốc vẫn hiển thị trong danh mục và cho phép chọn, trả về cảnh báo mềm hết hàng', () => {
  const acetylM = mockBackendMedicines.find((m) => m.id === 'med-03')
  const stock = getAvailableStock(acetylM)
  assert.equal(stock, 0)

  const validation = validateItemStock({ medicineId: 'med-03', quantity: 1 }, mockBackendMedicines)
  assert.equal(validation.isValid, true, 'Thuốc hết hàng vẫn cho phép kê đơn, không chặn cứng')
  assert.equal(validation.isOutOfStock, true)
  assert.ok(validation.warning.includes('hết hàng'))
  assert.ok(validation.warning.includes('cấp bù sau'))
})

test('TC02: Tồn > 0 -> Cho phép chọn và kê đơn', () => {
  const ambroxolM = mockBackendMedicines.find((m) => m.id === 'med-02')
  const stock = getAvailableStock(ambroxolM)
  assert.equal(stock, 45)

  const validation = validateItemStock({ medicineId: 'med-02', quantity: 10 }, mockBackendMedicines)
  assert.equal(validation.isValid, true)
  assert.equal(validation.error, null)
  assert.equal(validation.warning, null)
})

test('TC03: Tồn = 20, kê 10 -> Hợp lệ', () => {
  const item = { medicineId: 'med-05', quantity: 10 }
  const validation = validateItemStock(item, mockBackendMedicines)
  assert.equal(validation.isValid, true)
  assert.equal(validation.isShortage, false)
})

test('TC04: Tồn = 20, kê 30 -> Cho phép kê đơn, trả về cảnh báo mềm thiếu tồn kho để cấp phát một phần', () => {
  const item = { medicineId: 'med-05', quantity: 30 }
  const validation = validateItemStock(item, mockBackendMedicines)
  assert.equal(validation.isValid, true, 'Kê vượt tồn kho vẫn hợp lệ, không bị chặn')
  assert.equal(validation.isShortage, true)
  assert.ok(validation.warning.includes('chỉ còn 20'))
  assert.ok(validation.warning.includes('cấp phát một phần'))
})

test('TC05: Tồn thay đổi từ 10 -> 0 trước khi lưu -> Không chặn lưu, cập nhật cảnh báo mềm hết hàng', () => {
  const initialMedicines = [
    { id: 'med-05', medicineName: 'Ibuprofen 400 mg', stockQuantity: 10, unit: 'viên', active: true },
  ]
  const initialCheck = validateItemStock({ medicineId: 'med-05', quantity: 5 }, initialMedicines)
  assert.equal(initialCheck.isValid, true)
  assert.equal(initialCheck.isOutOfStock, false)

  const updatedMedicines = [
    { id: 'med-05', medicineName: 'Ibuprofen 400 mg', stockQuantity: 0, unit: 'viên', active: true },
  ]
  const liveCheck = validateItemStock({ medicineId: 'med-05', quantity: 5 }, updatedMedicines)
  assert.equal(liveCheck.isValid, true, 'Vẫn cho phép lưu đơn khi tồn giảm về 0')
  assert.equal(liveCheck.isOutOfStock, true)
  assert.ok(liveCheck.warning.includes('hết hàng'))
})

test('TC06: Có 2 thuốc, 1 thuốc không đủ tồn -> Vẫn cho phép tạo toàn bộ đơn và ghi nhận cảnh báo', () => {
  const prescriptionItems = [
    { medicineId: 'med-01', quantity: 10 },
    { medicineId: 'med-05', quantity: 30 },
  ]

  const validation = validatePrescriptionStock(prescriptionItems, mockBackendMedicines)
  assert.equal(validation.isValid, true, 'Đơn thuốc vẫn hợp lệ để tạo')
  assert.equal(validation.errors.length, 0)
  assert.equal(validation.warnings.length, 1)
  assert.ok(validation.warnings[0].includes('Ibuprofen'))
  assert.ok(validation.warnings[0].includes('cấp phát một phần'))
})

test('TC07: Được phép gọi Create Prescription API khi có thuốc thiếu hàng/hết hàng (hỗ trợ cấp phát một phần)', () => {
  let apiCalled = false
  const fakeCreatePrescriptionApi = () => {
    apiCalled = true
    return Promise.resolve({ data: { id: 'presc-1' } })
  }

  const itemsWithShortage = [
    { medicineId: 'med-03', quantity: 5 },
  ]

  const validation = validatePrescriptionStock(itemsWithShortage, mockBackendMedicines)

  if (validation.isValid) {
    fakeCreatePrescriptionApi()
  }

  assert.equal(apiCalled, true, 'Create Prescription API PHẢI được gọi khi có thuốc hết hàng/thiếu hàng')
})

test('TC08: Thuốc hết hàng không bị xóa khỏi danh mục dropdown (sorted: còn hàng trước, hết hàng sau)', () => {
  const sortedMeds = sortMedicinesByStockAvailability(mockBackendMedicines)

  assert.equal(sortedMeds.length, mockBackendMedicines.length)

  assert.ok(getAvailableStock(sortedMeds[0]) > 0)
  assert.ok(getAvailableStock(sortedMeds[1]) > 0)
  assert.ok(getAvailableStock(sortedMeds[2]) > 0)

  assert.equal(getAvailableStock(sortedMeds[sortedMeds.length - 2]), 0)
  assert.equal(getAvailableStock(sortedMeds[sortedMeds.length - 1]), 0)
})

test('TC09: Không hardcode tồn kho, lấy đúng field stockQuantity/availableStock từ Backend response', () => {
  const medWithStockQuantity = { id: 'm1', medicineName: 'Test Med', stockQuantity: 77 }
  const medWithAvailableStock = { id: 'm2', medicineName: 'Test Med 2', availableStock: 88 }

  assert.equal(getAvailableStock(medWithStockQuantity), 77)
  assert.equal(getAvailableStock(medWithAvailableStock), 88)
})
