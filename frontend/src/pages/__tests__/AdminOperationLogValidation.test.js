import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ACTION_TYPE_CONFIG,
  FIELD_LABEL_DICTIONARY,
  RESOURCE_TYPE_FILTER_OPTIONS,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_OPTIONS,
  buildDiffRows,
  canViewAdminOperationLogs,
  convertDateRangeToIso,
  formatActionType,
  formatFieldValue,
  formatResourceType,
  formatVietnamDateTime,
  safeParseDetail,
  validateDateRange,
} from '../../utils/adminOperationLogHelpers.js'

test('1. KIỂM THỬ safeParseDetail (Parse an toàn chuỗi JSON detail)', () => {
  // 1.1. Parse đúng JSON hợp lệ với đầy đủ before và after
  const validJson = JSON.stringify({
    before: { price: 50000, active: true },
    after: { price: 65000, active: true },
  })
  const res1 = safeParseDetail(validJson)
  assert.equal(res1.isValid, true, 'JSON hợp lệ phải trả về isValid = true')
  assert.deepEqual(res1.before, { price: 50000, active: true })
  assert.deepEqual(res1.after, { price: 65000, active: true })

  // 1.2. Thao tác CREATE: before là null hoặc rỗng
  const createJson = JSON.stringify({
    before: null,
    after: { username: 'dr_nguyen', role: 'doctor' },
  })
  const res2 = safeParseDetail(createJson)
  assert.equal(res2.isValid, true)
  assert.deepEqual(res2.before, {}, 'before là null phải fallback về object rỗng')
  assert.deepEqual(res2.after, { username: 'dr_nguyen', role: 'doctor' })

  // 1.3. Chuỗi JSON lỗi cú pháp (broken string) - TUYỆT ĐỐI KHÔNG CRASH / THROW
  const brokenJson = '{"before": { price: 50000, invalid json...'
  assert.doesNotThrow(() => {
    const res3 = safeParseDetail(brokenJson)
    assert.equal(res3.isValid, false, 'JSON lỗi cú pháp phải trả về isValid = false')
    assert.deepEqual(res3.before, {})
    assert.deepEqual(res3.after, {})
  }, 'safeParseDetail không được throw exception khi gặp JSON lỗi')

  // 1.4. Dữ liệu null, undefined, chuỗi rỗng
  const resNull = safeParseDetail(null)
  assert.equal(resNull.isValid, false)
  assert.deepEqual(resNull.before, {})
  assert.deepEqual(resNull.after, {})

  const resUndefined = safeParseDetail(undefined)
  assert.equal(resUndefined.isValid, false)

  const resEmpty = safeParseDetail('')
  assert.equal(resEmpty.isValid, false)

  // 1.5. JSON là kiểu nguyên thủy (primitive) hoặc mảng (array)
  const resNumber = safeParseDetail('12345')
  assert.equal(resNumber.isValid, false)
  assert.deepEqual(resNumber.before, {})

  const resArray = safeParseDetail('[1, 2, 3]')
  assert.equal(resArray.isValid, false)
  assert.deepEqual(resArray.before, {})

  // 1.6. Dữ liệu đã là object sẵn (axios auto parse)
  const objInput = { before: { status: 'LOCKED' }, after: { status: 'ACTIVE' } }
  const resObj = safeParseDetail(objInput)
  assert.equal(resObj.isValid, true)
  assert.equal(resObj.before.status, 'LOCKED')
  assert.equal(resObj.after.status, 'ACTIVE')
})

