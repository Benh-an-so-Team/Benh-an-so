import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateServiceCode,
  validateServiceName,
  validateServicePrice,
  validateEffectiveDate,
  formatServiceCurrency,
  formatDateDisplay,
  formatDateTimeDisplay,
  categorizePriceHistory,
  fixMojibake,
  prepareCreateServicePayload,
  prepareUpdateServicePayload,
  translateServiceErrorMessage,
  extractServiceFormErrors,
  suggestNextEffectiveDate,
  isEffectiveDateConflicted,
  SERVICE_ERROR_TRANSLATIONS,
} from '../../utils/serviceCatalogValidation.js'

test('TC01: Phân quyền Quản trị viên & Quản lý truy cập Danh mục Dịch vụ', () => {
  const adminUser = { roles: ['ROLE_ADMIN'] }
  const managerUser = { roles: ['ROLE_CLINIC_MANAGER', 'manager'] }
  const doctorUser = { roles: ['ROLE_DOCTOR'] }

  const checkRole = (user) => {
    const roles = (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
    return roles.includes('admin') || roles.includes('manager') || roles.includes('clinic_manager')
  }

  assert.equal(checkRole(adminUser), true, 'Admin phải có quyền truy cập')
  assert.equal(checkRole(managerUser), true, 'Manager phải có quyền truy cập')
  assert.equal(checkRole(doctorUser), false, 'Doctor không có quyền quản lý danh mục dịch vụ')
})

test('TC02: Validate Mã dịch vụ (serviceCode)', () => {
  // Rỗng hoặc chỉ khoảng trắng
  const resEmpty = validateServiceCode('')
  assert.equal(resEmpty.valid, false)
  assert.equal(resEmpty.error, 'Mã dịch vụ là bắt buộc.')

  const resWhitespace = validateServiceCode('   ')
  assert.equal(resWhitespace.valid, false)

  // Quá 50 ký tự
  const resTooLong = validateServiceCode('A'.repeat(51))
  assert.equal(resTooLong.valid, false)
  assert.equal(resTooLong.error, 'Mã dịch vụ không được vượt quá 50 ký tự.')

  // Ký tự không hợp lệ (dấu cách, ký tự đặc biệt lạ)
  const resInvalidChar = validateServiceCode('DV KHAM 01')
  assert.equal(resInvalidChar.valid, false)

  // Hợp lệ: tự động viết hoa và loại bỏ khoảng trắng hai đầu
  const resValid = validateServiceCode('  dv_kham_noi-01  ')
  assert.equal(resValid.valid, true)
  assert.equal(resValid.value, 'DV_KHAM_NOI-01')
})

test('TC03: Validate Tên dịch vụ (name)', () => {
  // Rỗng
  const resEmpty = validateServiceName('')
  assert.equal(resEmpty.valid, false)
  assert.equal(resEmpty.error, 'Tên dịch vụ là bắt buộc.')

  // Quá 255 ký tự
  const resTooLong = validateServiceName('T'.repeat(256))
  assert.equal(resTooLong.valid, false)
  assert.equal(resTooLong.error, 'Tên dịch vụ không được vượt quá 255 ký tự.')

  // Hợp lệ & chuẩn hóa khoảng trắng thừa
  const resValid = validateServiceName('  Khám  nội    tổng quát  ')
  assert.equal(resValid.valid, true)
  assert.equal(resValid.value, 'Khám nội tổng quát')
})

test('TC04: Validate Đơn giá dịch vụ (price)', () => {
  // Thiếu đơn giá
  assert.equal(validateServicePrice(null).valid, false)
  assert.equal(validateServicePrice(undefined).valid, false)
  assert.equal(validateServicePrice('').valid, false)

  // Đơn giá âm
  const resNegative = validateServicePrice(-1000)
  assert.equal(resNegative.valid, false)
  assert.equal(resNegative.error, 'Đơn giá dịch vụ phải là số lớn hơn hoặc bằng 0.')

  // Đơn giá bằng 0 (Miễn phí) -> Hợp lệ
  const resZero = validateServicePrice(0)
  assert.equal(resZero.valid, true)
  assert.equal(resZero.value, 0)

  // Đơn giá dương hợp lệ
  const resPositive = validateServicePrice('150000')
  assert.equal(resPositive.valid, true)
  assert.equal(resPositive.value, 150000)
})

test('TC05: Validate Ngày bắt đầu hiệu lực (effectiveFrom)', () => {
  // Thiếu ngày
  assert.equal(validateEffectiveDate(null).valid, false)
  assert.equal(validateEffectiveDate('').valid, false)

  // Ngày không hợp lệ
  assert.equal(validateEffectiveDate('invalid-date').valid, false)

  // Ngày hợp lệ (chuẩn hóa về YYYY-MM-DD)
  const resValid = validateEffectiveDate('2026-08-20')
  assert.equal(resValid.valid, true)
  assert.equal(resValid.value, '2026-08-20')
})

test('TC06: Định dạng tiền tệ VNĐ và ngày tháng', () => {
  assert.equal(formatServiceCurrency(150000), '150.000 ₫')
  assert.equal(formatServiceCurrency(0), '0 ₫')
  assert.equal(formatServiceCurrency(null), '0 ₫')

  assert.equal(formatDateDisplay('2026-08-20'), '20/08/2026')
  assert.equal(formatDateDisplay(null), '—')

  assert.equal(formatDateTimeDisplay('2026-08-20T08:30:00Z'), '20/08/2026 15:30')
  assert.equal(formatDateTimeDisplay(null), '—')
})

test('TC07: Phân loại mốc giá trong lịch sử giá (CURRENT, UPCOMING, EXPIRED)', () => {
  const refDate = '2026-08-20'
  const mockPrices = [
    { id: '1', price: 100000, effectiveFrom: '2025-01-01', createdAt: '2025-01-01T00:00:00Z' },
    { id: '2', price: 150000, effectiveFrom: '2026-06-01', createdAt: '2026-05-20T00:00:00Z' },
    { id: '3', price: 200000, effectiveFrom: '2026-09-01', createdAt: '2026-08-15T00:00:00Z' },
  ]

  const categorized = categorizePriceHistory(mockPrices, refDate)

  // Sắp xếp giảm dần theo ngày hiệu lực: 2026-09-01, 2026-06-01, 2025-01-01
  assert.equal(categorized.length, 3)

  // Bản giá 2026-09-01 (tương lai > refDate) -> UPCOMING
  assert.equal(categorized[0].effectiveFrom, '2026-09-01')
  assert.equal(categorized[0].priceStatus, 'UPCOMING')
  assert.equal(categorized[0].statusLabel, 'Sắp áp dụng')

  // Bản giá 2026-06-01 (mới nhất <= refDate) -> CURRENT
  assert.equal(categorized[1].effectiveFrom, '2026-06-01')
  assert.equal(categorized[1].priceStatus, 'CURRENT')
  assert.equal(categorized[1].statusLabel, 'Đang áp dụng')

  // Bản giá 2025-01-01 (cũ hơn bản giá hiện hành) -> EXPIRED
  assert.equal(categorized[2].effectiveFrom, '2025-01-01')
  assert.equal(categorized[2].priceStatus, 'EXPIRED')
  assert.equal(categorized[2].statusLabel, 'Hết hiệu lực')
})

test('TC08: Đóng gói Payload CreateService đúng chuẩn Backend POST /system/services', () => {
  const input = {
    serviceCode: '  dv_sieu_am  ',
    name: '  Siêu âm ổ bụng tổng quát  ',
    price: '250000',
    effectiveFrom: '2026-08-20',
  }

  const payload = prepareCreateServicePayload(input)
  assert.deepEqual(payload, {
    serviceCode: 'DV_SIEU_AM',
    name: 'Siêu âm ổ bụng tổng quát',
    price: 250000,
    effectiveFrom: '2026-08-20',
  })
})

test('TC09: Đóng gói Payload UpdateService đúng chuẩn Backend PUT /system/services/{id}', () => {
  const input = {
    name: '  Siêu âm tim 4D màu  ',
    active: true,
    price: '450000',
    effectiveFrom: '2026-09-01',
  }

  const payload = prepareUpdateServicePayload(input)
  assert.deepEqual(payload, {
    name: 'Siêu âm tim 4D màu',
    active: true,
    price: 450000,
    effectiveFrom: '2026-09-01',
  })
})

test('TC10: Xử lý lỗi Backend theo code ổn định và dịch sang Tiếng Việt thân thiện', () => {
  const validationError = {
    response: { status: 400, data: { code: 'VALIDATION_FAILED', message: 'Service code already exists.' } },
  }
  assert.equal(translateServiceErrorMessage(validationError), 'Mã dịch vụ đã tồn tại trong hệ thống.')

  const forbiddenError = {
    response: { status: 403, data: { code: 'ACCESS_DENIED', message: 'Access Denied' } },
  }
  assert.equal(
    translateServiceErrorMessage(forbiddenError),
    'Bạn không có quyền thực hiện thao tác này.'
  )

  const notFoundError = {
    response: { status: 404, data: { code: 'RESOURCE_NOT_FOUND', message: 'Service catalog not found: 123' } },
  }
  assert.equal(
    translateServiceErrorMessage(notFoundError),
    'Không tìm thấy thông tin dịch vụ trong hệ thống.'
  )
})

test('TC11: Khôi phục và chuẩn hóa chuỗi tiếng Việt bị lỗi font / mojibake', () => {
  assert.equal(fixMojibake('Ä\u0090á»‹nh lÆ°á»£ng Hemoglobin'), 'Định lượng Hemoglobin')
  assert.equal(fixMojibake('CÃ´ng thá»©c mÃ¡u toÃ\u00A0n bá»™'), 'Công thức máu toàn bộ')
  assert.equal(fixMojibake('Ä\u0090iá»‡n tÃ¢m Ä‘á»“'), 'Điện tâm đồ')
  assert.equal(fixMojibake('Ä\u0090o chá»©c nÄƒng hÃ´ háº¥p'), 'Đo chức năng hô hấp')
  assert.equal(fixMojibake('Ä\u0090o máº­t Ä‘á»™ xÆ°Æ¡ng DEXA'), 'Đo mật độ xương DEXA')
  // Chuỗi tiếng Việt bình thường không bị thay đổi
  assert.equal(fixMojibake('Khám nội tổng quát'), 'Khám nội tổng quát')
})

test('TC12: Trích xuất lỗi Form khi trùng mã dịch vụ (Conflict Code)', () => {
  const duplicateCodeError = {
    response: {
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        message: 'Service code already exists.',
      },
    },
  }

  const result = extractServiceFormErrors(duplicateCodeError)
  assert.equal(result.errorMessage, 'Mã dịch vụ đã tồn tại trong hệ thống.')
  assert.deepEqual(result.fieldErrors, [
    { name: 'serviceCode', errors: ['Mã dịch vụ đã tồn tại trong hệ thống.'] },
  ])
})

