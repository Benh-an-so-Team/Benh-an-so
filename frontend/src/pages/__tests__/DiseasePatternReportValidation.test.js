import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateDateRange,
  formatPercentage,
  extractFilenameFromHeader,
  parseBlobError,
  getExportErrorMessage,
  downloadCsvBlob,
  MAX_REPORT_RANGE_DAYS,
} from '../../utils/diseasePatternReportHelpers.js'

test('TC01 - validateDateRange: Chặn khi thiếu ngày bắt đầu hoặc ngày kết thúc', () => {
  const res1 = validateDateRange(null, '2026-08-31')
  assert.equal(res1.valid, false)
  assert.equal(res1.error, 'Vui lòng chọn khoảng thời gian.')

  const res2 = validateDateRange('2026-08-01', undefined)
  assert.equal(res2.valid, false)
  assert.equal(res2.error, 'Vui lòng chọn khoảng thời gian.')

  const res3 = validateDateRange('', '')
  assert.equal(res3.valid, false)
  assert.equal(res3.error, 'Vui lòng chọn khoảng thời gian.')
})

test('TC02 - validateDateRange: Chặn khi ngày bắt đầu lớn hơn ngày kết thúc (from > to)', () => {
  const res = validateDateRange('2026-09-01', '2026-08-01')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Ngày bắt đầu không được lớn hơn ngày kết thúc.')
})

test('TC03 - validateDateRange: Chặn khi khoảng cách vượt quá 366 ngày', () => {
  // 367 ngày: từ 2025-01-01 đến 2026-01-02 là 367 ngày (năm 2025 có 365 ngày)
  const res = validateDateRange('2025-01-01', '2026-01-02')
  assert.equal(res.valid, false)
  assert.equal(res.error, 'Khoảng thời gian báo cáo không được vượt quá 366 ngày.')
})

test('TC04 - validateDateRange: Cho phép khoảng cách chính xác 366 ngày và hợp lệ', () => {
  // Đúng 366 ngày (năm nhuận hoặc 366 ngày tính cả 2 đầu)
  const res366 = validateDateRange('2025-01-01', '2026-01-01')
  assert.equal(res366.valid, true)
  assert.equal(res366.error, '')
  assert.equal(res366.from, '2025-01-01')
  assert.equal(res366.to, '2026-01-01')

  // Khoảng 30 ngày bình thường
  const res30 = validateDateRange('2026-08-01', '2026-08-31')
  assert.equal(res30.valid, true)
  assert.equal(res30.from, '2026-08-01')
  assert.equal(res30.to, '2026-08-31')
})

test('TC05 - formatPercentage: Định dạng số phần trăm chuẩn 2 chữ số thập phân', () => {
  assert.equal(formatPercentage(30), '30.00%')
  assert.equal(formatPercentage(12.5), '12.50%')
  assert.equal(formatPercentage(45.6789), '45.68%')
  assert.equal(formatPercentage(0), '0.00%')
  assert.equal(formatPercentage(null), '0.00%')
  assert.equal(formatPercentage(undefined), '0.00%')
  assert.equal(formatPercentage('invalid'), '0.00%')
})

test('TC06 - extractFilenameFromHeader: Trích xuất tên tệp từ Content-Disposition header', () => {
  const headerStandard = 'attachment; filename="disease-pattern-report-2026-08-01-to-2026-08-31.csv"'
  assert.equal(
    extractFilenameFromHeader(headerStandard),
    'disease-pattern-report-2026-08-01-to-2026-08-31.csv'
  )

  const headerUtf8 = "attachment; filename*=UTF-8''bao-cao-mo-hinh-benh-tat.csv"
  assert.equal(
    extractFilenameFromHeader(headerUtf8),
    'bao-cao-mo-hinh-benh-tat.csv'
  )

  const fallback = extractFilenameFromHeader(null, 'default-report.csv')
  assert.equal(fallback, 'default-report.csv')
})