test('2. KIỂM THỬ formatResourceType (Map đầy đủ các loại đối tượng quản trị sang tiếng Việt)', () => {
  // Khớp chính xác các nhóm đối tượng quản trị hệ thống:
  assert.equal(formatResourceType('USER'), 'Tài khoản nhân viên')
  assert.equal(formatResourceType('ROLE'), 'Vai trò & Phân quyền')
  assert.equal(formatResourceType('MEDICINE'), 'Danh mục thuốc')
  assert.equal(formatResourceType('SERVICE_CATALOG'), 'Danh mục dịch vụ')
  assert.equal(formatResourceType('SERVICE_PRICE'), 'Bảng giá dịch vụ')
  assert.equal(formatResourceType('DIAGNOSIS_CATALOG'), 'Danh mục mã bệnh (ICD-10)')
  assert.equal(formatResourceType('SECURITY_ALERT'), 'Cảnh báo an toàn bảo mật')
  assert.equal(formatResourceType('CONFIGURATION'), 'Cấu hình hệ thống & phòng khám')
  assert.equal(formatResourceType('SYSTEM_BACKUP'), 'Sao lưu & Phục hồi dữ liệu')
  assert.equal(formatResourceType('MEDICAL_RECORD_TEMPLATE'), 'Mẫu bệnh án chuyên khoa')
  assert.equal(formatResourceType('CLINICAL_SERVICE'), 'Danh mục cận lâm sàng & ngưỡng')
  assert.equal(formatResourceType('ROOM'), 'Quản lý phòng & phân phòng')
  assert.equal(formatResourceType('DOCTOR_SCHEDULE'), 'Lịch làm việc bác sĩ')
  assert.equal(formatResourceType('DOCTOR_TIMEOFF'), 'Lịch nghỉ của bác sĩ')

  // Trường hợp type không xác định
  assert.equal(formatResourceType('UNKNOWN_TYPE'), 'UNKNOWN_TYPE')
  assert.equal(formatResourceType(null), '—')

  // Kiểm tra đủ 14 options trong RESOURCE_TYPE_OPTIONS
  assert.equal(RESOURCE_TYPE_OPTIONS.length, 14)
  assert.deepEqual(
    RESOURCE_TYPE_OPTIONS.map((o) => o.value),
    [
      'USER', 'ROLE', 'MEDICINE', 'SERVICE_CATALOG', 'SERVICE_PRICE',
      'DIAGNOSIS_CATALOG', 'SECURITY_ALERT', 'CONFIGURATION', 'SYSTEM_BACKUP',
      'MEDICAL_RECORD_TEMPLATE', 'CLINICAL_SERVICE', 'ROOM', 'DOCTOR_SCHEDULE', 'DOCTOR_TIMEOFF'
    ]
  )

  // Kiểm tra option "Tất cả" trong RESOURCE_TYPE_FILTER_OPTIONS
  assert.equal(RESOURCE_TYPE_FILTER_OPTIONS[0].value, 'ALL')
  assert.equal(RESOURCE_TYPE_FILTER_OPTIONS[0].label, 'Tất cả đối tượng')
})

test('3. KIỂM THỬ formatActionType (Map các loại hành động sang tiếng Việt & màu Tag)', () => {
  const create = formatActionType('CREATE')
  assert.equal(create.label, 'Tạo mới')
  assert.equal(create.color, 'green')

  const update = formatActionType('UPDATE')
  assert.equal(update.label, 'Cập nhật')
  assert.equal(update.color, 'blue')

  const activate = formatActionType('ACTIVATE')
  assert.equal(activate.label, 'Kích hoạt')
  assert.equal(activate.color, 'cyan')

  const deactivate = formatActionType('DEACTIVATE')
  assert.equal(deactivate.label, 'Vô hiệu hóa')
  assert.equal(deactivate.color, 'orange')

  const unlock = formatActionType('UNLOCK')
  assert.equal(unlock.label, 'Mở khóa')
  assert.equal(unlock.color, 'purple')

  const backup = formatActionType('BACKUP')
  assert.equal(backup.label, 'Sao lưu')
  assert.equal(backup.color, 'cyan')

  const restore = formatActionType('RESTORE')
  assert.equal(restore.label, 'Phục hồi')
  assert.equal(restore.color, 'magenta')

  const exp = formatActionType('EXPORT')
  assert.equal(exp.label, 'Tải về / Xuất')
  assert.equal(exp.color, 'geekblue')

  // Hành động lạ fallback
  const other = formatActionType('OTHER')
  assert.equal(other.label, 'OTHER')
  assert.equal(other.color, 'default')
})

test('4. KIỂM THỬ validateDateRange (Kiểm tra khoảng thời gian lọc)', () => {
  // 4.1. Hợp lệ: from <= to
  const valid1 = validateDateRange('2026-09-01T00:00:00.000Z', '2026-09-18T23:59:59.999Z')
  assert.equal(valid1.isValid, true)
  assert.equal(valid1.error, null)

  // 4.2. Hợp lệ: from === to
  const valid2 = validateDateRange('2026-09-18T12:00:00.000Z', '2026-09-18T12:00:00.000Z')
  assert.equal(valid2.isValid, true)
  assert.equal(valid2.error, null)

  // 4.3. Bất hợp lệ: from > to (PHẢI chặn ngay ở Frontend)
  const invalid1 = validateDateRange('2026-09-20T00:00:00.000Z', '2026-09-10T00:00:00.000Z')
  assert.equal(invalid1.isValid, false)
  assert.match(invalid1.error, /Từ ngày.*phải trước hoặc bằng.*Đến ngày/)

  // 4.4. Không truyền hoặc chỉ truyền 1 mốc: hợp lệ (optional params)
  const validEmpty = validateDateRange(null, null)
  assert.equal(validEmpty.isValid, true)
  const validFromOnly = validateDateRange('2026-09-01T00:00:00.000Z', null)
  assert.equal(validFromOnly.isValid, true)

  // 4.5. Chuỗi ngày không hợp lệ
  const invalidDate = validateDateRange('invalid-date', '2026-09-18T00:00:00.000Z')
  assert.equal(invalidDate.isValid, false)
})

