import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validateServiceName,
  validateServicePrice,
  validateEffectiveDate,
  validateServiceCode,
  isDuplicateServiceName,
  extractServiceFormErrors,
  translateRawMessage,
  SERVICE_ERROR_TRANSLATIONS,
} from './serviceCatalogValidation.js'
import { showNotice, noticeManager } from '../components/common/notice/NoticeService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('1. Kiểm tra validateServiceName cho trường Tên dịch vụ', () => {
  // Trống hoặc chỉ chứa khoảng trắng
  const emptyRes1 = validateServiceName('')
  assert.equal(emptyRes1.valid, false)
  assert.equal(emptyRes1.error, 'Tên dịch vụ là bắt buộc.')

  const emptyRes2 = validateServiceName('    ')
  assert.equal(emptyRes2.valid, false)
  assert.equal(emptyRes2.error, 'Tên dịch vụ là bắt buộc.')

  // Vượt quá 255 ký tự
  const longName = 'A'.repeat(256)
  const longRes = validateServiceName(longName)
  assert.equal(longRes.valid, false)
  assert.ok(longRes.error.includes('không được vượt quá 255 ký tự'))

  // Hợp lệ
  const validRes = validateServiceName('  Khám nội tổng quát  ')
  assert.equal(validRes.valid, true)
  assert.equal(validRes.value, 'Khám nội tổng quát')
})

test('2. Kiểm tra validateServicePrice cho trường Giá dịch vụ (không được là số âm)', () => {
  // Thiếu đơn giá
  const emptyRes = validateServicePrice('')
  assert.equal(emptyRes.valid, false)
  assert.equal(emptyRes.error, 'Đơn giá dịch vụ là bắt buộc.')

  const nullRes = validateServicePrice(null)
  assert.equal(nullRes.valid, false)
  assert.equal(nullRes.error, 'Đơn giá dịch vụ là bắt buộc.')

  // Số âm
  const negRes1 = validateServicePrice(-50000)
  assert.equal(negRes1.valid, false)
  assert.equal(negRes1.error, 'Đơn giá dịch vụ phải là số lớn hơn hoặc bằng 0.')

  const negRes2 = validateServicePrice('-1000')
  assert.equal(negRes2.valid, false)
  assert.equal(negRes2.error, 'Đơn giá dịch vụ phải là số lớn hơn hoặc bằng 0.')

  // Hợp lệ (0đ hoặc lớn hơn)
  const zeroRes = validateServicePrice(0)
  assert.equal(zeroRes.valid, true)
  assert.equal(zeroRes.value, 0)

  const posRes = validateServicePrice('150000')
  assert.equal(posRes.valid, true)
  assert.equal(posRes.value, 150000)
})

test('3. Kiểm tra validateEffectiveDate cho trường Ngày hiệu lực', () => {
  // Trống
  const emptyRes = validateEffectiveDate('')
  assert.equal(emptyRes.valid, false)
  assert.equal(emptyRes.error, 'Ngày bắt đầu hiệu lực là bắt buộc.')

  // Sai định dạng
  const invalidRes = validateEffectiveDate('invalid-date')
  assert.equal(invalidRes.valid, false)
  assert.equal(invalidRes.error, 'Ngày hiệu lực không đúng định dạng.')

  // Hợp lệ
  const validRes = validateEffectiveDate('2026-10-01')
  assert.equal(validRes.valid, true)
  assert.equal(validRes.value, '2026-10-01')
})

test('4. Kiểm tra validateServiceCode cho trường Mã dịch vụ', () => {
  // Trống
  const emptyRes = validateServiceCode('')
  assert.equal(emptyRes.valid, false)
  assert.equal(emptyRes.error, 'Mã dịch vụ là bắt buộc.')

  // Chứa ký tự đặc biệt không cho phép
  const specialRes = validateServiceCode('DV@#$')
  assert.equal(specialRes.valid, false)
  assert.ok(specialRes.error.includes('Mã dịch vụ chỉ được chứa chữ cái'))

  // Hợp lệ (tự động uppercase)
  const validRes = validateServiceCode('dv-kham-01')
  assert.equal(validRes.valid, true)
  assert.equal(validRes.value, 'DV-KHAM-01')
})

test('5. Kiểm tra isDuplicateServiceName khi kiểm tra trùng tên', () => {
  const existingServices = [
    { id: 'uuid-1', name: 'Khám Nội Khoa' },
    { id: 'uuid-2', name: 'Chụp X-Quang Ngực Thẳng' },
    { id: 'uuid-3', name: 'Xét nghiệm máu tổng quát' },
  ]

  // Trùng tên hoàn toàn
  assert.equal(isDuplicateServiceName('Khám Nội Khoa', existingServices), true)

  // Trùng tên khác chữ hoa chữ thường và thừa dấu cách
  assert.equal(isDuplicateServiceName('   khám   nội   khoa   ', existingServices), true)
  assert.equal(isDuplicateServiceName('CHỤP X-QUANG NGỰC THẲNG', existingServices), true)

  // Tên mới chưa tồn tại
  assert.equal(isDuplicateServiceName('Siêu âm tim 4D', existingServices), false)

  // Khi cập nhật (excludeId trùng ID của dịch vụ đang sửa thì không tính là trùng với chính nó)
  assert.equal(isDuplicateServiceName('Khám Nội Khoa', existingServices, 'uuid-1'), false)
  // Nhưng nếu đổi thành tên của dịch vụ khác thì tính là trùng
  assert.equal(isDuplicateServiceName('Chụp X-Quang Ngực Thẳng', existingServices, 'uuid-1'), true)
})

