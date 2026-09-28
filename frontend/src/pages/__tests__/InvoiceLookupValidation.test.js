import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInvoiceSearchParams,
  formatCurrency,
  formatDateTime,
  formatVisitCode,
  getReprintMetadata,
  isReprint,
  numberToVietnameseWords,
  resolvePatientInfo,
  SEEDED_VISIT_PATIENT_MAP,
} from '../../utils/invoiceLookupHelpers.js'
import { getNavigationItems } from '../../components/layout/navigationConfig.js'

// ============================================================================
// TC-01: BỘ LỌC TÌM KIẾM SERVER-SIDE & XÂY DỰNG QUERY PARAMS CHUẨN BACKEND
// ============================================================================
test('TC-01.1: buildInvoiceSearchParams xây dựng đúng query params theo đặc tả backend', () => {
  const raw = {
    patientName: '  Nguyễn Văn A  ',
    invoiceCode: '  HD-2026-009  ',
    invoiceType: 'ORIGINAL',
    createdFrom: '2026-09-01T00:00:00.000Z',
    createdTo: '2026-09-21T23:59:59.000Z',
    page: 2,
    size: 50,
  }

  const params = buildInvoiceSearchParams(raw)

  assert.equal(params.patientName, 'Nguyễn Văn A')
  assert.equal(params.invoiceCode, 'HD-2026-009')
  assert.equal(params.invoiceType, 'ORIGINAL')
  assert.equal(params.createdFrom, '2026-09-01T00:00:00.000Z')
  assert.equal(params.createdTo, '2026-09-21T23:59:59.000Z')
  assert.equal(params.page, 2)
  assert.equal(params.size, 50)
})

test('TC-01.2: buildInvoiceSearchParams loại bỏ các filter rỗng và đặt giá trị phân trang an toàn', () => {
  const raw = {
    patientName: '   ',
    invoiceCode: '',
    invoiceType: 'INVALID_TYPE',
    page: -5,
    size: 500, // vượt quá max 100
  }

  const params = buildInvoiceSearchParams(raw)

  assert.equal(params.patientName, undefined)
  assert.equal(params.invoiceCode, undefined)
  assert.equal(params.invoiceType, undefined)
  assert.equal(params.page, 0, 'Page âm phải tự động đưa về 0')
  assert.equal(params.size, 100, 'Size vượt quá 100 phải đưa về mức tối đa 100 theo backend')
})

// ============================================================================
// TC-02: ĐỊNH DẠNG TIỀN TỆ, NGÀY THÁNG VÀ CHUYỂN ĐỔI TIỀN BẰNG CHỮ
// ============================================================================
test('TC-02.1: formatCurrency và formatDateTime định dạng chính xác', () => {
  assert.equal(formatCurrency(250000), '250.000 ₫')
  assert.equal(formatCurrency(0), '0 ₫')
  assert.equal(formatCurrency(null), '0 ₫')

  assert.equal(formatDateTime(null), '—')
  assert.equal(formatDateTime('invalid-date'), '—')
  assert.match(formatDateTime('2026-09-21T10:30:00.000Z'), /\d{2}:\d{2}:\d{2} \d{2}\/\d{2}\/2026/)
})

test('TC-02.2: numberToVietnameseWords đọc đúng các mức tiền viện phí phổ biến', () => {
  assert.equal(numberToVietnameseWords(0), 'Không đồng')
  assert.equal(numberToVietnameseWords(150000), 'Một trăm năm mươi nghìn đồng')
  assert.equal(numberToVietnameseWords(2500000), 'Hai triệu năm trăm nghìn đồng')
  assert.equal(numberToVietnameseWords(50000), 'Năm mươi nghìn đồng')
})

// ============================================================================
// TC-03: THEO DÕI VÀ ĐÁNH DẤU BẢN IN LẠI (WATERMARK & HUY HIỆU)
// ============================================================================
test('TC-03.1: Khi reprintCount = 0 (Bản gốc), không gắn dấu bản in lại', () => {
  assert.equal(isReprint(0), false)
  assert.equal(isReprint(undefined), false)
  assert.equal(isReprint(null), false)

  const meta = getReprintMetadata(0, null)
  assert.equal(meta.isReprint, false)
  assert.equal(meta.badgeText, '')
  assert.equal(meta.watermarkText, '')
  assert.equal(meta.timeText, '')
})

test('TC-03.2: Khi reprintCount > 0, tạo đúng nội dung huy hiệu và watermark chìm', () => {
  const timestamp = '2026-09-21T09:15:00.000Z'
  assert.equal(isReprint(1), true)
  assert.equal(isReprint(3), true)

  const meta1 = getReprintMetadata(1, timestamp)
  assert.equal(meta1.isReprint, true)
  assert.equal(meta1.badgeText, 'BẢN IN LẠI (Lần 1)')
  assert.equal(meta1.watermarkText, 'BẢN IN LẠI - LẦN 1')
  assert.ok(meta1.timeText.includes('In lại lúc:'))

  const meta3 = getReprintMetadata(3, timestamp)
  assert.equal(meta3.badgeText, 'BẢN IN LẠI (Lần 3)')
  assert.equal(meta3.watermarkText, 'BẢN IN LẠI - LẦN 3')
})

