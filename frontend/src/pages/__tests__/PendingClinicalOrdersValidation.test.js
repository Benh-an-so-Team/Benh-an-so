import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PRESET_CANCEL_REASONS,
  validateCancelReason,
  getWaitingDurationMeta,
  SERVICE_TYPE_META,
  cleanClinicalOrderErrorMessage,
} from '../../utils/clinicalOrderHelpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '../../..')

// ============================================================================
// TC-01: THEO DÕI CHỈ ĐỊNH CẬN LÂM SÀNG CHỜ KẾT QUẢ & PHÂN LOẠI THỜI GIAN CHỜ
// ============================================================================
test('TC-01.1: getWaitingDurationMeta phân loại thời gian chờ theo ngưỡng màu sắc trực quan', () => {
  // Dưới 30 phút: Bình thường (xanh lá / blue)
  const meta10m = getWaitingDurationMeta(10)
  assert.equal(meta10m.level, 'normal')
  assert.equal(meta10m.color, 'success')
  assert.ok(meta10m.text.includes('10 phút'))

  const meta29m = getWaitingDurationMeta(29)
  assert.equal(meta29m.level, 'normal')

  // Từ 30 đến 60 phút: Cảnh báo thời gian chờ tăng (vàng cam)
  const meta30m = getWaitingDurationMeta(30)
  assert.equal(meta30m.level, 'warning')
  assert.equal(meta30m.color, 'warning')
  assert.ok(meta30m.text.includes('30 phút'))

  const meta59m = getWaitingDurationMeta(59)
  assert.equal(meta59m.level, 'warning')

  // Trên 60 phút: Chờ lâu bất thường cần can thiệp (đỏ)
  const meta60m = getWaitingDurationMeta(60)
  assert.equal(meta60m.level, 'danger')
  assert.equal(meta60m.color, 'error')
  assert.ok(meta60m.tagText.includes('60 phút'))
  assert.ok(meta60m.text.includes('1 giờ'))

  const meta120m = getWaitingDurationMeta(120)
  assert.equal(meta120m.level, 'danger')
  assert.ok(meta120m.text.includes('2 giờ'))
})

test('TC-01.2: getWaitingDurationMeta tính toán chính xác từ thời điểm tạo (createdAt ISO string)', () => {
  const now = Date.now()
  const twentyMinsAgo = new Date(now - 20 * 60 * 1000).toISOString()
  const fortyMinsAgo = new Date(now - 45 * 60 * 1000).toISOString()
  const ninetyMinsAgo = new Date(now - 90 * 60 * 1000).toISOString()

  const meta20 = getWaitingDurationMeta(null, twentyMinsAgo)
  assert.equal(meta20.level, 'normal')
  assert.ok(meta20.minutes >= 19 && meta20.minutes <= 21)

  const meta45 = getWaitingDurationMeta(null, fortyMinsAgo)
  assert.equal(meta45.level, 'warning')
  assert.ok(meta45.minutes >= 44 && meta45.minutes <= 46)

  const meta90 = getWaitingDurationMeta(null, ninetyMinsAgo)
  assert.equal(meta90.level, 'danger')
  assert.ok(meta90.minutes >= 89 && meta90.minutes <= 91)
})

test('TC-01.3: SERVICE_TYPE_META cung cấp đầy đủ thông tin nhãn hiển thị và màu sắc cho các nhóm CLS', () => {
  assert.ok(SERVICE_TYPE_META.XRAY, 'Phải có metadata cho X-quang')
  assert.equal(SERVICE_TYPE_META.XRAY.label, 'X-Quang')

  assert.ok(SERVICE_TYPE_META.CT, 'Phải có metadata cho CT-Scanner')
  assert.equal(SERVICE_TYPE_META.CT.label, 'Chụp CT')

  assert.ok(SERVICE_TYPE_META.ULTRASOUND, 'Phải có metadata cho Siêu âm')
  assert.equal(SERVICE_TYPE_META.ULTRASOUND.label, 'Siêu âm')

  assert.ok(SERVICE_TYPE_META.BLOOD, 'Phải có metadata cho Xét nghiệm Máu')
  assert.equal(SERVICE_TYPE_META.BLOOD.label, 'Xét nghiệm Máu')

  assert.ok(SERVICE_TYPE_META.ECG, 'Phải có metadata cho Điện tâm đồ')
  assert.equal(SERVICE_TYPE_META.ECG.label, 'Điện tim')
})

