import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RECONCILIATION_OUTCOMES,
  OUTCOME_CONFIG,
  getOutcomeTag,
  validateNote,
  canAddNote,
  canRetryInterconnection,
} from './prescriptionReconciliationHelpers.js'

test('1. getOutcomeTag covers all 5 outcomes defined in the reconciliation matrix', () => {
  const outcomes = [
    RECONCILIATION_OUTCOMES.CONSISTENT,
    RECONCILIATION_OUTCOMES.TRANSMITTED_NOT_DISPENSED,
    RECONCILIATION_OUTCOMES.DISPENSED_NOT_TRANSMITTED,
    RECONCILIATION_OUTCOMES.NOT_TRANSMITTED_NOT_DISPENSED,
    RECONCILIATION_OUTCOMES.CANCELLED,
  ]

  for (const outcome of outcomes) {
    const tag = getOutcomeTag(outcome)
    assert.ok(tag, `Tag for ${outcome} must exist`)
    assert.ok(tag.label, `Label for ${outcome} must not be empty`)
    assert.ok(tag.color, `Color for ${outcome} must be defined`)
    assert.ok(tag.bg, `Background color for ${outcome} must be defined`)
  }

  // DISPENSED_NOT_TRANSMITTED is the most severe discrepancy (dispensed without transmission)
  const dispensedNotTransmitted = getOutcomeTag(RECONCILIATION_OUTCOMES.DISPENSED_NOT_TRANSMITTED)
  assert.equal(dispensedNotTransmitted.isDiscrepancy, true)
  assert.equal(dispensedNotTransmitted.antdColor, 'error')

  // TRANSMITTED_NOT_DISPENSED is a discrepancy
  const transmittedNotDispensed = getOutcomeTag(RECONCILIATION_OUTCOMES.TRANSMITTED_NOT_DISPENSED)
  assert.equal(transmittedNotDispensed.isDiscrepancy, true)
  assert.equal(transmittedNotDispensed.antdColor, 'warning')

  // CONSISTENT is not a discrepancy
  const consistent = getOutcomeTag(RECONCILIATION_OUTCOMES.CONSISTENT)
  assert.equal(consistent.isDiscrepancy, false)
  assert.equal(consistent.antdColor, 'success')
})

test('2. canAddNote allows notes ONLY for active discrepancies and rejects cancelled or consistent prescriptions', () => {
  // Case A: Discrepant item (TRANSMITTED_NOT_DISPENSED)
  assert.equal(canAddNote({ discrepancy: true, prescriptionStatus: 'PENDING_DISPENSE' }), true)

  // Case B: Discrepant item (DISPENSED_NOT_TRANSMITTED)
  assert.equal(canAddNote({ discrepancy: true, prescriptionStatus: 'DISPENSED' }), true)

  // Case C: Non-discrepant item (CONSISTENT) -> MUST HIDE
  assert.equal(canAddNote({ discrepancy: false, prescriptionStatus: 'DISPENSED' }), false)

  // Case D: Non-discrepant item (NOT_TRANSMITTED_NOT_DISPENSED) -> MUST HIDE
  assert.equal(canAddNote({ discrepancy: false, prescriptionStatus: 'PENDING_DISPENSE' }), false)

  // Case E: Cancelled prescription -> MUST HIDE even if discrepancy flag was somehow true
  assert.equal(canAddNote({ discrepancy: true, prescriptionStatus: 'CANCELLED' }), false)
  assert.equal(canAddNote({ discrepancy: false, prescriptionStatus: 'CANCELLED' }), false)

  // Case F: Null or invalid item
  assert.equal(canAddNote(null), false)
  assert.equal(canAddNote(undefined), false)
})

test('3. canRetryInterconnection requires BOTH retransmissionEligible=true AND ADMIN role', () => {
  const eligibleItem = {
    retransmissionEligible: true,
    outcome: 'DISPENSED_NOT_TRANSMITTED',
    interconnectionStatus: 'FAILED',
  }
  const nonEligibleItem = {
    retransmissionEligible: false,
    outcome: 'DISPENSED_NOT_TRANSMITTED',
    interconnectionStatus: 'NOT_SENT',
  }

  // 1. Admin + Eligible -> ALLOWED
  assert.equal(canRetryInterconnection(eligibleItem, 'ADMIN'), true)
  assert.equal(canRetryInterconnection(eligibleItem, 'ROLE_ADMIN'), true)
  assert.equal(canRetryInterconnection(eligibleItem, ['admin', 'pharmacist']), true)
  assert.equal(canRetryInterconnection(eligibleItem, { roles: ['ADMIN'] }), true)

  // 2. Admin + NOT Eligible (e.g. from NOT_SENT) -> BLOCKED
  assert.equal(canRetryInterconnection(nonEligibleItem, 'ADMIN'), false)

  // 3. Pharmacist + Eligible -> STRICTLY BLOCKED (Pharmacist cannot retransmit per NCL-12-CN-004 authorization lock)
  assert.equal(canRetryInterconnection(eligibleItem, 'PHARMACIST'), false)
  assert.equal(canRetryInterconnection(eligibleItem, 'ROLE_PHARMACIST'), false)
  assert.equal(canRetryInterconnection(eligibleItem, ['pharmacist']), false)

  // 4. Other roles + Eligible -> BLOCKED
  assert.equal(canRetryInterconnection(eligibleItem, 'DOCTOR'), false)
  assert.equal(canRetryInterconnection(eligibleItem, 'RECEPTIONIST'), false)
  assert.equal(canRetryInterconnection(eligibleItem, null), false)
})

test('4. validateNote validates required presence and 500-char limit', () => {
  // Empty & whitespace
  assert.equal(validateNote(null).valid, false)
  assert.equal(validateNote(undefined).valid, false)
  assert.equal(validateNote('').valid, false)
  assert.equal(validateNote('   \n  \t ').valid, false)
  assert.match(validateNote('').error, /Vui lòng nhập lý do/)

  // Exceeds 500 characters
  const overLength = 'a'.repeat(501)
  assert.equal(validateNote(overLength).valid, false)
  assert.match(validateNote(overLength).error, /không được vượt quá 500 ký tự/)

  // Valid note
  const validNote = '  Đã liên hệ với cơ sở bảo hiểm và nhà thuốc xác nhận xuất bù vào ca chiều.  '
  const res = validateNote(validNote)
  assert.equal(res.valid, true)
  assert.equal(res.trimmed, 'Đã liên hệ với cơ sở bảo hiểm và nhà thuốc xác nhận xuất bù vào ca chiều.')
})
