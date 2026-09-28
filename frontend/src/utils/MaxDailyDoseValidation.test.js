import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESET_MAX_DOSE_OVERRIDE_REASONS,
  formatDoseNumber,
  validateOverrideReason,
  formatDoseWarningMessage,
  hasUnresolvedWarnings,
  buildOverridesPayload,
  parseSingleDoseQuantity,
  calculateAutoQuantity,
  validateMedicineDoseConfig,
  buildMedicineDosePayload,
} from './maxDailyDoseHelpers.js'

test('1. PRESET_MAX_DOSE_OVERRIDE_REASONS contains valid clinical presets', () => {
  assert.ok(Array.isArray(PRESET_MAX_DOSE_OVERRIDE_REASONS))
  assert.ok(PRESET_MAX_DOSE_OVERRIDE_REASONS.length >= 3)
  assert.ok(PRESET_MAX_DOSE_OVERRIDE_REASONS.some((r) => r.includes('tấn công') || r.includes('hội chẩn')))
})

test('2. formatDoseNumber formats integers and decimals cleanly', () => {
  assert.equal(formatDoseNumber(4000), '4000')
  assert.equal(formatDoseNumber('3000'), '3000')
  assert.equal(formatDoseNumber(2.5), '2.5')
  assert.equal(formatDoseNumber(0.30000000000000004), '0.3')
  assert.equal(formatDoseNumber(null), '0')
})

test('3. validateOverrideReason rejects null, undefined, empty, and whitespace-only reasons', () => {
  assert.equal(validateOverrideReason(null).valid, false)
  assert.equal(validateOverrideReason(undefined).valid, false)
  assert.equal(validateOverrideReason('').valid, false)
  assert.equal(validateOverrideReason('   ').valid, false)
  assert.match(validateOverrideReason('').error, /không được để trống/)
})

test('4. validateOverrideReason rejects reason exceeding 500 characters', () => {
  const longReason = 'x'.repeat(501)
  const res = validateOverrideReason(longReason)
  assert.equal(res.valid, false)
  assert.match(res.error, /không được vượt quá 500 ký tự/)
})

test('5. validateOverrideReason accepts valid reason and trims whitespace', () => {
  const reason = '  Bệnh nhân sốt cao ác tính, chỉ định liều tấn công trong 24h  '
  const res = validateOverrideReason(reason)
  assert.equal(res.valid, true)
  assert.equal(res.error, '')
  assert.equal(res.trimmedReason, 'Bệnh nhân sốt cao ác tính, chỉ định liều tấn công trong 24h')
})

test('6. formatDoseWarningMessage formats message with exact numbers and active ingredient', () => {
  const warning = {
    activeIngredient: 'Paracetamol',
    totalDailyDoseMg: 5000,
    maxDailyDoseMg: 4000,
  }
  const expected = 'Hoạt chất Paracetamol: tổng liều 5000mg/ngày vượt ngưỡng tối đa 4000mg/ngày (vượt 1000mg).'
  assert.equal(formatDoseWarningMessage(warning), expected)

  const decimalWarning = {
    activeIngredient: 'Dexamethasone',
    totalDailyDoseMg: 2.5,
    maxDailyDoseMg: 2,
  }
  const expectedDecimal = 'Hoạt chất Dexamethasone: tổng liều 2.5mg/ngày vượt ngưỡng tối đa 2mg/ngày (vượt 0.5mg).'
  assert.equal(formatDoseWarningMessage(decimalWarning), expectedDecimal)
})

test('7. hasUnresolvedWarnings detects unresolved warnings correctly', () => {
  const warnings = [
    { activeIngredient: 'Paracetamol', totalDailyDoseMg: 5000, maxDailyDoseMg: 4000 },
    { activeIngredient: 'Ibuprofen', totalDailyDoseMg: 3200, maxDailyDoseMg: 2400 },
  ]

  // Case 1: Empty reason map -> unresolved
  assert.equal(hasUnresolvedWarnings(warnings, {}), true)

  // Case 2: Only 1 ingredient resolved -> still unresolved
  assert.equal(
    hasUnresolvedWarnings(warnings, {
      Paracetamol: 'Liều tấn công cấp cứu',
    }),
    true,
  )

  // Case 3: Both resolved with valid reasons -> resolved (returns false)
  assert.equal(
    hasUnresolvedWarnings(warnings, {
      Paracetamol: 'Liều tấn công cấp cứu',
      Ibuprofen: 'Bệnh nhân đau cấp, theo dõi dạ dày',
    }),
    false,
  )

  // Case 4: One reason is whitespace only -> unresolved
  assert.equal(
    hasUnresolvedWarnings(warnings, {
      Paracetamol: 'Liều tấn công cấp cứu',
      Ibuprofen: '    ',
    }),
    true,
  )

  // Case 5: No warnings -> resolved (returns false)
  assert.equal(hasUnresolvedWarnings([], {}), false)
  assert.equal(hasUnresolvedWarnings(null, {}), false)
})

