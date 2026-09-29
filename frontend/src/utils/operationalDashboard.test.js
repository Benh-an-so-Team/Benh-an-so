import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildOperationalSnapshotFromReports,
  getActiveQueueCount,
  getVisitPercentage,
  normalizeOperationalDashboard,
} from './operationalDashboard.js'
import { getDefaultHomePath } from './roleRouting.js'

test('normalizes the operational dashboard response from the backend contract', () => {
  const result = normalizeOperationalDashboard({
    visitSummary: {
      total: 18,
      waiting: 4,
      inProgress: 3,
      completed: 10,
      cancelled: 1,
    },
    revenueSummary: { totalRevenueToday: '12500000.00' },
    inventoryAlertSummary: { lowStockCount: 2, expiryAlertCount: 5 },
    asOf: '2026-08-14T08:15:30Z',
  })

  assert.deepEqual(result.visitSummary, {
    total: 18,
    waiting: 4,
    inProgress: 3,
    completed: 10,
    cancelled: 1,
    earlyEnded: 0,
  })
  assert.equal(result.revenueSummary.totalRevenueToday, 12500000)
  assert.deepEqual(result.inventoryAlertSummary, {
    lowStockCount: 2,
    expiryAlertCount: 5,
  })
  assert.equal(result.asOf, '2026-08-14T08:15:30Z')
})

test('uses safe zero values when dashboard fields are absent or invalid', () => {
  const result = normalizeOperationalDashboard({
    visitSummary: { total: -1, waiting: 'invalid', completed: 2.9 },
    revenueSummary: { totalRevenueToday: null },
  })

  assert.deepEqual(result.visitSummary, {
    total: 0,
    waiting: 0,
    inProgress: 0,
    completed: 2,
    cancelled: 0,
    earlyEnded: 0,
  })
  assert.equal(result.revenueSummary.totalRevenueToday, 0)
  assert.deepEqual(result.inventoryAlertSummary, {
    lowStockCount: 0,
    expiryAlertCount: 0,
  })
  assert.equal(result.asOf, null)
})

test('derives queue workload and status percentages without division errors', () => {
  assert.equal(getActiveQueueCount({ waiting: 7, inProgress: 3 }), 10)
  assert.equal(getVisitPercentage(9, 12), 75)
  assert.equal(getVisitPercentage(3, 0), 0)
  assert.equal(getVisitPercentage(20, 10), 100)
})

test('buildOperationalSnapshotFromReports seamlessly creates snapshot from reportApi summary and records for MANAGER role', () => {
  const todayStr = '2026-08-14'
  const summary = {
    from: todayStr,
    to: todayStr,
    visitCount: 15,
    revenue: 4500000,
    currency: 'VND',
  }
  const records = [
    { id: '1', status: 'WAITING', createdAt: '2026-08-14T08:00:00' },
    { id: '2', status: 'IN_PROGRESS', createdAt: '2026-08-14T09:00:00' },
    { id: '3', status: 'COMPLETED', createdAt: '2026-08-14T09:30:00' },
    { id: '4', status: 'CANCELLED', createdAt: '2026-08-14T10:00:00' },
    { id: '5', status: 'COMPLETED', createdAt: '2026-08-13T10:00:00' },
  ]
  const medicines = [
    { id: 'm1', name: 'Paracetamol', stock: 5, minStock: 20, active: true },
    { id: 'm2', name: 'Amoxicillin', stock: 50, minStock: 10, active: true },
  ]

  const snapshot = buildOperationalSnapshotFromReports({
    summary,
    records,
    medicines,
    todayStr,
  })

  assert.equal(snapshot.visitSummary.waiting, 1)
  assert.equal(snapshot.visitSummary.inProgress, 1)
  assert.equal(snapshot.visitSummary.completed, 15)
  assert.equal(snapshot.visitSummary.cancelled, 1)
  assert.equal(snapshot.visitSummary.total, 18)

  assert.equal(snapshot.revenueSummary.totalRevenueToday, 4500000)
  assert.equal(snapshot.inventoryAlertSummary.lowStockCount, 1)
})

test('getDefaultHomePath directs each role to its primary allowed workspace without showing 403 dashboard', () => {
  // Admin / Manager / Clinic Manager -> '/' (Dashboard)
  assert.equal(getDefaultHomePath(['admin']), '/')
  assert.equal(getDefaultHomePath(['manager']), '/')
  assert.equal(getDefaultHomePath(['clinic_manager']), '/')
  assert.equal(getDefaultHomePath([], ['DASHBOARD_OPERATIONAL_READ']), '/')

  assert.equal(getDefaultHomePath(['doctor']), '/doctor/dashboard')
  assert.equal(getDefaultHomePath(['ROLE_DOCTOR']), '/doctor/dashboard')
  assert.equal(getDefaultHomePath([], ['MEDICAL_RECORD_READ']), '/medical-records')

  assert.equal(getDefaultHomePath(['receptionist']), '/appointments')

  assert.equal(getDefaultHomePath(['pharmacist']), '/pharmacy')
  assert.equal(getDefaultHomePath(['patient']), '/portal/dashboard')
  assert.equal(getDefaultHomePath(['ROLE_PATIENT']), '/portal/dashboard')
})