test('TC13: Trích xuất lỗi Form khi trùng tên dịch vụ (Conflict Name)', () => {
  const duplicateNameError = {
    response: {
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        message: 'Service name already exists.',
      },
    },
  }

  const result = extractServiceFormErrors(duplicateNameError)
  assert.equal(result.errorMessage, 'Tên dịch vụ đã tồn tại trong hệ thống.')
  assert.deepEqual(result.fieldErrors, [
    { name: 'name', errors: ['Tên dịch vụ đã tồn tại trong hệ thống.'] },
  ])
})

test('TC14: Trích xuất lỗi Form khi xung đột ngày hiệu lực giá (Price Effective Date Conflict)', () => {
  const priceConflictError = {
    response: {
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        message: 'A different service price already exists for this effective date.',
      },
    },
  }

  const result = extractServiceFormErrors(priceConflictError)
  assert.equal(result.errorMessage, 'Đã tồn tại mức giá khác cho ngày hiệu lực này.')
  assert.deepEqual(result.fieldErrors, [
    { name: 'effectiveFrom', errors: ['Đã tồn tại mức giá khác cho ngày hiệu lực này.'] },
  ])
})

test('TC15: Trích xuất lỗi chi tiết từng trường từ Backend fields map', () => {
  const fieldValidationErrors = {
    response: {
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed.',
        details: {
          fields: {
            serviceCode: 'Service code is required.',
            price: 'Service price must be greater than or equal to 0.',
          },
        },
      },
    },
  }

  const result = extractServiceFormErrors(fieldValidationErrors)
  assert.equal(result.errorMessage, 'Vui lòng nhập mã dịch vụ.')
  assert.deepEqual(result.fieldErrors, [
    { name: 'serviceCode', errors: ['Vui lòng nhập mã dịch vụ.'] },
    { name: 'price', errors: ['Đơn giá phải lớn hơn hoặc bằng 0.'] },
  ])
})