test('6. Kiểm tra extractServiceFormErrors và dịch lỗi hệ thống', () => {
  // 1. Trùng tên dịch vụ từ Backend
  const duplicateErr = new Error('Service name already exists.')
  const dupResult = extractServiceFormErrors(duplicateErr)
  assert.ok(dupResult.fieldErrors.some((fe) => fe.name === 'name'))
  const nameError = dupResult.fieldErrors.find((fe) => fe.name === 'name')
  assert.equal(nameError.errors[0], 'Tên dịch vụ đã tồn tại trong hệ thống.')

  // 2. Giá âm từ Backend
  const negErr = new Error('Service price must be greater than or equal to 0.')
  const negResult = extractServiceFormErrors(negErr)
  assert.ok(negResult.fieldErrors.some((fe) => fe.name === 'price'))
  const priceError = negResult.fieldErrors.find((fe) => fe.name === 'price')
  assert.equal(priceError.errors[0], 'Đơn giá phải lớn hơn hoặc bằng 0.')

  // 3. Trùng mức giá theo ngày hiệu lực
  const dateErr = new Error('A different service price already exists for this effective date.')
  const dateResult = extractServiceFormErrors(dateErr)
  assert.ok(dateResult.fieldErrors.some((fe) => fe.name === 'effectiveFrom'))

  // 4. Lỗi từ chối quyền truy cập (Access Denied)
  const forbiddenErr = { response: { status: 403, data: { message: 'Access denied.' } } }
  const forbResult = extractServiceFormErrors(forbiddenErr)
  assert.equal(forbResult.errorMessage, 'Bạn không có quyền thực hiện thao tác này.')
})

test('7. Kiểm tra hệ thống thông báo tóm tắt góc dưới phải showNotice.validationSummary', () => {
  noticeManager.clearAll()

  const noticeId = showNotice.validationSummary({ errorCount: 2 })
  assert.ok(noticeId, 'Phải tạo thành công thông báo tóm tắt')

  const snapshot = noticeManager.getSnapshot()
  assert.equal(snapshot.allNotices.length, 1)
  const notice = snapshot.allNotices[0]
  assert.equal(notice.title, 'Thông tin chưa hợp lệ')
  assert.equal(notice.message, 'Có 2 trường thông tin cần chỉnh sửa. Vui lòng kiểm tra lại biểu mẫu.')

  noticeManager.clearAll()
})

test('8. Kiểm tra code JSX và CSS đảm bảo các yêu cầu đặc tả UI', () => {
  const createModalPath = path.resolve(__dirname, '../components/services/ServiceCreateModal.jsx')
  const editModalPath = path.resolve(__dirname, '../components/services/ServiceEditModal.jsx')
  const servicesPagePath = path.resolve(__dirname, '../pages/ServicesPage.jsx')
  const cssPath = path.resolve(__dirname, '../styles/services.css')

  const createContent = fs.readFileSync(createModalPath, 'utf8')
  const editContent = fs.readFileSync(editModalPath, 'utf8')
  const pageContent = fs.readFileSync(servicesPagePath, 'utf8')
  const cssContent = fs.readFileSync(cssPath, 'utf8')

  // 1. Kiểm tra validateTrigger onBlur được cấu hình trong Modal
  assert.ok(
    createContent.includes("validateTrigger={['onBlur', 'onChange']}"),
    'ServiceCreateModal phải có validateTrigger onBlur & onChange'
  )
  assert.ok(
    editContent.includes("validateTrigger={['onBlur', 'onChange']}"),
    'ServiceEditModal phải có validateTrigger onBlur & onChange'
  )

  // 2. Kiểm tra tự động focus & cuộn khi có lỗi
  assert.ok(
    createContent.includes('focusFirstErrorField') && createContent.includes('showNotice.validationSummary'),
    'ServiceCreateModal phải gọi focusFirstErrorField và showNotice.validationSummary khi onFinishFailed'
  )
  assert.ok(
    editContent.includes('focusFirstErrorField') && editContent.includes('showNotice.validationSummary'),
    'ServiceEditModal phải gọi focusFirstErrorField và showNotice.validationSummary khi onFinishFailed'
  )

  // 3. Kiểm tra kiểm tra trùng tên khi Lưu trong ServicesPage
  assert.ok(
    pageContent.includes('isDuplicateServiceName'),
    'ServicesPage phải kiểm tra trùng tên bằng isDuplicateServiceName khi Lưu'
  )
  assert.ok(
    pageContent.includes('showNotice.validationSummary'),
    'ServicesPage phải hiển thị thông báo tóm tắt góc phải khi bấm Lưu có lỗi'
  )
  assert.ok(
    pageContent.includes('showNotice.success'),
    'ServicesPage phải hiển thị showNotice.success khi Lưu thành công'
  )

  // 4. Kiểm tra CSS hiển thị lỗi: viền đỏ & icon cảnh báo nhỏ
  assert.ok(
    cssContent.includes('.service-form .ant-form-item-has-error .ant-input'),
    'services.css phải có CSS viền đỏ cho ô lỗi trong .service-form'
  )
  assert.ok(
    cssContent.includes('.service-form .ant-form-item-explain-error::before'),
    'services.css phải có pseudo-element icon cảnh báo cho explain error'
  )
})