// ============================================================================
// TC-02: HỦY CHỈ ĐỊNH CẬN LÂM SÀNG VÀ XÁC THỰC LÝ DO HỦY (TỐI ĐA 500 KÝ TỰ)
// ============================================================================
test('TC-02.1: validateCancelReason từ chối chuỗi rỗng hoặc chỉ có khoảng trắng', () => {
  assert.equal(validateCancelReason('').valid, false)
  assert.equal(validateCancelReason('   ').valid, false)
  assert.equal(validateCancelReason(null).valid, false)
  assert.equal(validateCancelReason(undefined).valid, false)
  assert.ok(validateCancelReason('').error.includes('Vui lòng nhập lý do hủy'))
})

test('TC-02.2: validateCancelReason từ chối lý do vượt quá 500 ký tự', () => {
  const longReason = 'a'.repeat(501)
  const result = validateCancelReason(longReason)
  assert.equal(result.valid, false)
  assert.ok(result.error.includes('không được vượt quá 500 ký tự'))

  const maxValidReason = 'b'.repeat(500)
  const validResult = validateCancelReason(maxValidReason)
  assert.equal(validResult.valid, true)
  assert.equal(validResult.trimmedReason.length, 500)
})

test('TC-02.3: validateCancelReason chấp nhận lý do hợp lệ và cắt tỉa khoảng trắng đầu cuối', () => {
  const result = validateCancelReason('  Bệnh nhân xin dời lịch do có việc gấp  ')
  assert.equal(result.valid, true)
  assert.equal(result.trimmedReason, 'Bệnh nhân xin dời lịch do có việc gấp')
  assert.equal(result.error, null)
})

test('TC-02.4: PRESET_CANCEL_REASONS chứa danh sách lý do hủy mẫu nghiệp vụ y tế', () => {
  assert.ok(Array.isArray(PRESET_CANCEL_REASONS))
  assert.ok(PRESET_CANCEL_REASONS.length >= 4)
  assert.ok(PRESET_CANCEL_REASONS.includes('Bệnh nhân từ chối thực hiện dịch vụ'))
  assert.ok(PRESET_CANCEL_REASONS.includes('Bác sĩ chỉ định nhầm / trùng lặp'))
  assert.ok(PRESET_CANCEL_REASONS.includes('Bệnh nhân không đủ điều kiện sức khỏe để thực hiện'))
})

// ============================================================================
// TC-03: QUY TẮC QTN-17 - CẢNH BÁO KHI KÝ BỆNH ÁN CÒN CHỈ ĐỊNH CHỜ KẾT QUẢ
// ============================================================================
test('TC-03.1: SignMedicalRecordModal.jsx đã tích hợp kiểm tra QTN-17 và trường acknowledgePendingOrders', () => {
  const signModalFile = path.join(frontendDir, 'src/components/clinical/SignMedicalRecordModal.jsx')
  const content = fs.readFileSync(signModalFile, 'utf-8')

  assert.ok(
    content.includes('clinicalOrderApi'),
    'SignMedicalRecordModal phải import clinicalOrderApi'
  )
  assert.ok(
    content.includes('pendingOrdersList'),
    'SignMedicalRecordModal phải duy trì state pendingOrdersList'
  )
  assert.ok(
    content.includes('QTN-17'),
    'SignMedicalRecordModal phải có mã nguồn xử lý quy tắc nghiệp vụ QTN-17'
  )
  assert.ok(
    content.includes('acknowledgePendingOrders'),
    'SignMedicalRecordModal phải truyền tham số acknowledgePendingOrders khi ký'
  )
  assert.ok(
    content.includes('PENDING_CLINICAL_ORDERS_WARNING'),
    'SignMedicalRecordModal phải bắt mã lỗi PENDING_CLINICAL_ORDERS_WARNING từ backend'
  )
})

test('TC-03.2: cleanClinicalOrderErrorMessage chuyển đổi mã lỗi QTN-17 sang thông điệp tiếng Việt dễ hiểu', () => {
  const errorObj = {
    response: {
      data: {
        code: 'PENDING_CLINICAL_ORDERS_WARNING',
        message: 'Còn chỉ định cận lâm sàng chưa có kết quả (X-Quang ngực).',
      },
    },
  }
  const msg = cleanClinicalOrderErrorMessage(errorObj)
  assert.ok(msg.includes('chưa có kết quả') || msg.includes('đang chờ kết quả'))
  assert.ok(msg.includes('QTN-17'))
})

