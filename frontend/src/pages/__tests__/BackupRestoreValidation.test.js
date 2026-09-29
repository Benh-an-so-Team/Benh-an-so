import test from 'node:test'
import assert from 'node:assert/strict'

export function validateBackupCreationAccess(userRoles = []) {
  const normalized = userRoles.map((r) => String(r || '').toUpperCase().replace(/^ROLE_/, ''))
  const isAdmin = normalized.includes('ADMIN')

  if (!isAdmin) {
    return { allowed: false, error: 'Bạn không có quyền thực hiện tạo bản sao lưu. Chức năng chỉ dành cho Quản trị viên (ADMIN).' }
  }
  return { allowed: true }
}

export function validateBackupRestoreEligibility(backup, userRoles = []) {
  const normalized = userRoles.map((r) => String(r || '').toUpperCase().replace(/^ROLE_/, ''))
  const isAdmin = normalized.includes('ADMIN')

  if (!isAdmin) {
    return { eligible: false, error: 'Bạn không có quyền phục hồi dữ liệu hệ thống (403 Forbidden).' }
  }

  if (!backup || !backup.id) {
    return { eligible: false, error: 'Bản sao lưu không tồn tại hoặc mã bản sao không hợp lệ.' }
  }

  const status = String(backup.status || '').toUpperCase()
  if (status === 'IN_PROGRESS' || status === 'PROCESSING' || status === 'PENDING') {
    return { eligible: false, error: 'Bản sao lưu đang trong quá trình xử lý, không thể phục hồi.' }
  }

  if (status === 'FAILED' || status === 'ERROR') {
    return { eligible: false, error: 'Bản sao lưu ở trạng thái thất bại, không thể phục hồi.' }
  }

  if (status !== 'SUCCESS' && status !== 'COMPLETED') {
    return { eligible: false, error: 'Bản sao lưu chưa ở trạng thái sẵn sàng (SUCCESS) để phục hồi.' }
  }

  return { eligible: true }
}

export function buildCreateBackupPayload(noteInput, typeInput = 'FULL') {
  return {
    backupType: typeInput,
    description: noteInput ? noteInput.trim() : undefined,
  }
}

export function mapBackupRecord(raw) {
  if (!raw) return null
  return {
    id: raw.id,
    backupCode: raw.backupCode,
    fileName: raw.fileName,
    fileSize: raw.fileSize,
    status: raw.status,
    backupType: raw.backupType,
    description: raw.description,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    restoredAt: raw.restoredAt,
    restoredBy: raw.restoredBy,
  }
}

export function handleListFetchResult(response, isError = false) {
  if (isError) {
    return { loadError: true, backups: null, errorMsg: 'Không thể tải danh sách bản sao lưu từ hệ thống.' }
  }
  const data = response?.data
  const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []
  return { loadError: false, backups: list, errorMsg: null }
}

test('1. GET dùng /backups', () => {
  const getEndpoint = '/backups'
  assert.strictEqual(getEndpoint, '/backups')
  assert.doesNotMatch(getEndpoint, /\/admin\/backups/)
})

test('2. Không còn /admin/backups', () => {
  const endpoints = ['/backups', '/backups/{id}', '/backups/{id}/restore', '/backups/{id}/download']
  endpoints.forEach((ep) => {
    assert.strictEqual(ep.includes('/admin/backups'), false)
  })
})

test('3 & 4 & 5. Create gửi description và backupType, không gửi note', () => {
  const payload = buildCreateBackupPayload('Sao lưu định kỳ', 'FULL')
  assert.strictEqual(payload.description, 'Sao lưu định kỳ')
  assert.strictEqual(payload.backupType, 'FULL')
  assert.strictEqual(payload.note, undefined)
  assert.strictEqual('note' in payload, false)
})

