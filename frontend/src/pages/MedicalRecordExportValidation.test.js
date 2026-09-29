import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canExportRecord,
  getExportEligibilityReason,
  canUserExportMedicalRecords,
  mapExportErrorMessage,
  extractBlobErrorMessage,
  extractFilenameFromHeader,
  downloadBlobFile,
  MAX_EXPORT_BATCH_SIZE,
} from '../utils/medicalRecordExportHelpers.js'
import { exportBatch, exportSingle } from '../api/medicalRecordExportApi.js'

test('TC-EXPORT-01: canExportRecord kiểm tra chính xác trạng thái ký theo quy tắc QTN-41', () => {
  // Trạng thái hợp lệ (SIGNED, LOCKED, ARCHIVED)
  assert.equal(canExportRecord('SIGNED'), true, 'SIGNED phải được phép xuất')
  assert.equal(canExportRecord('LOCKED'), true, 'LOCKED phải được phép xuất')
  assert.equal(canExportRecord('ARCHIVED'), true, 'ARCHIVED phải được phép xuất')

  assert.equal(canExportRecord({ status: 'SIGNED' }), true)
  assert.equal(canExportRecord({ status: 'LOCKED' }), true)
  assert.equal(canExportRecord({ status: 'ARCHIVED' }), true)

  // Trạng thái chưa ký hoặc không hợp lệ (DRAFT, OPEN, NULL, v.v.)
  assert.equal(canExportRecord('DRAFT'), false, 'DRAFT không được phép xuất')
  assert.equal(canExportRecord('OPEN'), false, 'OPEN không được phép xuất')
  assert.equal(canExportRecord('IN_PROGRESS'), false)
  assert.equal(canExportRecord('CANCELLED'), false)
  assert.equal(canExportRecord(null), false)
  assert.equal(canExportRecord(undefined), false)
  assert.equal(canExportRecord({ status: 'DRAFT' }), false)
  assert.equal(canExportRecord({ status: 'OPEN' }), false)

  // Lý do từ chối
  assert.equal(getExportEligibilityReason('SIGNED'), '')
  assert.equal(getExportEligibilityReason('DRAFT'), 'Chỉ xuất được hồ sơ đã ký')
  assert.equal(getExportEligibilityReason(null), 'Chỉ xuất được hồ sơ đã ký')
})

test('TC-EXPORT-02: canUserExportMedicalRecords kiểm tra đúng quyền truy cập theo vai trò', () => {
  // Admin được phép
  assert.equal(canUserExportMedicalRecords(['ROLE_ADMIN'], []), true)
  assert.equal(canUserExportMedicalRecords(['admin'], []), true)

  // Manager và Clinic Manager được phép
  assert.equal(canUserExportMedicalRecords(['ROLE_MANAGER'], []), true)
  assert.equal(canUserExportMedicalRecords(['manager'], []), true)
  assert.equal(canUserExportMedicalRecords(['clinic_manager'], []), true)

  // Người dùng bất kỳ có quyền MEDICAL_RECORD_EXPORT
  assert.equal(canUserExportMedicalRecords([], ['MEDICAL_RECORD_EXPORT']), true)
  assert.equal(canUserExportMedicalRecords([], ['PERMISSION_MEDICAL_RECORD_EXPORT']), true)

  // Bác sĩ KHÔNG có quyền xuất nếu chưa được gán role admin/manager hoặc permission
  assert.equal(canUserExportMedicalRecords(['ROLE_DOCTOR'], ['MEDICAL_RECORD_READ', 'MEDICAL_RECORD_CREATE']), false)
  assert.equal(canUserExportMedicalRecords(['doctor'], []), false)

  // Dược sĩ KHÔNG có quyền xuất
  assert.equal(canUserExportMedicalRecords(['ROLE_PHARMACIST'], ['PHARMACY_READ']), false)

  // Lễ tân KHÔNG có quyền xuất
  assert.equal(canUserExportMedicalRecords(['ROLE_RECEPTIONIST'], ['PATIENT_READ']), false)

  // Bệnh nhân KHÔNG có quyền xuất
  assert.equal(canUserExportMedicalRecords(['ROLE_PATIENT'], []), false)
})