test('TC07 - parseBlobError: Trích xuất JSON từ Blob khi request có responseType là blob', async () => {
  const mockErrorObj = {
    code: 'REPORT_DATA_EMPTY',
    message: 'No report data available for the selected period.',
  }
  const blob = new Blob([JSON.stringify(mockErrorObj)], { type: 'application/json' })
  const errorWithBlob = {
    response: {
      status: 422,
      data: blob,
    },
  }

  const parsed = await parseBlobError(errorWithBlob)
  assert.deepEqual(parsed, mockErrorObj)

  // Trường hợp error data là plain object
  const errorPlain = {
    response: {
      status: 400,
      data: mockErrorObj,
    },
  }
  const parsedPlain = await parseBlobError(errorPlain)
  assert.deepEqual(parsedPlain, mockErrorObj)
})

test('TC08 - getExportErrorMessage: Ánh xạ đúng lỗi rỗng dữ liệu khi export', async () => {
  // Lỗi 422 / 400 với REPORT_DATA_EMPTY
  const emptyError = {
    response: {
      status: 422,
      data: {
        code: 'REPORT_DATA_EMPTY',
        message: 'No report data available for the selected period.',
      },
    },
  }
  const msgEmpty = await getExportErrorMessage(emptyError)
  assert.equal(
    msgEmpty,
    'Không thể xuất tệp vì kỳ báo cáo này chưa có dữ liệu chẩn đoán nào.'
  )

  // Lỗi với OperationalReportDataEmptyException trong message
  const emptyErrorBlob = {
    response: {
      status: 400,
      data: new Blob(
        [
          JSON.stringify({
            code: 'BAD_REQUEST',
            message: 'OperationalReportDataEmptyException: No report data available',
          }),
        ],
        { type: 'application/json' }
      ),
    },
  }
  const msgEmptyBlob = await getExportErrorMessage(emptyErrorBlob)
  assert.equal(
    msgEmptyBlob,
    'Không thể xuất tệp vì kỳ báo cáo này chưa có dữ liệu chẩn đoán nào.'
  )
})

test('TC09 - getExportErrorMessage: Ánh xạ đúng lỗi 403 không đủ quyền và lỗi 400 date range', async () => {
  // Lỗi 403
  const forbiddenError = {
    response: {
      status: 403,
      data: { code: 'ACCESS_DENIED', message: 'Forbidden' },
    },
  }
  const msg403 = await getExportErrorMessage(forbiddenError)
  assert.equal(msg403, 'Bạn không có quyền xuất báo cáo này.')

  // Lỗi 400 DATE_RANGE_TOO_LONG
  const rangeError = {
    response: {
      status: 400,
      data: { code: 'DATE_RANGE_TOO_LONG', message: 'Range exceeds 366 days' },
    },
  }
  const msgRange = await getExportErrorMessage(rangeError)
  assert.equal(msgRange, 'Khoảng thời gian báo cáo không được vượt quá 366 ngày.')

  // Lỗi 400 thông thường
  const badRequest = {
    response: {
      status: 400,
      data: { code: 'BAD_REQUEST', message: 'Invalid params' },
    },
  }
  const msgBadRequest = await getExportErrorMessage(badRequest)
  assert.equal(msgBadRequest, 'Khoảng thời gian không hợp lệ. Vui lòng kiểm tra lại.')
})

test('TC10 - downloadCsvBlob: Kích hoạt download qua Blob và DOM API', () => {
  let createdUrl = null
  let revokedUrl = null
  let clicked = false
  let appended = false
  let removed = false

  // Mock window and document APIs
  globalThis.window = {
    URL: {
      createObjectURL: (blob) => {
        createdUrl = 'blob:mock-url'
        return createdUrl
      },
      revokeObjectURL: (url) => {
        revokedUrl = url
      },
    },
  }

  const mockLink = {
    href: '',
    setAttribute: (k, v) => {},
    click: () => {
      clicked = true
    },
    remove: () => {
      removed = true
    },
  }

  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'a') return mockLink
      return {}
    },
    body: {
      appendChild: (el) => {
        appended = true
      },
    },
  }

  downloadCsvBlob('col1,col2\nval1,val2', 'test.csv')

  assert.equal(createdUrl, 'blob:mock-url')
  assert.equal(revokedUrl, 'blob:mock-url')
  assert.equal(clicked, true)
  assert.equal(appended, true)
  assert.equal(removed, true)
})
