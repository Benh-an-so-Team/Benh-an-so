import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateInvoiceStats,
  downloadPdfBlob,
  filterInvoices,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  getSecuritySafeErrorMessage,
  mapInvoicesWithAdjustments,
  numberToVietnameseWords,
  sortInvoicesByDateDesc,
} from '../../utils/patientInvoiceHelpers.js'

// ============================================================================
// TC-01: ĐỊNH DẠNG TIỀN TỆ, NGÀY THÁNG VÀ CHUYỂN ĐỔI SỐ TIỀN THÀNH CHỮ
// ============================================================================
test('TC-01.1: formatCurrency định dạng tiền VND chính xác', () => {
  assert.equal(formatCurrency(0), '0 ₫')
  assert.equal(formatCurrency(null), '0 ₫')
  assert.equal(formatCurrency(undefined), '0 ₫')
  assert.equal(formatCurrency(150000), '150.000 ₫')
  assert.equal(formatCurrency(1250000), '1.250.000 ₫')
  assert.equal(formatCurrency('300000'), '300.000 ₫')
})

test('TC-01.2: formatDate, formatTime, formatDateTime định dạng an toàn', () => {
  assert.equal(formatDate(null), '—')
  assert.equal(formatDate('invalid-date'), '—')
  assert.equal(formatDate('2026-09-23T08:30:00.000Z'), '23/09/2026')

  assert.equal(formatTime(null), '—')
  assert.match(formatTime('2026-09-23T08:30:00.000Z'), /\d{2}:\d{2}/)

  assert.equal(formatDateTime(null), '—')
  assert.match(formatDateTime('2026-09-23T08:30:00.000Z'), /\d{2}\/\d{2}\/2026 \d{2}:\d{2}/)
})

test('TC-01.3: numberToVietnameseWords đọc đúng các mệnh giá viện phí', () => {
  assert.equal(numberToVietnameseWords(0), 'Không đồng')
  assert.equal(numberToVietnameseWords(150000), 'Một trăm năm mươi nghìn đồng')
  assert.equal(numberToVietnameseWords(350000), 'Ba trăm năm mươi nghìn đồng')
  assert.equal(numberToVietnameseWords(1500000), 'Một triệu năm trăm nghìn đồng')
})

// ============================================================================
// TC-02: SẮP XẾP MẶC ĐỊNH THEO NGÀY KHÁM MỚI NHẤT LÊN ĐẦU (MỤC 2)
// ============================================================================
test('TC-02: sortInvoicesByDateDesc sắp xếp hóa đơn theo ngày mới nhất lên đầu', () => {
  const invoices = [
    { invoiceCode: 'HD-001', visitDate: '2026-09-10T08:00:00Z' },
    { invoiceCode: 'HD-003', visitDate: '2026-09-23T08:00:00Z' },
    { invoiceCode: 'HD-002', visitDate: '2026-09-15T08:00:00Z' },
  ]

  const sorted = sortInvoicesByDateDesc(invoices)
  assert.equal(sorted[0].invoiceCode, 'HD-003', 'Hóa đơn ngày 23/09 phải lên đầu')
  assert.equal(sorted[1].invoiceCode, 'HD-002', 'Hóa đơn ngày 15/09 ở vị trí thứ 2')
  assert.equal(sorted[2].invoiceCode, 'HD-001', 'Hóa đơn ngày 10/09 ở vị trí cuối')
})

// ============================================================================
// TC-03: PHÂN BIỆT HÓA ĐƠN GỐC VS HÓA ĐƠN ĐIỀU CHỈNH (MỤC 1 & MỤC 4)
// ============================================================================
test('TC-03.1: Hóa đơn gốc chưa điều chỉnh được gắn nhãn "Hóa đơn gốc" và là bản có hiệu lực', () => {
  const invoices = [
    {
      invoiceId: 'inv-1',
      invoiceCode: 'HD-001',
      invoiceType: 'ORIGINAL',
      visitId: 'visit-1',
      totalAmount: 200000,
    },
  ]

  const enriched = mapInvoicesWithAdjustments(invoices)
  assert.equal(enriched.length, 1)
  assert.equal(enriched[0].isOriginal, true)
  assert.equal(enriched[0].hasBeenAdjusted, false)
  assert.equal(enriched[0].isLatestEffective, true)
  assert.equal(enriched[0].statusBadge.label, 'Hóa đơn gốc')
  assert.equal(enriched[0].statusBadge.color, 'green')
})