test('5. KIỂM THỬ buildDiffRows (So sánh trước vs sau, xác định chính xác field thay đổi)', () => {
  const before = {
    price: 100000,
    unit: 'Lần',
    status: 'ACTIVE',
  }
  const after = {
    price: 120000, // Đổi giá
    unit: 'Lần',   // Không đổi
    status: 'ACTIVE',
    effectiveTo: '2026-12-31', // Thêm mới
  }

  const rows = buildDiffRows(before, after)
  assert.equal(rows.length, 4, 'Bảng diff phải chứa 4 trường')

  // Tìm trường price
  const priceRow = rows.find((r) => r.field === 'price')
  assert.ok(priceRow)
  assert.equal(priceRow.changed, true, 'Giá thay đổi phải có changed = true')
  assert.equal(priceRow.oldValue, 100000)
  assert.equal(priceRow.newValue, 120000)

  // Tìm trường unit (không thay đổi)
  const unitRow = rows.find((r) => r.field === 'unit')
  assert.ok(unitRow)
  assert.equal(unitRow.changed, false, 'Đơn vị không đổi phải có changed = false')
  assert.equal(unitRow.oldValue, 'Lần')
  assert.equal(unitRow.newValue, 'Lần')

  // Tìm trường mới thêm (effectiveTo)
  const effectiveToRow = rows.find((r) => r.field === 'effectiveTo')
  assert.ok(effectiveToRow)
  assert.equal(effectiveToRow.changed, true, 'Trường mới xuất hiện phải có changed = true')
  assert.equal(effectiveToRow.oldValue, undefined)
  assert.equal(effectiveToRow.newValue, '2026-12-31')

  // Thao tác CREATE: before rỗng
  const createRows = buildDiffRows({}, { username: 'admin1', fullName: 'Quản trị viên 1' })
  assert.equal(createRows.length, 2)
  assert.ok(createRows.every((r) => r.changed === true), 'Mọi trường của bản ghi CREATE đều được coi là thay đổi/khởi tạo')

  // Edge case: null hoặc undefined input
  const nullRows = buildDiffRows(null, null)
  assert.deepEqual(nullRows, [])
})

test('6. KIỂM THỬ PHÂN QUYỀN TRUY CẬP (RBAC & ADMIN_OPERATION_LOG_READ)', () => {
  // 6.1. Admin và Manager được phép truy cập
  assert.equal(canViewAdminOperationLogs(['admin']), true, 'Admin phải có quyền truy cập')
  assert.equal(canViewAdminOperationLogs(['manager']), true, 'Manager phải có quyền truy cập')
  assert.equal(canViewAdminOperationLogs(['clinic_manager']), true, 'Clinic Manager phải có quyền truy cập')
  assert.equal(canViewAdminOperationLogs(['ROLE_ADMIN']), true, 'Tiền tố ROLE_ phải được chuẩn hóa đúng')
  assert.equal(canViewAdminOperationLogs(['ROLE_MANAGER']), true, 'Tiền tố ROLE_MANAGER phải được chuẩn hóa đúng')

  // 6.2. Doctor, Receptionist, Pharmacist BỊ CHẶN TUYỆT ĐỐI
  assert.equal(canViewAdminOperationLogs(['doctor']), false, 'Bác sĩ không được truy cập')
  assert.equal(canViewAdminOperationLogs(['receptionist']), false, 'Lễ tân không được truy cập')
  assert.equal(canViewAdminOperationLogs(['pharmacist']), false, 'Dược sĩ không được truy cập')
  assert.equal(canViewAdminOperationLogs(['ROLE_DOCTOR']), false, 'ROLE_DOCTOR bị chặn')

  // 6.3. User có quyền ADMIN_OPERATION_LOG_READ được phép truy cập
  assert.equal(
    canViewAdminOperationLogs([], ['ADMIN_OPERATION_LOG_READ']),
    true,
    'Có permission ADMIN_OPERATION_LOG_READ phải được truy cập'
  )
  assert.equal(
    canViewAdminOperationLogs([], ['PERMISSION_ADMIN_OPERATION_LOG_READ']),
    true,
    'Tiền tố PERMISSION_ phải được chuẩn hóa đúng'
  )

  // 6.4. User không có vai trò hoặc không có quyền bị từ chối
  assert.equal(canViewAdminOperationLogs([], []), false)
  assert.equal(canViewAdminOperationLogs(null, null), false)
  assert.equal(canViewAdminOperationLogs(['staff'], ['PATIENT_READ']), false)
})