test('TC16: Trích xuất lỗi từ Client-side Validation Error', () => {
  const clientError = new Error('Mã dịch vụ không được vượt quá 50 ký tự.')
  const result = extractServiceFormErrors(clientError)
  assert.equal(result.errorMessage, 'Mã dịch vụ không được vượt quá 50 ký tự.')
  assert.deepEqual(result.fieldErrors, [
    { name: 'serviceCode', errors: ['Mã dịch vụ không được vượt quá 50 ký tự.'] },
  ])
})

test('TC17: Gợi ý ngày hiệu lực mới không trùng với các mốc giá cũ (suggestNextEffectiveDate)', () => {
  const history = [
    { effectiveFrom: '2026-09-01', price: 100000 },
    { effectiveFrom: '2026-09-02', price: 120000 },
  ]

  const nextDate = suggestNextEffectiveDate(history, '2026-09-01')
  assert.equal(nextDate, '2026-09-03')

  const freeDate = suggestNextEffectiveDate(history, '2026-09-05')
  assert.equal(freeDate, '2026-09-05')
})

test('TC18: Phát hiện xung đột ngày hiệu lực khi đổi đơn giá (isEffectiveDateConflicted)', () => {
  const history = [
    { effectiveFrom: '2026-08-20', price: 150000 },
  ]

  const conflict = isEffectiveDateConflicted('2026-08-20', history, 200000, 150000)
  assert.equal(conflict.conflicted, true)
  assert.ok(conflict.message.includes('Đã tồn tại mức giá'))

  const noConflictSamePrice = isEffectiveDateConflicted('2026-08-20', history, 150000, 150000)
  assert.equal(noConflictSamePrice.conflicted, false)

  const noConflictNewDate = isEffectiveDateConflicted('2026-08-21', history, 200000, 150000)
  assert.equal(noConflictNewDate.conflicted, false)
})