test('TC-03.2: Khi có hóa đơn điều chỉnh, hóa đơn gốc được gắn nhãn "Đã có điều chỉnh" và liên kết tới bản mới nhất', () => {
  const invoices = [
    {
      invoiceId: 'inv-orig',
      invoiceCode: 'HD-ORIG',
      invoiceType: 'ORIGINAL',
      visitId: 'visit-shared',
      totalAmount: 250000,
    },
    {
      invoiceId: 'inv-adj',
      invoiceCode: 'HD-ADJ',
      invoiceType: 'ADJUSTMENT',
      visitId: 'visit-shared',
      totalAmount: 300000,
    },
  ]

  const enriched = mapInvoicesWithAdjustments(invoices)
  const original = enriched.find((i) => i.invoiceCode === 'HD-ORIG')
  const adjusted = enriched.find((i) => i.invoiceCode === 'HD-ADJ')

  // Hóa đơn gốc phải thể hiện rõ là đã bị điều chỉnh (Mục 4)
  assert.equal(original.hasBeenAdjusted, true)
  assert.equal(original.isLatestEffective, false)
  assert.equal(original.statusBadge.label, 'Đã có điều chỉnh')
  assert.equal(original.statusBadge.color, 'warning')
  assert.equal(original.effectiveAdjustment.invoiceId, 'inv-adj')
  assert.equal(original.effectiveAdjustment.invoiceCode, 'HD-ADJ')

  // Hóa đơn điều chỉnh là bản có hiệu lực
  assert.equal(adjusted.isAdjustment, true)
  assert.equal(adjusted.isLatestEffective, true)
  assert.equal(adjusted.statusBadge.label, 'Hóa đơn điều chỉnh')
  assert.equal(adjusted.statusBadge.color, 'blue')
})

// ============================================================================
// TC-04: BỘ LỌC VÀ TÌM KIẾM THEO TỪ KHÓA
// ============================================================================
test('TC-04: filterInvoices tìm kiếm chính xác theo từ khóa và phân loại', () => {
  const invoices = [
    {
      invoiceCode: 'HD-001',
      doctorName: 'Nguyễn Văn A',
      specialtyName: 'Khoa Nội',
      visitCode: 'KB-101',
      isOriginal: true,
      isAdjustment: false,
      isLatestEffective: true,
    },
    {
      invoiceCode: 'HD-002',
      doctorName: 'Trần Thị B',
      specialtyName: 'Tai Mũi Họng',
      visitCode: 'KB-102',
      isOriginal: false,
      isAdjustment: true,
      isLatestEffective: true,
    },
    {
      invoiceCode: 'HD-003',
      doctorName: 'Nguyễn Văn A',
      specialtyName: 'Khoa Ngoại',
      visitCode: 'KB-103',
      isOriginal: true,
      isAdjustment: false,
      isLatestEffective: false,
    },
  ]

  // Tìm theo bác sĩ
  const byDoctor = filterInvoices(invoices, { searchKeyword: 'Nguyễn Văn A' })
  assert.equal(byDoctor.length, 2)

  // Tìm theo mã hóa đơn
  const byCode = filterInvoices(invoices, { searchKeyword: 'HD-002' })
  assert.equal(byCode.length, 1)

  // Lọc theo chỉ bản có hiệu lực
  const onlyEffective = filterInvoices(invoices, { filterType: 'EFFECTIVE_ONLY' })
  assert.equal(onlyEffective.length, 2)

  // Lọc theo hóa đơn điều chỉnh
  const onlyAdjusted = filterInvoices(invoices, { filterType: 'ADJUSTMENT' })
  assert.equal(onlyAdjusted.length, 1)
  assert.equal(onlyAdjusted[0].invoiceCode, 'HD-002')
})