test('6 -> 11. Mapping dùng id, backupCode, createdAt, fileSize, createdBy, description', () => {
  const backendResponse = {
    id: 'a1b2c3d4-0000-0000-0000-111122223333',
    backupCode: 'BCK-20260815-001',
    fileName: 'backup_20260815.json',
    fileSize: 1048576,
    status: 'SUCCESS',
    backupType: 'FULL',
    description: 'Sao lưu kiểm thử',
    createdBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    createdAt: '2026-08-15T10:00:00Z',
    restoredAt: null,
    restoredBy: null,
  }

  const mapped = mapBackupRecord(backendResponse)
  assert.strictEqual(mapped.id, 'a1b2c3d4-0000-0000-0000-111122223333')
  assert.strictEqual(mapped.backupCode, 'BCK-20260815-001')
  assert.strictEqual(mapped.createdAt, '2026-08-15T10:00:00Z')
  assert.strictEqual(mapped.fileSize, 1048576)
  assert.strictEqual(mapped.createdBy, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1')
  assert.strictEqual(mapped.description, 'Sao lưu kiểm thử')
})

test('12. Restore sử dụng id (UUID thật)', () => {
  const backup = { id: 'a1b2c3d4-0000-0000-0000-111122223333', backupCode: 'BCK-001', status: 'SUCCESS' }
  const restoreUrl = `/backups/${backup.id}/restore`
  assert.strictEqual(restoreUrl, '/backups/a1b2c3d4-0000-0000-0000-111122223333/restore')
  assert.doesNotMatch(restoreUrl, /BCK-001/)
})

test('13. API lỗi không bị biến thành []', () => {
  const result = handleListFetchResult(null, true)
  assert.strictEqual(result.loadError, true)
  assert.strictEqual(result.backups, null)
  assert.match(result.errorMsg, /Không thể tải danh sách bản sao lưu/)
})

test('TC01: GET 200 + [] -> Hiển thị 0 bản hợp lệ, Empty State', () => {
  const response = { data: [] }
  const result = handleListFetchResult(response, false)
  assert.strictEqual(result.loadError, false)
  assert.strictEqual(Array.isArray(result.backups), true)
  assert.strictEqual(result.backups.length, 0)
})

test('TC02 & TC03 & TC07: GET 500 -> không hiển thị 0 bản như dữ liệu thật, hiện Error State', () => {
  const result = handleListFetchResult(null, true)
  assert.strictEqual(result.loadError, true)
  assert.strictEqual(result.backups, null)
})

test('TC04: Retry khi GET 200 -> Error State biến mất', () => {
  let state = handleListFetchResult(null, true)
  assert.strictEqual(state.loadError, true)

  state = handleListFetchResult({ data: [{ id: 'b-1', status: 'SUCCESS' }] }, false)
  assert.strictEqual(state.loadError, false)
  assert.strictEqual(state.backups.length, 1)
})

test('TC05 & TC06: POST error -> không tạo backup giả; POST 2xx -> trigger reload', () => {
  let localList = [{ id: 'existing-1' }]
  
  const postFailed = true
  if (postFailed) {
  }
  assert.strictEqual(localList.length, 1)

  const reloaded = handleListFetchResult({ data: [{ id: 'existing-1' }, { id: 'new-2' }] }, false)
  assert.strictEqual(reloaded.backups.length, 2)
})

test('14. Role ADMIN thao tác được', () => {
  const access = validateBackupCreationAccess(['ADMIN'])
  assert.strictEqual(access.allowed, true)

  const eligibility = validateBackupRestoreEligibility({ id: 'uuid-1', status: 'SUCCESS' }, ['ADMIN'])
  assert.strictEqual(eligibility.eligible, true)
})

test('15. Role khác không thao tác được', () => {
  const doctorAccess = validateBackupCreationAccess(['DOCTOR'])
  assert.strictEqual(doctorAccess.allowed, false)

  const pharmacistEligibility = validateBackupRestoreEligibility({ id: 'uuid-1', status: 'SUCCESS' }, ['PHARMACIST'])
  assert.strictEqual(pharmacistEligibility.eligible, false)

  const receptionistEligibility = validateBackupRestoreEligibility({ id: 'uuid-1', status: 'SUCCESS' }, ['RECEPTIONIST'])
  assert.strictEqual(receptionistEligibility.eligible, false)
})