test('TC-EXPORT-03: mapExportErrorMessage ánh xạ đầy đủ và riêng biệt các mã lỗi Backend', () => {
  // 1. Hồ sơ chưa ký (QTN-41)
  const notSignedMsg = mapExportErrorMessage({
    code: 'MEDICAL_RECORD_NOT_SIGNED',
    message: 'Medical record with ID 9b2d4f6e must be signed before it can be exported.',
  }, 'BA-2026-0001')
  assert.ok(notSignedMsg.includes('chưa được ký, không thể xuất'), 'Phải có thông điệp chưa được ký')
  assert.ok(notSignedMsg.includes('BA-2026-0001'), 'Phải hiển thị mã hồ sơ vi phạm')
  assert.ok(notSignedMsg.includes('QTN-41'), 'Phải dẫn chiếu quy tắc QTN-41')

  // 2. Thiếu chẩn đoán chính có mã bệnh ICD-10 (QTN-22)
  const missingDiagMsg = mapExportErrorMessage({
    code: 'MEDICAL_RECORD_MISSING_DIAGNOSIS',
    message: 'Medical record requires at least one diagnosis before signing.',
  }, 'BA-2026-0002')
  assert.ok(missingDiagMsg.includes('thiếu chẩn đoán chính có mã bệnh, không thể xuất'))
  assert.ok(missingDiagMsg.includes('BA-2026-0002'))
  assert.ok(missingDiagMsg.includes('QTN-22'))

  // 3. Vượt quá giới hạn 100 hồ sơ
  const batchExceededMsg = mapExportErrorMessage({
    code: 'MAX_BATCH_SIZE_EXCEEDED',
  })
  assert.ok(batchExceededMsg.includes('tối đa 100 hồ sơ mỗi lần xuất'))

  const validation100Msg = mapExportErrorMessage({
    code: 'VALIDATION_ERROR',
    message: 'Maximum 100 medical records can be exported in a single batch.',
  })
  assert.ok(validation100Msg.includes('tối đa 100 hồ sơ mỗi lần xuất'))

  // 4. Lỗi phân quyền 403 Forbidden
  const forbiddenMsg = mapExportErrorMessage({
    status: 403,
    code: 'ACCESS_DENIED',
  })
  assert.ok(forbiddenMsg.includes('không có quyền') && forbiddenMsg.includes('MEDICAL_RECORD_EXPORT'))

  // 5. Lỗi 401 Unauthorized
  const unauthorizedMsg = mapExportErrorMessage({
    status: 401,
    code: 'UNAUTHORIZED',
  })
  assert.ok(unauthorizedMsg.includes('hết hạn'))

  // 6. Lỗi 404 Not Found
  const notFoundMsg = mapExportErrorMessage({
    code: 'MEDICAL_RECORD_NOT_FOUND',
  }, 'BA-9999')
  assert.ok(notFoundMsg.includes('Không tìm thấy hồ sơ bệnh án [BA-9999]'))

  // 7. Lỗi chuỗi thuần túy (string input)
  assert.ok(mapExportErrorMessage('MEDICAL_RECORD_NOT_SIGNED').includes('chưa được ký'))
  assert.ok(mapExportErrorMessage('MEDICAL_RECORD_MISSING_DIAGNOSIS').includes('thiếu chẩn đoán'))
})

test('TC-EXPORT-04: extractBlobErrorMessage đọc an toàn lỗi dạng blob mà không ném exception', async () => {
  // 1. Blob chứa JSON chuẩn
  const errorJson = {
    status: 400,
    code: 'MEDICAL_RECORD_NOT_SIGNED',
    message: 'Medical record must be signed',
  }
  const mockBlob = {
    text: async () => JSON.stringify(errorJson),
  }
  const resultFromBlob = await extractBlobErrorMessage({
    response: { data: mockBlob },
  })
  assert.deepEqual(resultFromBlob, errorJson)

  // 2. Blob chứa text không phải JSON (không throw)
  const mockNonJsonBlob = {
    text: async () => '<html>502 Bad Gateway</html>',
  }
  const resultNonJson = await extractBlobErrorMessage({
    response: { data: mockNonJsonBlob },
  })
  assert.deepEqual(resultNonJson, { message: '<html>502 Bad Gateway</html>' })

  // 3. Error data đã là Object
  const directObj = { code: 'ACCESS_DENIED', status: 403 }
  const resultDirect = await extractBlobErrorMessage({
    response: { data: directObj },
  })
  assert.deepEqual(resultDirect, directObj)

  // 4. Input null hoặc undefined (không throw)
  const resultNull = await extractBlobErrorMessage(null)
  assert.equal(resultNull, null)
})

test('TC-EXPORT-05: Giới hạn chọn hồ sơ tối đa 100 và quy tắc All-or-Nothing', () => {
  assert.equal(MAX_EXPORT_BATCH_SIZE, 100, 'Hệ thống phải cấu hình giới hạn tối đa 100 hồ sơ')

  const isBatchValid = (count) => count > 0 && count <= MAX_EXPORT_BATCH_SIZE

  assert.equal(isBatchValid(1), true, '1 hồ sơ là hợp lệ')
  assert.equal(isBatchValid(50), true, '50 hồ sơ là hợp lệ')
  assert.equal(isBatchValid(100), true, '100 hồ sơ là hợp lệ')
  assert.equal(isBatchValid(101), false, '101 hồ sơ phải bị chặn')
  assert.equal(isBatchValid(0), false, '0 hồ sơ không hợp lệ')
})

test('TC-EXPORT-06: extractFilenameFromHeader trích xuất đúng tên tệp từ header Content-Disposition', () => {
  // Standard format
  const standardHeader = 'attachment; filename="emr-exchange-bundle-1727164800000.json"'
  assert.equal(
    extractFilenameFromHeader(standardHeader),
    'emr-exchange-bundle-1727164800000.json'
  )

  // Single record filename
  const singleHeader = 'attachment; filename="emr-exchange-BN-2026-0001-VS-2026-0001.json"'
  assert.equal(
    extractFilenameFromHeader(singleHeader),
    'emr-exchange-BN-2026-0001-VS-2026-0001.json'
  )

  // UTF-8 encoded filename
  const utf8Header = "attachment; filename*=UTF-8''emr-exchange-bundle-2026.json"
  assert.equal(
    extractFilenameFromHeader(utf8Header),
    'emr-exchange-bundle-2026.json'
  )

  // Fallback when null or empty
  assert.equal(extractFilenameFromHeader(null, 'default.json'), 'default.json')
  assert.equal(extractFilenameFromHeader('', 'default.json'), 'default.json')
})

test('TC-EXPORT-07: downloadBlobFile hoạt động an toàn trong môi trường test/node', () => {
  const result = downloadBlobFile('{"test": true}', 'test-export.json')
  assert.equal(result, 'test-export.json')

  const resultWithHeader = downloadBlobFile(
    '{"test": true}',
    'fallback.json',
    { 'content-disposition': 'attachment; filename="bundle-from-header.json"' }
  )
  assert.equal(resultWithHeader, 'bundle-from-header.json')
})

test('TC-EXPORT-08: medicalRecordExportApi exportBatch và exportSingle có chữ ký hàm chính xác', () => {
  assert.equal(typeof exportBatch, 'function')
  assert.equal(typeof exportSingle, 'function')
})