test('7. KIỂM THỬ ĐỊNH DẠNG GIÁ TRỊ & MÚI GIỜ VIỆT NAM (Asia/Ho_Chi_Minh)', () => {
  // formatFieldValue
  assert.equal(formatFieldValue(null), '—')
  assert.equal(formatFieldValue(undefined), '—')
  assert.equal(formatFieldValue(true), 'Có / Đang hoạt động')
  assert.equal(formatFieldValue(false), 'Không / Vô hiệu hóa')
  assert.equal(formatFieldValue(150000), '150.000')
  assert.equal(formatFieldValue(['ADMIN', 'DOCTOR']), 'ADMIN, DOCTOR')

  // formatVietnamDateTime
  const sampleUtcIso = '2026-09-18T02:30:00.000Z'
  const formattedVn = formatVietnamDateTime(sampleUtcIso)
  // 02:30 UTC = 09:30 UTC+7 (Asia/Ho_Chi_Minh)
  assert.match(formattedVn, /18\/09\/2026/)
  assert.match(formattedVn, /09:30:00/)

  // convertDateRangeToIso
  const dateRange = convertDateRangeToIso(['2026-09-01', '2026-09-18'])
  assert.ok(dateRange.from, 'from ISO string phải tồn tại')
  assert.ok(dateRange.to, 'to ISO string phải tồn tại')
  // 2026-09-01T00:00:00+07:00 = 2026-08-31T17:00:00.000Z
  assert.equal(dateRange.from, '2026-08-31T17:00:00.000Z')
})

test('8. KIỂM THỬ LỌC TÀI KHOẢN QUẢN TRỊ CHO DROPDOWN (Chỉ Admin/Manager, loại bỏ Lễ tân/Bác sĩ/Dược sĩ)', () => {
  const sampleUsers = [
    { id: '1', username: 'admin', fullName: 'Quản trị viên', role: 'ADMIN' },
    { id: '2', username: 'manager1', fullName: 'Quản lý phòng khám', role: 'ROLE_MANAGER' },
    { id: '3', username: 'receptionist1', fullName: 'Pham Mai Lan', role: 'RECEPTIONIST' },
    { id: '4', username: 'doctor1', fullName: 'Dr. Nguyen Minh Anh', role: 'DOCTOR' },
    { id: '5', username: 'pharmacist1', fullName: 'Vo Thanh Nam', role: 'PHARMACIST' },
  ]

  const filterAdminUsers = (users) =>
    users.filter((u) => {
      const rawRole = u.roleName || u.role || ''
      const singleRole = String(rawRole).toLowerCase().replace(/^role_/, '')
      const multiRoles = Array.isArray(u.roles)
        ? u.roles.map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
        : []
      const userRoles = multiRoles.length > 0 ? multiRoles : (singleRole ? [singleRole] : [])
      return (
        userRoles.includes('admin') ||
        userRoles.includes('manager') ||
        userRoles.includes('clinic_manager')
      )
    })

  const filtered = filterAdminUsers(sampleUsers)
  assert.equal(filtered.length, 2, 'Chỉ 2 tài khoản Admin và Manager được lọt vào danh sách lọc')
  assert.equal(filtered[0].username, 'admin')
  assert.equal(filtered[1].username, 'manager1')

  const usernames = filtered.map((u) => u.username)
  assert.ok(!usernames.includes('receptionist1'), 'Lễ tân (receptionist1) tuyệt đối không xuất hiện trong danh sách người thực hiện quản trị')
  assert.ok(!usernames.includes('doctor1'), 'Bác sĩ (doctor1) không xuất hiện')
  assert.ok(!usernames.includes('pharmacist1'), 'Dược sĩ (pharmacist1) không xuất hiện')
})

