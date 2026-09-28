import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'
import {
  calculateFinancialMetrics,
  aggregateDailyTimeline,
  aggregatePaymentMethods,
  getPresetDateRange,
  formatMoney,
} from '../../utils/revenueHelpers.js'

test('1. Kiểm thử TÍNH TOÁN DOANH THU THUẦN: Loại trừ chính xác khoản điều chỉnh', () => {
  const sampleInvoices = [
    {
      id: 'inv-1',
      invoiceCode: 'HD000001',
      invoiceType: 'ORIGINAL',
      totalAmount: 100000,
      createdAt: '2026-08-01T08:00:00Z',
    },
    {
      id: 'inv-2',
      invoiceCode: 'HD000002',
      invoiceType: 'ORIGINAL',
      totalAmount: 50000,
      createdAt: '2026-08-02T09:00:00Z',
    },
    {
      id: 'inv-3',
      invoiceCode: 'HDDC000001',
      invoiceType: 'ADJUSTMENT',
      totalAmount: -20000,
      createdAt: '2026-08-03T10:00:00Z',
    },
  ]

  const metrics = calculateFinancialMetrics(sampleInvoices, [], 3)

  assert.equal(metrics.grossRevenue, 150000)
  assert.equal(metrics.originalCount, 2)

  assert.equal(metrics.adjustmentTotal, -20000)
  assert.equal(metrics.adjustmentCount, 1)

  assert.equal(metrics.netRevenue, 130000)

  assert.ok(Math.abs(metrics.averageDaily - 43333.33) < 1)

  assert.ok(Math.abs(metrics.adjustmentRate - 13.33) < 0.1)
})

test('2. Kiểm thử DIỄN BIẾN DOANH THU THEO NGÀY (Daily Timeline Aggregation)', () => {
  const sampleInvoices = [
    {
      id: 'inv-1',
      invoiceCode: 'HD000001',
      invoiceType: 'ORIGINAL',
      totalAmount: 100000,
      createdAt: '2026-08-01T08:00:00Z',
    },
    {
      id: 'inv-2',
      invoiceCode: 'HD000002',
      invoiceType: 'ORIGINAL',
      totalAmount: 50000,
      createdAt: '2026-08-02T09:00:00Z',
    },
    {
      id: 'inv-3',
      invoiceCode: 'HDDC000001',
      invoiceType: 'ADJUSTMENT',
      totalAmount: -20000,
      createdAt: '2026-08-03T10:00:00Z',
    },
  ]

  const timeline = aggregateDailyTimeline(
    sampleInvoices,
    dayjs('2026-08-01'),
    dayjs('2026-08-03'),
  )

  assert.equal(timeline.length, 3)

  assert.equal(timeline[0].date, '2026-08-01')
  assert.equal(timeline[0].grossRevenue, 100000)
  assert.equal(timeline[0].adjustments, 0)
  assert.equal(timeline[0].netRevenue, 100000)

  assert.equal(timeline[1].date, '2026-08-02')
  assert.equal(timeline[1].grossRevenue, 50000)
  assert.equal(timeline[1].adjustments, 0)
  assert.equal(timeline[1].netRevenue, 50000)

  assert.equal(timeline[2].date, '2026-08-03')
  assert.equal(timeline[2].grossRevenue, 0)
  assert.equal(timeline[2].adjustments, -20000)
  assert.equal(timeline[2].netRevenue, -20000)
})

test('3. Kiểm thử TỔNG HỢP CƠ CẤU PHƯƠNG THỨC THANH TOÁN', () => {
  const sampleInvoices = [
    { totalAmount: 200000, paymentMethod: 'CASH' },
    { totalAmount: 300000, paymentMethod: 'BANK_TRANSFER' },
    { totalAmount: 500000, paymentMethod: 'CREDIT_CARD' },
  ]

  const paymentBreakdown = aggregatePaymentMethods(sampleInvoices)

  const cashItem = paymentBreakdown.find((m) => m.key === 'CASH')
  const transferItem = paymentBreakdown.find((m) => m.key === 'BANK_TRANSFER')
  const cardItem = paymentBreakdown.find((m) => m.key === 'CREDIT_CARD')

  assert.ok(cashItem)
  assert.equal(cashItem.total, 200000)
  assert.equal(cashItem.percentage, 20)

  assert.ok(transferItem)
  assert.equal(transferItem.total, 300000)
  assert.equal(transferItem.percentage, 30)

  assert.ok(cardItem)
  assert.equal(cardItem.total, 500000)
  assert.equal(cardItem.percentage, 50)
})

test('4. Kiểm thử CÁC PRESET KỲ BÁO CÁO (Quick Date Presets)', () => {
  const [todayStart, todayEnd] = getPresetDateRange('today')
  assert.equal(todayStart.format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD'))
  assert.equal(todayEnd.format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD'))

  const [sevenStart, sevenEnd] = getPresetDateRange('7days')
  const diffDays7 = sevenEnd.diff(sevenStart, 'day') + 1
  assert.equal(diffDays7, 7)

  const [thirtyStart, thirtyEnd] = getPresetDateRange('30days')
  const diffDays30 = thirtyEnd.diff(thirtyStart, 'day') + 1
  assert.equal(diffDays30, 30)

  const [monthStart, monthEnd] = getPresetDateRange('thisMonth')
  assert.equal(monthStart.format('YYYY-MM-DD'), dayjs().startOf('month').format('YYYY-MM-DD'))
  assert.equal(monthEnd.format('YYYY-MM-DD'), dayjs().endOf('month').format('YYYY-MM-DD'))
})

test('5. Kiểm thử ĐỊNH DẠNG TIỀN TỆ (Currency Formatting)', () => {
  assert.equal(formatMoney(100000), '100.000 đ')
  assert.equal(formatMoney(0), '0 đ')
  assert.equal(formatMoney(-20000), '-20.000 đ')
  assert.equal(formatMoney(null), '0 đ')
})
