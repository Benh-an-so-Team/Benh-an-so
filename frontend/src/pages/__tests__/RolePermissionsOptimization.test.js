import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ROLE_DISPLAY_NAMES,
  ROLE_THEMES,
  MODULE_DISPLAY_NAMES,
  PERMISSION_DETAILS,
  getRoleDisplayName,
  getRoleTheme,
  getModuleDisplayName,
  getPermissionDetails,
} from '../../components/rolePermissions/rolePermissionsConstants.js'


test('TC01: Kiểm tra mapping tên hiển thị của các vai trò chuẩn', () => {
  assert.equal(getRoleDisplayName({ name: 'ADMIN' }), 'Quản trị viên')
  assert.equal(getRoleDisplayName({ name: 'DOCTOR' }), 'Bác sĩ')
  assert.equal(getRoleDisplayName({ name: 'RECEPTIONIST' }), 'Lễ tân')
  assert.equal(getRoleDisplayName({ name: 'PHARMACIST' }), 'Dược sĩ')
  assert.equal(getRoleDisplayName({ name: 'MANAGER' }), 'Quản lý phòng khám')
  assert.equal(getRoleDisplayName(null), '—')
})

test('TC02: Kiểm tra module display names và permission details', () => {
  assert.equal(getModuleDisplayName('APPOINTMENT'), 'Lịch hẹn Khám bệnh')
  assert.equal(getModuleDisplayName('AUDIT'), 'Kiểm toán & Nhật ký An toàn')
  assert.equal(getModuleDisplayName('BACKUP'), 'Sao lưu & Phục hồi Dữ liệu')

  const apptPerm = getPermissionDetails({ code: 'APPOINTMENT_CREATE' })
  assert.equal(apptPerm.title, 'Đặt lịch hẹn khám mới')
  assert.ok(apptPerm.desc.includes('phiếu hẹn'))

  const customPerm = getPermissionDetails({ code: 'CUSTOM_ACTION', description: 'Mô tả test' })
  assert.equal(customPerm.title, 'Custom action')
  assert.equal(customPerm.desc, 'Mô tả test')
})

test('TC03: Kiểm tra tính toán trạng thái 3-state checkbox của phân hệ', () => {
  const getModuleCheckState = (roleCodesSet, permsInModule) => {
    const activePerms = permsInModule.filter((p) => p.active !== false)
    if (activePerms.length === 0) return { all: false, indeterminate: false, checkedCount: 0, total: 0 }

    let checkedCount = 0
    activePerms.forEach((p) => {
      if (roleCodesSet.has(p.code)) checkedCount++
    })

    const all = checkedCount === activePerms.length
    const indeterminate = checkedCount > 0 && checkedCount < activePerms.length

    return { all, indeterminate, checkedCount, total: activePerms.length }
  }

  const perms = [
    { code: 'APPOINTMENT_CREATE', active: true },
    { code: 'APPOINTMENT_READ', active: true },
    { code: 'APPOINTMENT_UPDATE', active: true },
    { code: 'APPOINTMENT_DELETE', active: true },
  ]

  // Case 1: All checked
  const stateAll = getModuleCheckState(new Set(['APPOINTMENT_CREATE', 'APPOINTMENT_READ', 'APPOINTMENT_UPDATE', 'APPOINTMENT_DELETE']), perms)
  assert.equal(stateAll.all, true)
  assert.equal(stateAll.indeterminate, false)
  assert.equal(stateAll.checkedCount, 4)
  assert.equal(stateAll.total, 4)

  // Case 2: Indeterminate (2/4)
  const stateIndeterminate = getModuleCheckState(new Set(['APPOINTMENT_CREATE', 'APPOINTMENT_READ']), perms)
  assert.equal(stateIndeterminate.all, false)
  assert.equal(stateIndeterminate.indeterminate, true)
  assert.equal(stateIndeterminate.checkedCount, 2)
  assert.equal(stateIndeterminate.total, 4)

  // Case 3: None checked
  const stateNone = getModuleCheckState(new Set(), perms)
  assert.equal(stateNone.all, false)
  assert.equal(stateNone.indeterminate, false)
  assert.equal(stateNone.checkedCount, 0)
  assert.equal(stateNone.total, 4)
})

test('TC04: Kiểm tra logic Toggle Permission không làm mất quyền khác', () => {
  const currentSet = new Set(['APPOINTMENT_READ', 'PATIENT_READ'])

  // Bật quyền APPOINTMENT_CREATE
  const nextSetAdd = new Set(currentSet)
  if (nextSetAdd.has('APPOINTMENT_CREATE')) nextSetAdd.delete('APPOINTMENT_CREATE')
  else nextSetAdd.add('APPOINTMENT_CREATE')

  assert.equal(nextSetAdd.has('APPOINTMENT_CREATE'), true)
  assert.equal(nextSetAdd.has('APPOINTMENT_READ'), true)
  assert.equal(nextSetAdd.has('PATIENT_READ'), true)

  // Tắt quyền APPOINTMENT_READ
  const nextSetRemove = new Set(nextSetAdd)
  if (nextSetRemove.has('APPOINTMENT_READ')) nextSetRemove.delete('APPOINTMENT_READ')
  else nextSetRemove.add('APPOINTMENT_READ')

  assert.equal(nextSetRemove.has('APPOINTMENT_READ'), false)
  assert.equal(nextSetRemove.has('APPOINTMENT_CREATE'), true)
  assert.equal(nextSetRemove.has('PATIENT_READ'), true)
})

test('TC05: Kiểm tra logic Toggle cả Module (Batch toggle)', () => {
  const permsInModule = [
    { code: 'USER_CREATE', active: true },
    { code: 'USER_READ', active: true },
    { code: 'USER_UPDATE', active: true },
    { code: 'USER_DELETE', active: true },
  ]

  // Đang có 2 quyền -> Bấm checkbox sẽ bật tất cả
  const currentCodes = new Set(['USER_READ', 'OTHER_PERM'])
  const allAssignedBefore = permsInModule.every((p) => currentCodes.has(p.code))
  assert.equal(allAssignedBefore, false)

  const nextCodes = new Set(currentCodes)
  permsInModule.forEach((p) => {
    if (allAssignedBefore) nextCodes.delete(p.code)
    else nextCodes.add(p.code)
  })

  assert.equal(nextCodes.has('USER_CREATE'), true)
  assert.equal(nextCodes.has('USER_READ'), true)
  assert.equal(nextCodes.has('USER_UPDATE'), true)
  assert.equal(nextCodes.has('USER_DELETE'), true)
  assert.equal(nextCodes.has('OTHER_PERM'), true)

  // Đang có đủ cả 4 quyền -> Bấm checkbox sẽ bỏ toàn bộ quyền của module đó
  const allAssignedAfter = permsInModule.every((p) => nextCodes.has(p.code))
  assert.equal(allAssignedAfter, true)

  const nextCodesRemoved = new Set(nextCodes)
  permsInModule.forEach((p) => {
    if (allAssignedAfter) nextCodesRemoved.delete(p.code)
    else nextCodesRemoved.add(p.code)
  })

  assert.equal(nextCodesRemoved.has('USER_CREATE'), false)
  assert.equal(nextCodesRemoved.has('USER_READ'), false)
  assert.equal(nextCodesRemoved.has('USER_UPDATE'), false)
  assert.equal(nextCodesRemoved.has('USER_DELETE'), false)
  assert.equal(nextCodesRemoved.has('OTHER_PERM'), true)
})