// ============================================================================
// TC-04: QUY TẮC QTN-13 - KHÔNG CHO PHÉP HỦY CHỈ ĐỊNH KHI ĐÃ CÓ KẾT QUẢ
// ============================================================================
test('TC-04.1: cleanClinicalOrderErrorMessage chặn và hiển thị rõ ràng lỗi QTN-13 khi đã có kết quả', () => {
  const errorObj = {
    response: {
      status: 409,
      data: {
        code: 'CLINICAL_ORDER_HAS_RESULT',
        message: 'Cannot cancel order item because result already exists.',
      },
    },
  }
  const msg = cleanClinicalOrderErrorMessage(errorObj)
  assert.ok(msg.includes('đã có kết quả thực hiện'))
  assert.ok(msg.includes('QTN-13') || msg.includes('Không thể hủy'))
})

test('TC-04.2: cleanClinicalOrderErrorMessage xử lý lỗi tiếng Anh mặc định thành thông điệp tiếng Việt', () => {
  const errorObj = {
    response: {
      data: {
        message: 'Order status COMPLETED does not permit cancellation',
      },
    },
  }
  const msg = cleanClinicalOrderErrorMessage(errorObj)
  assert.ok(!msg.includes('does not permit cancellation'))
  assert.ok(msg.includes('Không thể hủy') || msg.includes('trạng thái hiện tại'))
})

// ============================================================================
// ROUTING & GIAO DIỆN MÀN HÌNH THEO DÕI CHỈ ĐỊNH CĐLS
// ============================================================================
test('TC-05.1: AppRoutes.jsx đăng ký định tuyến màn hình /clinical-orders', () => {
  const routesFile = path.join(frontendDir, 'src/routes/AppRoutes.jsx')
  const content = fs.readFileSync(routesFile, 'utf-8')

  assert.ok(
    content.includes('PendingClinicalOrdersPage'),
    'AppRoutes phải import PendingClinicalOrdersPage'
  )
  assert.ok(
    content.includes('clinical-orders'),
    'AppRoutes phải cấu hình route clinical-orders'
  )
})

test('TC-05.2: navigationConfig.js tích hợp menu theo dõi chỉ định CĐLS cho Bác sĩ & Quản trị viên', () => {
  const navFile = path.join(frontendDir, 'src/components/layout/navigationConfig.js')
  const content = fs.readFileSync(navFile, 'utf-8')

  assert.ok(
    content.includes('/clinical-orders'),
    'navigationConfig phải có path /clinical-orders'
  )
  assert.ok(
    content.includes('chỉ định CĐLS') || content.includes('Chỉ định cận lâm sàng'),
    'navigationConfig phải có nhãn cho menu chỉ định CLS'
  )
})

test('TC-05.3: PendingClinicalOrdersPage.jsx tích hợp đầy đủ 4 thẻ KPI, bảng dữ liệu, và modal hủy chỉ định', () => {
  const pageFile = path.join(frontendDir, 'src/pages/PendingClinicalOrdersPage.jsx')
  const content = fs.readFileSync(pageFile, 'utf-8')

  // Kiểm tra 4 thẻ KPI
  assert.ok(content.includes('Tổng chỉ định chờ'), 'Trang phải có thẻ KPI Tổng chỉ định chờ')
  assert.ok(content.includes('Chờ 30 - 60 phút'), 'Trang phải có thẻ KPI Chờ 30 - 60 phút')
  assert.ok(content.includes('Chờ quá 60 phút'), 'Trang phải có thẻ KPI Chờ quá 60 phút')
  assert.ok(content.includes('Chỉ định trong ngày'), 'Trang phải có thẻ KPI Chỉ định trong ngày')

  // Kiểm tra Modal hủy
  assert.ok(content.toLowerCase().includes('hủy chỉ định cận lâm sàng'), 'Trang phải có Modal hủy chỉ định')
  assert.ok(content.includes('PRESET_CANCEL_REASONS'), 'Trang phải dùng danh sách lý do mẫu')
  assert.ok(content.includes('validateCancelReason'), 'Trang phải gọi hàm kiểm tra lý do hủy')

  // Kiểm tra bảng và phân trang
  assert.ok(content.includes('Table'), 'Trang phải hiển thị bảng dữ liệu Ant Design')
  assert.ok(content.includes('getWaitingDurationMeta'), 'Bảng phải hiển thị nhãn thời gian chờ')
})
