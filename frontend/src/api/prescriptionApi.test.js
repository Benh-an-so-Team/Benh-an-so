import assert from 'node:assert/strict'
import test from 'node:test'
import prescriptionApi from './prescriptionApi.js'
import pharmacyApi from './pharmacyApi.js'

test('1. prescriptionApi is defined and includes checkMaxDailyDose', () => {
  assert.equal(typeof prescriptionApi.checkMaxDailyDose, 'function')
  assert.equal(typeof pharmacyApi.checkMaxDailyDose, 'function')
})

test('2. prescriptionApi re-exports standard pharmacyApi functions', () => {
  assert.equal(typeof prescriptionApi.createPrescription, 'function')
  assert.equal(typeof prescriptionApi.updatePrescription, 'function')
  assert.equal(typeof prescriptionApi.checkInteractions, 'function')
  assert.equal(typeof prescriptionApi.checkAllergyWarnings, 'function')
  assert.equal(typeof prescriptionApi.checkContraindications, 'function')
})
