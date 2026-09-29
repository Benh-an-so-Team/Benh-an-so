import assert from 'node:assert/strict'
import test from 'node:test'
import { getCategoryFromIcdCode, icd10Categories } from '../../utils/icd10Data.js'

test('TC01: Validate định dạng mã bệnh ICD-10', () => {
  const isValidIcdCode = (code) => {
    if (!code || typeof code !== 'string') return false
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length === 0 || trimmed.length > 30) return false
    return /^[A-Z0-9.]+$/.test(trimmed)
  }

  assert.strictEqual(isValidIcdCode('J00'), true)
  assert.strictEqual(isValidIcdCode('J06.9'), true)
  assert.strictEqual(isValidIcdCode('E11.9'), true)
  assert.strictEqual(isValidIcdCode('I10'), true)
  assert.strictEqual(isValidIcdCode('K29.7'), true)
  assert.strictEqual(isValidIcdCode(''), false)
  assert.strictEqual(isValidIcdCode('   '), false)
  assert.strictEqual(isValidIcdCode('J00@#$'), false)
  assert.strictEqual(isValidIcdCode('A'.repeat(31)), false)
})

test('TC02: Mapping nhóm bệnh ICD theo ký tự đầu của mã bệnh', () => {
  assert.strictEqual(getCategoryFromIcdCode('J00'), 'RESPIRATORY')
  assert.strictEqual(getCategoryFromIcdCode('I10'), 'CIRCULATORY')
  assert.strictEqual(getCategoryFromIcdCode('K30'), 'DIGESTIVE')
  assert.strictEqual(getCategoryFromIcdCode('E11.9'), 'ENDOCRINE')
  assert.strictEqual(getCategoryFromIcdCode('A09'), 'INFECTIOUS')
  assert.strictEqual(getCategoryFromIcdCode('C50'), 'NEOPLASMS')
  assert.strictEqual(getCategoryFromIcdCode('M54.5'), 'MUSCULOSKELETAL')
  assert.strictEqual(getCategoryFromIcdCode('N39.0'), 'GENITOURINARY')
  assert.strictEqual(getCategoryFromIcdCode('Z00.0'), 'FACTORS')
  assert.strictEqual(getCategoryFromIcdCode(''), 'ALL')
})

test('TC03: Danh mục nhóm bệnh chuẩn icd10Categories có đầy đủ các nhóm', () => {
  assert.ok(icd10Categories.length >= 15)
  const keys = icd10Categories.map((c) => c.key)
  assert.ok(keys.includes('ALL'))
  assert.ok(keys.includes('RESPIRATORY'))
  assert.ok(keys.includes('DIGESTIVE'))
  assert.ok(keys.includes('CIRCULATORY'))
  assert.ok(keys.includes('INFECTIOUS'))
  assert.ok(keys.includes('ENDOCRINE'))
})

test('TC04: Kiểm thử lọc danh sách mã bệnh theo từ khóa và trạng thái', () => {
  const sampleList = [
    { id: '1', code: 'J00', name: 'Cảm lạnh thông thường', diseaseGroup: 'Hô hấp', active: true },
    { id: '2', code: 'J02.9', name: 'Viêm họng cấp', diseaseGroup: 'Hô hấp', active: false },
    { id: '3', code: 'K29.7', name: 'Viêm dạ dày', diseaseGroup: 'Tiêu hóa', active: true },
    { id: '4', code: 'I10', name: 'Tăng huyết áp vô căn', diseaseGroup: 'Tim mạch', active: true },
  ]

  const filterCatalogs = (list, keyword, status, group) => {
    return list.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.code.toLowerCase().includes(keyword.toLowerCase()) ||
        item.name.toLowerCase().includes(keyword.toLowerCase())
      const matchStatus =
        status === 'ALL' ||
        (status === 'ACTIVE' && item.active) ||
        (status === 'INACTIVE' && !item.active)
      const matchGroup = group === 'ALL' || item.diseaseGroup === group
      return matchKeyword && matchStatus && matchGroup
    })
  }

  const jResults = filterCatalogs(sampleList, 'J', 'ALL', 'ALL')
  assert.strictEqual(jResults.length, 2)

  const activeResults = filterCatalogs(sampleList, '', 'ACTIVE', 'ALL')
  assert.strictEqual(activeResults.length, 3)

  const inactiveResults = filterCatalogs(sampleList, '', 'INACTIVE', 'ALL')
  assert.strictEqual(inactiveResults.length, 1)
  assert.strictEqual(inactiveResults[0].code, 'J02.9')

  const digestiveResults = filterCatalogs(sampleList, '', 'ALL', 'Tiêu hóa')
  assert.strictEqual(digestiveResults.length, 1)
  assert.strictEqual(digestiveResults[0].code, 'K29.7')
})

test('TC05: Chuẩn hóa payload thêm mới và chỉnh sửa mã bệnh', () => {
  const normalizeCreatePayload = (formValues) => ({
    code: String(formValues.code || '').trim().toUpperCase(),
    name: String(formValues.name || '').trim(),
    diseaseGroup: String(formValues.diseaseGroup || '').trim(),
    description: formValues.description ? String(formValues.description).trim() : null,
  })

  const payload = normalizeCreatePayload({
    code: '  j06.9  ',
    name: '  Viêm mũi họng cấp  ',
    diseaseGroup: ' Hô hấp ',
    description: '  Ghi chú lâm sàng  ',
  })

  assert.deepStrictEqual(payload, {
    code: 'J06.9',
    name: 'Viêm mũi họng cấp',
    diseaseGroup: 'Hô hấp',
    description: 'Ghi chú lâm sàng',
  })
})