test('8. buildOverridesPayload correctly constructs payload for API', () => {
  const warnings = [
    { activeIngredient: 'Paracetamol', totalDailyDoseMg: 5000, maxDailyDoseMg: 4000 },
    { activeIngredient: 'Ibuprofen', totalDailyDoseMg: 3200, maxDailyDoseMg: 2400 },
  ]
  const reasonMap = {
    Paracetamol: '  Liều tấn công kiểm soát đau cấp  ',
    Ibuprofen: 'Chỉ định ngắn ngày 2 ngày',
  }

  const payload = buildOverridesPayload(warnings, reasonMap)
  assert.deepEqual(payload, [
    {
      activeIngredient: 'Paracetamol',
      overrideReason: 'Liều tấn công kiểm soát đau cấp',
    },
    {
      activeIngredient: 'Ibuprofen',
      overrideReason: 'Chỉ định ngắn ngày 2 ngày',
    },
  ])

  // Omits ingredients without valid reason
  const partialMap = {
    Paracetamol: 'Liều tấn công',
    Ibuprofen: '   ',
  }
  const partialPayload = buildOverridesPayload(warnings, partialMap)
  assert.deepEqual(partialPayload, [
    {
      activeIngredient: 'Paracetamol',
      overrideReason: 'Liều tấn công',
    },
  ])

  // Handles duplicate activeIngredients gracefully
  const dupWarnings = [
    { activeIngredient: 'Paracetamol', totalDailyDoseMg: 5000, maxDailyDoseMg: 4000 },
    { activeIngredient: 'Paracetamol', totalDailyDoseMg: 5000, maxDailyDoseMg: 4000 },
  ]
  const dupPayload = buildOverridesPayload(dupWarnings, { Paracetamol: 'Lý do' })
  assert.equal(dupPayload.length, 1)
})

test('9. parseSingleDoseQuantity parses numbers, fractions, and strings correctly', () => {
  assert.equal(parseSingleDoseQuantity(2), 2)
  assert.equal(parseSingleDoseQuantity('1 viên'), 1)
  assert.equal(parseSingleDoseQuantity('2 viên'), 2)
  assert.equal(parseSingleDoseQuantity('1/2 viên'), 0.5)
  assert.equal(parseSingleDoseQuantity('1.5 ống'), 1.5)
  assert.equal(parseSingleDoseQuantity('1,5 viên'), 1.5)
  assert.equal(parseSingleDoseQuantity('', 1), 1)
  assert.equal(parseSingleDoseQuantity(undefined, 1), 1)
})

test('10. calculateAutoQuantity calculates (singleDoseQuantity * frequency * durationDays) accurately', () => {
  // Case from user's screenshot & question: 8 viên/lần × 2 lần/ngày × 5 ngày = 80 viên
  assert.equal(
    calculateAutoQuantity({ dosage: '8 viên', frequency: 2, durationDays: 5 }),
    80,
  )

  // Case from test verification: 1 viên/lần × 3 lần/ngày × 7 ngày = 21 viên
  assert.equal(
    calculateAutoQuantity({ dosage: '1 viên', frequency: 3, durationDays: 7 }),
    21,
  )

  // Case with screenshot 2: 8 viên/lần × 4 lần/ngày × 2 ngày = 64 viên
  assert.equal(
    calculateAutoQuantity({ dosage: '8 viên', frequency: 4, durationDays: 2 }),
    64,
  )

  // Fraction dosage: 1/2 viên/lần × 2 lần/ngày × 5 ngày = 5 viên
  assert.equal(
    calculateAutoQuantity({ dosage: '1/2 viên', frequency: 2, durationDays: 5 }),
    5,
  )

  // Direct numeric singleDoseQuantity priority
  assert.equal(
    calculateAutoQuantity({ singleDoseQuantity: 8, dosage: '1 viên', frequency: 2, durationDays: 5 }),
    80,
  )

  // Edge cases (empty/missing)
  assert.equal(calculateAutoQuantity(null), 0)
  assert.equal(calculateAutoQuantity({ dosage: '2 viên', frequency: 0, durationDays: 5 }), 0)
})