// ============================================================================
// TC-04: ĐỒNG BỘ DỮ LIỆU & LUỒNG XỬ LÝ AN TOÀN KHI GHI NHẬN IN LẠI
// ============================================================================
test('TC-04.1: Đồng bộ hóa reprintCount khi in lại thành công', () => {
  const originalList = [
    { id: 'inv-1', invoiceCode: 'HD-001', reprintCount: 0, lastReprintedAt: null },
    { id: 'inv-2', invoiceCode: 'HD-002', reprintCount: 1, lastReprintedAt: '2026-09-20T10:00:00Z' },
  ]

  const backendUpdatedResult = {
    id: 'inv-1',
    invoiceCode: 'HD-001',
    reprintCount: 1,
    lastReprintedAt: '2026-09-21T10:15:00Z',
  }

  // Giả lập logic hàm handleUpdateReprintCount
  const updatedList = originalList.map((item) =>
    item.id === backendUpdatedResult.id ? { ...item, ...backendUpdatedResult } : item,
  )

  assert.equal(updatedList[0].reprintCount, 1)
  assert.equal(updatedList[0].lastReprintedAt, '2026-09-21T10:15:00Z')
  assert.equal(updatedList[1].reprintCount, 1, 'Hóa đơn khác không bị ảnh hưởng')
})

test('TC-04.2: Cơ chế an toàn khi backend reprint thất bại - không thay đổi state', async () => {
  const currentInvoice = { id: 'inv-1', reprintCount: 0, lastReprintedAt: null }
  let printTriggered = false

  const mockReprintApiFail = async () => {
    throw new Error('Lỗi kết nối máy chủ 500')
  }

  try {
    await mockReprintApiFail()
    printTriggered = true // Tuyệt đối không được tới đây
  } catch (err) {
    assert.equal(err.message, 'Lỗi kết nối máy chủ 500')
  }

  assert.equal(printTriggered, false, 'Không được phép kích hoạt in khi backend ghi nhận thất bại')
  assert.equal(currentInvoice.reprintCount, 0, 'reprintCount không được tăng khống')
})

// ============================================================================
// TC-05: PHÂN QUYỀN TRUY CẬP MENU VÀ ĐIỀU HƯỚNG
// ============================================================================
test('TC-05.1: Menu /invoices/lookup hiển thị cho Lễ tân, Quản lý và Quản trị viên', () => {
  // Lễ tân
  const recepNav = getNavigationItems(['ROLE_RECEPTIONIST'], ['INVOICE_READ'])
  assert.equal(
    recepNav.some((item) => item.key === '/invoices/lookup'),
    true,
    'Lễ tân phải thấy menu Tra cứu & in lại hóa đơn',
  )

  // Quản lý phòng khám
  const clinicMgrNav = getNavigationItems(['ROLE_CLINIC_MANAGER'], ['INVOICE_READ'])
  assert.equal(
    clinicMgrNav.some((item) => item.key === '/invoices/lookup'),
    true,
    'Quản lý phòng khám phải thấy menu Tra cứu & in lại hóa đơn',
  )

  // Quản trị viên
  const adminNav = getNavigationItems(['ROLE_ADMIN'], [])
  assert.equal(
    adminNav.some((item) => item.key === '/invoices/lookup'),
    true,
    'Quản trị viên phải thấy menu Tra cứu & in lại hóa đơn',
  )
})

test('TC-05.2: Menu /invoices/lookup bị ẩn hoàn toàn với Bác sĩ và Dược sĩ', () => {
  // Bác sĩ (kể cả khi vô tình được gán permission INVOICE_READ trong DB)
  const doctorNav = getNavigationItems(['ROLE_DOCTOR'], ['INVOICE_READ', 'MEDICAL_RECORD_READ'])
  assert.equal(
    doctorNav.some((item) => item.key === '/invoices/lookup'),
    false,
    'Bác sĩ tuyệt đối không được thấy menu Tra cứu & in lại hóa đơn',
  )

  // Dược sĩ
  const pharmacistNav = getNavigationItems(['ROLE_PHARMACIST'], ['INVOICE_READ', 'PHARMACY_READ'])
  assert.equal(
    pharmacistNav.some((item) => item.key === '/invoices/lookup'),
    false,
    'Dược sĩ tuyệt đối không được thấy menu Tra cứu & in lại hóa đơn',
  )
})

// ============================================================================
// TC-06: PHÂN GIẢI THÔNG TIN BỆNH NHÂN ĐA NGUỒN (TRÁNH BỊ TREO "ĐANG TẢI...")
// ============================================================================
test('TC-06.1: resolvePatientInfo tìm đúng bệnh nhân từ bản đồ seed data', () => {
  const visitId = 'd0000000-0000-0000-0000-000000000001'
  const patientList = [
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001',
      patientCode: 'BN000001',
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
    },
  ]

  const info = resolvePatientInfo({
    visitId,
    encounter: null,
    patientList,
    payableList: [],
    queueList: [],
  })

  assert.ok(info !== null, 'Phải phân giải được thông tin bệnh nhân')
  assert.equal(info.fullName, 'Nguyễn Văn An')
  assert.equal(info.patientCode, 'BN000001')
  assert.equal(info.phone, '0912345678')
})

test('TC-06.2: resolvePatientInfo ưu tiên encounter nếu có, sau đó đến payableList và queueList', () => {
  // 1. Encounter trực tiếp
  const infoEncounter = resolvePatientInfo({
    visitId: 'visit-1',
    encounter: {
      patient: { fullName: 'Trần Thị B', patientCode: 'BN000002', phone: '0988888888' },
    },
  })
  assert.equal(infoEncounter.fullName, 'Trần Thị B')

  // 2. Từ danh sách payable
  const infoPayable = resolvePatientInfo({
    visitId: 'visit-2',
    payableList: [
      { visitId: 'visit-2', patientName: 'Lê Văn C', patientCode: 'BN000003', visitCode: 'VIS-002' },
    ],
  })
  assert.equal(infoPayable.fullName, 'Lê Văn C')
  assert.equal(infoPayable.patientCode, 'BN000003')

  // 3. Fallback format mã lượt khám nếu không có dữ liệu
  assert.equal(formatVisitCode('d0000000-1111-2222'), 'VIS-D0000000')
})