test('TC19: Trích xuất lỗi 403 ACCESS_DENIED kèm mô tả hướng dẫn quyền hạn', () => {
  const forbiddenError = {
    response: {
      status: 403,
      data: {
        code: 'ACCESS_DENIED',
        message: 'Access Denied',
      },
    },
  }

  const result = extractServiceFormErrors(forbiddenError)
  assert.equal(result.errorMessage, 'Bạn không có quyền thực hiện thao tác này.')
  assert.ok(result.description.includes('Quản trị viên') || result.description.includes('Quản lý'))
  assert.deepEqual(result.fieldErrors, [])
})

test('TC20: Trích xuất lỗi 404 RESOURCE_NOT_FOUND khi dịch vụ không tồn tại', () => {
  const notFoundError = {
    response: {
      status: 404,
      data: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Service catalog not found: 123',
      },
    },
  }

  const result = extractServiceFormErrors(notFoundError)
  assert.equal(result.errorMessage, 'Không tìm thấy thông tin dịch vụ trong hệ thống.')
  assert.ok(result.description.includes('404') || result.description.includes('tải lại'))
  assert.deepEqual(result.fieldErrors, [])
})

test('TC21: Nhận diện vai trò clinic_manager cho quyền truy cập và quản lý dịch vụ', () => {
  const clinicManagerUser = { roles: ['ROLE_CLINIC_MANAGER'] }
  const checkRole = (user) => {
    const roles = (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
    return roles.includes('admin') || roles.includes('manager') || roles.includes('clinic_manager')
  }

  assert.equal(checkRole(clinicManagerUser), true, 'ROLE_CLINIC_MANAGER phải được nhận diện hợp lệ')
})