test('11. validateMedicineDoseConfig accepts both empty values as valid with nulls and no warning', () => {
  const res1 = validateMedicineDoseConfig(null, null)
  assert.equal(res1.valid, true)
  assert.equal(res1.error, '')
  assert.equal(res1.warning, '')
  assert.equal(res1.strengthValueMg, null)
  assert.equal(res1.maxDailyDoseMg, null)

  const res2 = validateMedicineDoseConfig(undefined, undefined)
  assert.equal(res2.valid, true)
  assert.equal(res2.strengthValueMg, null)
  assert.equal(res2.maxDailyDoseMg, null)

  const res3 = validateMedicineDoseConfig('', '')
  assert.equal(res3.valid, true)
  assert.equal(res3.strengthValueMg, null)
  assert.equal(res3.maxDailyDoseMg, null)
})

test('12. validateMedicineDoseConfig accepts valid positive numbers for both fields', () => {
  const res = validateMedicineDoseConfig(500, 4000)
  assert.equal(res.valid, true)
  assert.equal(res.error, '')
  assert.equal(res.warning, '')
  assert.equal(res.strengthValueMg, 500)
  assert.equal(res.maxDailyDoseMg, 4000)

  // Accepts numeric strings
  const resStr = validateMedicineDoseConfig('400.5', '2400')
  assert.equal(resStr.valid, true)
  assert.equal(resStr.strengthValueMg, 400.5)
  assert.equal(resStr.maxDailyDoseMg, 2400)
})

test('13. validateMedicineDoseConfig gives soft warning when only 1 is provided (does NOT block)', () => {
  // Only strength provided
  const res1 = validateMedicineDoseConfig(500, null)
  assert.equal(res1.valid, true)
  assert.equal(res1.error, '')
  assert.match(res1.warning, /Cần khai báo đủ cả hàm lượng và liều tối đa thì mới kiểm tra được/)
  assert.equal(res1.strengthValueMg, 500)
  assert.equal(res1.maxDailyDoseMg, null)

  // Only max daily dose provided
  const res2 = validateMedicineDoseConfig('', 4000)
  assert.equal(res2.valid, true)
  assert.equal(res2.error, '')
  assert.match(res2.warning, /Cần khai báo đủ cả hàm lượng và liều tối đa thì mới kiểm tra được/)
  assert.equal(res2.strengthValueMg, null)
  assert.equal(res2.maxDailyDoseMg, 4000)
})

test('14. validateMedicineDoseConfig rejects values <= 0 or invalid strings with error', () => {
  // Zero strength
  const resZero = validateMedicineDoseConfig(0, 4000)
  assert.equal(resZero.valid, false)
  assert.match(resZero.error, /phải lớn hơn 0/)

  // Negative max dose
  const resNeg = validateMedicineDoseConfig(500, -100)
  assert.equal(resNeg.valid, false)
  assert.match(resNeg.error, /phải lớn hơn 0/)

  // Non-numeric string
  const resNaN = validateMedicineDoseConfig('abc', 4000)
  assert.equal(resNaN.valid, false)
  assert.match(resNaN.error, /phải là số hợp lệ/)
})

test('15. buildMedicineDosePayload returns null for empty, zero, negative, or invalid values', () => {
  // Empty object
  const p1 = buildMedicineDosePayload({})
  assert.deepEqual(p1, { strengthValueMg: null, maxDailyDoseMg: null })

  // Empty strings and zeros
  const p2 = buildMedicineDosePayload({ strengthValueMg: '', maxDailyDoseMg: 0 })
  assert.deepEqual(p2, { strengthValueMg: null, maxDailyDoseMg: null })

  // Negative values
  const p3 = buildMedicineDosePayload({ strengthValueMg: -500, maxDailyDoseMg: -4000 })
  assert.deepEqual(p3, { strengthValueMg: null, maxDailyDoseMg: null })
})

test('16. buildMedicineDosePayload rounds to 3 decimal places matching DECIMAL(12,3)', () => {
  const p = buildMedicineDosePayload({
    strengthValueMg: '500.1234',
    maxDailyDoseMg: 4000,
  })
  assert.equal(p.strengthValueMg, 500.123)
  assert.equal(p.maxDailyDoseMg, 4000)

  const pDemo = buildMedicineDosePayload({
    strengthValueMg: 500,
    maxDailyDoseMg: 4000,
  })
  assert.deepEqual(pDemo, { strengthValueMg: 500, maxDailyDoseMg: 4000 })
})

