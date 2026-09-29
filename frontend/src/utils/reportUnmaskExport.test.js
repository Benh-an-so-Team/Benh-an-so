import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REPORTS_WITH_IDENTIFYING_DATA,
  isIdentifyingReportType,
  canUserExportUnmasked,
  validateUnmaskReason,
  buildExportQueryParams,
  getExportErrorMessage,
} from './reportExportHelpers.js'

test('1. Switch visibility by permission - canUserExportUnmasked', () => {
  // User with REPORT_UNMASKED_EXPORT permission can see the switch
  assert.equal(canUserExportUnmasked(['REPORT_UNMASKED_EXPORT']), true)
  assert.equal(canUserExportUnmasked(['PERMISSION_REPORT_UNMASKED_EXPORT']), true)
  assert.equal(canUserExportUnmasked(['report_unmasked_export']), true)
  assert.equal(canUserExportUnmasked(['REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_UNMASKED_EXPORT']), true)

  // User without permission cannot see the switch (receptionist, doctor, manager without permission)
  assert.equal(canUserExportUnmasked(['REPORT_VIEW', 'REPORT_EXPORT']), false)
  assert.equal(canUserExportUnmasked(['ACCESS_LOG_REPORT_EXPORT']), false)
  assert.equal(canUserExportUnmasked([]), false)
  assert.equal(canUserExportUnmasked(null), false)
  assert.equal(canUserExportUnmasked(undefined), false)
})

test('2. Validate reason constraints - reject empty, < 5 chars, > 500 chars; allow valid', () => {
  // Reject null/empty/whitespace
  assert.equal(validateUnmaskReason(null).isValid, false)
  assert.equal(validateUnmaskReason('').isValid, false)
  assert.equal(validateUnmaskReason('   ').isValid, false)
  assert.equal(validateUnmaskReason('   ').error, 'Vui lòng nhập lý do xuất bản dữ liệu đầy đủ.')

  // Reject < 5 characters
  assert.equal(validateUnmaskReason('abc').isValid, false)
  assert.equal(validateUnmaskReason('1234').isValid, false)
  assert.equal(validateUnmaskReason('1234').error, 'Lý do xuất bản dữ liệu đầy đủ phải có ít nhất 5 ký tự.')

  // Reject > 500 characters
  const tooLong = 'A'.repeat(501)
  assert.equal(validateUnmaskReason(tooLong).isValid, false)
  assert.equal(validateUnmaskReason(tooLong).error, 'Lý do xuất không được vượt quá 500 ký tự.')

  // Allow exactly 5 characters
  const exact5 = validateUnmaskReason('12345')
  assert.equal(exact5.isValid, true)
  assert.equal(exact5.reason, '12345')
  assert.equal(exact5.error, null)

  // Allow exactly 500 characters
  const exact500 = 'B'.repeat(500)
  assert.equal(validateUnmaskReason(exact500).isValid, true)
  assert.equal(validateUnmaskReason(exact500).reason, exact500)

  // Allow valid Vietnamese reason with trimming
  const validReason = '  Kiểm toán dữ liệu bảo hiểm y tế quý 3/2026  '
  const result = validateUnmaskReason(validReason)
  assert.equal(result.isValid, true)
  assert.equal(result.reason, 'Kiểm toán dữ liệu bảo hiểm y tế quý 3/2026')
})

test('3. Build query params properly for unmask=true/false and doctorId', () => {
  // Case A: unmask = false (Default masked export)
  const paramsMasked = buildExportQueryParams({
    reportType: 'VISIT_REPORT',
    from: '2026-08-01',
    to: '2026-08-30',
    unmask: false,
    reason: '',
  })
  assert.deepEqual(paramsMasked, {
    reportType: 'VISIT_REPORT',
    from: '2026-08-01',
    to: '2026-08-30',
    unmask: false,
  })

  // Case B: unmask = true with valid reason and doctorId
  const paramsUnmasked = buildExportQueryParams({
    reportType: 'VISIT_REPORT',
    from: '2026-08-01',
    to: '2026-08-30',
    doctorId: '11111111-2222-3333-4444-555555555555',
    unmask: true,
    reason: 'Phục vụ thanh tra sở y tế',
  })
  assert.deepEqual(paramsUnmasked, {
    reportType: 'VISIT_REPORT',
    from: '2026-08-01',
    to: '2026-08-30',
    doctorId: '11111111-2222-3333-4444-555555555555',
    unmask: true,
    reason: 'Phục vụ thanh tra sở y tế',
  })

  // Case C: OPERATIONAL_REPORT with unmask = true
  const paramsOperational = buildExportQueryParams({
    reportType: 'OPERATIONAL_REPORT',
    from: '2026-09-01',
    to: '2026-09-15',
    unmask: true,
    reason: 'Báo cáo quản trị nội bộ',
  })
  assert.deepEqual(paramsOperational, {
    reportType: 'OPERATIONAL_REPORT',
    from: '2026-09-01',
    to: '2026-09-15',
    unmask: true,
    reason: 'Báo cáo quản trị nội bộ',
  })
})

test('4. Report types with vs without identifying data', () => {
  // Reports containing patient identifying information (Name, Phone, Address)
  assert.equal(isIdentifyingReportType('VISIT_REPORT'), true)
  assert.equal(isIdentifyingReportType('OPERATIONAL_REPORT'), true)
  assert.equal(isIdentifyingReportType('DOCTOR_VISITS_REPORT'), true)

  // Reports NOT containing patient identifying information (aggregated data only)
  assert.equal(isIdentifyingReportType('REVENUE_REPORT'), false)
  assert.equal(isIdentifyingReportType('DISEASE_PATTERN_REPORT'), false)
  assert.equal(isIdentifyingReportType('ACCESS_LOG_REPORT'), false)
  assert.equal(isIdentifyingReportType('TOP_MEDICINES_REPORT'), false)

  // When report type is not identifiable, unmask param is omitted/ignored
  const nonIdentifiableParams = buildExportQueryParams({
    reportType: 'REVENUE_REPORT',
    from: '2026-08-01',
    to: '2026-08-30',
    unmask: true,
    reason: 'Should be ignored',
  })
  assert.equal(nonIdentifiableParams.unmask, undefined)
  assert.equal(nonIdentifiableParams.reason, undefined)
})

test('5. Error handling for 403 (unmask permission denied) and 400 (reason invalid)', async () => {
  // 403 when user lacks REPORT_UNMASKED_EXPORT
  const err403Unmasked = {
    response: {
      status: 403,
      data: {
        message: 'User lacks high-privilege permission REPORT_UNMASKED_EXPORT to export unmasked patient data.',
      },
    },
  }
  const msg403 = await getExportErrorMessage(err403Unmasked)
  assert.equal(msg403, 'Bạn không có quyền xuất dữ liệu đầy đủ')

  // 400 when reason validation fails on server
  const err400Reason = {
    response: {
      status: 400,
      data: {
        message: 'Reason is required and must be at least 5 characters for unmasked export.',
      },
    },
  }
  const msg400 = await getExportErrorMessage(err400Reason)
  assert.equal(msg400, 'Reason is required and must be at least 5 characters for unmasked export.')
})