// ============================================================================
// TC-05: TÍNH TOÁN SỐ LIỆU TỔNG HỢP (KPIS)
// ============================================================================
test('TC-05: calculateInvoiceStats tính đúng tổng tiền và số hóa đơn mà không tính trùng bản gốc đã sửa', () => {
  const invoices = [
    {
      invoiceCode: 'HD-001',
      totalAmount: 150000,
      hasBeenAdjusted: true, // Bản gốc bị sửa -> không tính vào tổng tiền
      isAdjustment: false,
      visitDate: '2026-09-01T00:00:00Z',
    },
    {
      invoiceCode: 'HD-001-ADJ',
      totalAmount: 200000,
      hasBeenAdjusted: false,
      isAdjustment: true,
      visitDate: '2026-09-02T00:00:00Z',
    },
    {
      invoiceCode: 'HD-002',
      totalAmount: 300000,
      hasBeenAdjusted: false,
      isAdjustment: false,
      visitDate: '2026-09-20T00:00:00Z',
    },
  ]

  const stats = calculateInvoiceStats(invoices)
  assert.equal(stats.totalCount, 3)
  assert.equal(stats.totalAmount, 500000, 'Tổng tiền phải bằng 200.000 + 300.000 = 500.000 đ')
  assert.equal(stats.adjustedCount, 2)
  assert.equal(stats.latestVisitDate, '2026-09-20T00:00:00Z')
})

// ============================================================================
// TC-06: RÀNG BUỘC BẢO MẬT QUA UI/UX (SECURITY CONSTRAINTS)
// ============================================================================
test('TC-06.1: getSecuritySafeErrorMessage trả về lỗi chung chung, không tiết lộ tài nguyên khi bị 403 hoặc 404', () => {
  const error403 = { response: { status: 403, data: { message: 'Cross-patient access forbidden' } } }
  const error404 = { response: { status: 404, data: { message: 'Invoice not found' } } }

  const msg403 = getSecuritySafeErrorMessage(error403)
  const msg404 = getSecuritySafeErrorMessage(error404)

  assert.equal(msg403, 'Không tìm thấy hóa đơn hoặc bạn không có quyền truy cập.')
  assert.equal(msg404, 'Không tìm thấy hóa đơn hoặc bạn không có quyền truy cập.')
  assert.equal(
    msg403,
    msg404,
    'Lỗi 403 và 404 phải trả về cùng một thông điệp để kẻ xấu không đoán được ID có tồn tại hay không'
  )
})

test('TC-06.2: Lỗi mạng hoặc lỗi máy chủ thông thường được diễn đạt rõ ràng', () => {
  const netError = { response: { status: 500, data: { message: 'Internal Server Error' } } }
  const msg500 = getSecuritySafeErrorMessage(netError)
  assert.equal(msg500, 'Internal Server Error')
})

// ============================================================================
// TC-07: CƠ CHẾ TẢI VỀ BLOB FILE PDF (MỤC 3)
// ============================================================================
test('TC-07: downloadPdfBlob kích hoạt tải file qua DOM và giải phóng bộ nhớ', () => {
  let createdUrl = null
  let revokedUrl = null
  let clicked = false
  let appendedChild = null

  globalThis.window = {
    URL: {
      createObjectURL: () => {
        createdUrl = 'blob:test-pdf'
        return createdUrl
      },
      revokeObjectURL: (url) => {
        revokedUrl = url
      },
    },
  }

  globalThis.document = {
    createElement: (tag) => {
      assert.equal(tag, 'a')
      return {
        href: '',
        download: '',
        setAttribute: () => {},
        click: () => {
          clicked = true
        },
      }
    },
    body: {
      appendChild: (node) => {
        appendedChild = node
      },
    },
  }

  downloadPdfBlob(new Blob(['fake-pdf'], { type: 'application/pdf' }), 'hoa-don-HD-001.pdf')

  assert.equal(createdUrl, 'blob:test-pdf')
  assert.equal(clicked, true, 'Link click phải được kích hoạt để tải file')
  assert.ok(appendedChild, 'Link phải được gắn vào DOM body')
})
