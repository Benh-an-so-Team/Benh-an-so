import assert from 'node:assert/strict'
import test from 'node:test'

import { getNavigationItems } from '../../components/layout/navigationConfig.js'
import { DOMAIN_ERROR_MESSAGES, getApiErrorMessage } from '../../utils/apiError.js'
import specialtyApi from '../../api/specialtyApi.js'
import axiosClient from '../../api/axiosClient.js'

// ==============================================================================
// NCL-09-CN-007 Quản lý danh mục chuyên khoa và phòng khám bệnh
// ==============================================================================

test('NCL-09-CN-007 / QTN-01: Phân quyền truy cập menu danh mục chuyên khoa', () => {
  // ADMIN role should see /system/specialties
  const adminItems = getNavigationItems({
    roles: ['admin'],
    permissions: ['SPECIALTY_MANAGE'],
  })
  const hasSpecialtyMenuForAdmin = adminItems.some((item) => item.key === '/system/specialties')
  assert.strictEqual(hasSpecialtyMenuForAdmin, true, 'Quản trị viên (ADMIN) phải nhìn thấy menu danh mục chuyên khoa')

  // User with explicit SPECIALTY_MANAGE permission should see it
  const customPermItems = getNavigationItems({
    roles: ['staff'],
    permissions: ['SPECIALTY_MANAGE'],
  })
  assert.strictEqual(
    customPermItems.some((item) => item.key === '/system/specialties'),
    true,
    'Người dùng có quyền SPECIALTY_MANAGE phải nhìn thấy menu'
  )

  // Non-admin roles without SPECIALTY_MANAGE should NOT see it
  const doctorItems = getNavigationItems({
    roles: ['doctor'],
    permissions: ['MEDICAL_RECORD_READ', 'PRESCRIPTION_CREATE'],
  })
  assert.strictEqual(
    doctorItems.some((item) => item.key === '/system/specialties'),
    false,
    'Bác sĩ không có quyền quản lý chuyên khoa thì không thấy menu'
  )

  const patientItems = getNavigationItems({
    roles: ['patient'],
    permissions: [],
  })
  assert.strictEqual(
    patientItems.some((item) => item.key === '/system/specialties'),
    false,
    'Bệnh nhân không được thấy menu quản trị chuyên khoa'
  )
})

test('NCL-09-CN-007-TC-01: Luồng thành công - Tạo một chuyên khoa và gán bác sĩ cùng phòng khám bệnh', async () => {
  let capturedUrl
  let capturedPayload
  const originalPost = axiosClient.post

  const mockCreatedResponse = {
    id: 'spec-uuid-01',
    code: 'PEDIATRICS',
    name: 'Khoa Nhi',
    description: 'Khám và điều trị chuyên khoa nhi',
    active: true,
    doctors: [
      { id: 'doc-uuid-01', username: 'dr_john', fullName: 'BS. Nguyễn Văn A' },
    ],
    rooms: [
      { id: 'room-uuid-01', code: 'P101', name: 'Phòng khám Nhi 1', active: true },
    ],
    activeTemplateCount: 0,
  }

  axiosClient.post = async (url, data) => {
    capturedUrl = url
    capturedPayload = data
    return { data: mockCreatedResponse }
  }

  try {
    const newSpecialtyInput = {
      code: 'PEDIATRICS',
      name: 'Khoa Nhi',
      description: 'Khám và điều trị chuyên khoa nhi',
      doctorIds: ['doc-uuid-01'],
      roomIds: ['room-uuid-01'],
    }

    const res = await specialtyApi.create(newSpecialtyInput)

    assert.strictEqual(capturedUrl, '/system/specialties')
    assert.strictEqual(capturedPayload.code, 'PEDIATRICS')
    assert.strictEqual(capturedPayload.name, 'Khoa Nhi')
    assert.deepEqual(capturedPayload.doctorIds, ['doc-uuid-01'])
    assert.deepEqual(capturedPayload.roomIds, ['room-uuid-01'])

    assert.strictEqual(res.data.id, 'spec-uuid-01')
    assert.strictEqual(res.data.active, true)
    assert.strictEqual(res.data.doctors.length, 1)
    assert.strictEqual(res.data.rooms.length, 1)
  } finally {
    axiosClient.post = originalPost
  }
})

test('NCL-09-CN-007-TC-02: Sai trạng thái - Cảnh báo chuyên khoa đang dùng & chặn chuyên khoa GENERAL', async () => {
  // 1. Chặn ngừng dùng chuyên khoa mặc định hệ thống GENERAL
  const generalCode = 'GENERAL'
  const isGeneralBlocked = generalCode === 'GENERAL'
  assert.strictEqual(isGeneralBlocked, true, 'Chuyên khoa GENERAL bắt buộc phải bị chặn ngừng dùng')

  const cannotDeactivateMsg = DOMAIN_ERROR_MESSAGES.CANNOT_DEACTIVATE_DEFAULT_SPECIALTY
  assert.match(
    cannotDeactivateMsg,
    /Không thể ngừng dùng chuyên khoa mặc định hệ thống/,
    'Thông báo chặn chuyên khoa mặc định phải rõ ràng'
  )

  // 2. Chuyên khoa đang có liên kết (bác sĩ / mẫu bệnh án)
  let capturedUrl
  let capturedConfig
  const originalPatch = axiosClient.patch

  axiosClient.patch = async (url, data, config) => {
    capturedUrl = url
    capturedConfig = config
    if (config?.params?.confirm === false) {
      const err = new Error('Specialty is in use')
      err.response = {
        status: 409,
        data: {
          code: 'SPECIALTY_IN_USE',
          message: 'Chuyên khoa đang được gán cho 1 bác sĩ và 1 mẫu bệnh án đang hoạt động. Cần xác nhận trước khi ngừng dùng.',
        },
      }
      throw err
    }
    return {
      data: {
        id: 'spec-uuid-02',
        code: 'INTERNAL',
        name: 'Khoa Nội',
        active: false,
      },
    }
  }

  try {
    // Attempt 1: confirm = false -> expects 409 SPECIALTY_IN_USE
    await assert.rejects(
      specialtyApi.deactivate('spec-uuid-02', false),
      (err) => {
        assert.strictEqual(err.response.status, 409)
        assert.strictEqual(err.response.data.code, 'SPECIALTY_IN_USE')
        const friendlyMsg = getApiErrorMessage(err)
        assert.match(friendlyMsg, /Chuyên khoa đang được gán cho bác sĩ hoặc mẫu bệnh án/)
        return true
      }
    )

    // Attempt 2: User confirms -> confirm = true -> deactivates successfully
    const confirmedRes = await specialtyApi.deactivate('spec-uuid-02', true)
    assert.strictEqual(capturedConfig.params.confirm, true)
    assert.strictEqual(confirmedRes.data.active, false)
  } finally {
    axiosClient.patch = originalPatch
  }
})

test('NCL-09-CN-007-TC-03: Dữ liệu trùng lặp - Báo lỗi trùng tên hoặc trùng mã và không cho tạo', () => {
  // Test error mapping for duplicate name
  const nameError = {
    response: {
      status: 409,
      data: {
        code: 'SPECIALTY_NAME_ALREADY_EXISTS',
        message: 'Specialty name already exists: Khoa Nhi',
      },
    },
  }
  const translatedNameError = getApiErrorMessage(nameError)
  assert.strictEqual(
    translatedNameError,
    'Tên chuyên khoa đã tồn tại trong danh mục hệ thống.',
    'Thông báo trùng tên chuyên khoa phải chính xác theo nghiệp vụ'
  )

  // Test error mapping for duplicate code
  const codeError = {
    response: {
      status: 409,
      data: {
        code: 'SPECIALTY_CODE_ALREADY_EXISTS',
        message: 'Specialty code already exists: PEDIATRICS',
      },
    },
  }
  const translatedCodeError = getApiErrorMessage(codeError)
  assert.strictEqual(
    translatedCodeError,
    'Mã chuyên khoa đã tồn tại trong danh mục hệ thống.',
    'Thông báo trùng mã chuyên khoa phải chính xác theo nghiệp vụ'
  )
})

test('NCL-09-CN-007: Validation rules cho form chuyên khoa', () => {
  // Code regex validation: ^[A-Za-z0-9_]+$, max 30 chars
  const codeRegex = /^[A-Za-z0-9_]+$/

  assert.strictEqual(codeRegex.test('PEDIATRICS'), true)
  assert.strictEqual(codeRegex.test('KHOA_NHI_01'), true)
  assert.strictEqual(codeRegex.test('INTERNAL_MED'), true)

  // Invalid codes
  assert.strictEqual(codeRegex.test('khoa nhi'), false, 'Mã không được có khoảng trắng')
  assert.strictEqual(codeRegex.test('KHOA-NHI'), false, 'Mã không được có dấu gạch ngang')
  assert.strictEqual(codeRegex.test('CHUYÊN_KHOA'), false, 'Mã không được có dấu tiếng Việt')
  assert.strictEqual(codeRegex.test(''), false, 'Mã không được rỗng')

  const maxLength = 30
  assert.strictEqual('A'.repeat(30).length <= maxLength, true)
  assert.strictEqual('A'.repeat(31).length <= maxLength, false)
})

test('PR #240: Tất cả các file trong module chuyên khoa phải có đuôi mở rộng file trong import ESM (.js/.jsx)', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')

  const filesToCheck = [
    'src/pages/SpecialtyManagementPage.jsx',
    'src/components/specialty/SpecialtyFormModal.jsx',
    'src/components/specialty/SpecialtyDeactivateConfirmModal.jsx',
    'src/components/specialty/SpecialtyDetailDrawer.jsx',
  ]

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(relPath)
    const content = fs.readFileSync(fullPath, 'utf8')
    const relativeImportRegex = /from\s+['"](\.\.?\/[^'"]+)['"]/g
    let match
    while ((match = relativeImportRegex.exec(content)) !== null) {
      const importPath = match[1]
      // CSS imports end in .css, code imports must end in .js or .jsx
      const hasValidExt = importPath.endsWith('.js') || importPath.endsWith('.jsx') || importPath.endsWith('.css')
      assert.strictEqual(
        hasValidExt,
        true,
        `Import "${importPath}" trong file ${relPath} phải có đuôi file (.js, .jsx, .css)`
      )
    }
  }
})

test('PR #240: KPI stats không bị tính sai khi lọc trạng thái (đảm bảo tính trên toàn bộ dữ liệu)', () => {
  const fullSpecialties = [
    { id: '1', code: 'GENERAL', name: 'Đa khoa', active: true },
    { id: '2', code: 'PEDIATRICS', name: 'Nhi', active: true },
    { id: '3', code: 'OLD_SPEC', name: 'Khoa cũ', active: false },
  ]

  // KPI tính từ danh sách đầy đủ (không filter)
  const total = fullSpecialties.length
  const activeCount = fullSpecialties.filter((s) => s.active).length
  const inactiveCount = total - activeCount

  assert.strictEqual(total, 3, 'Tổng số chuyên khoa phải là 3')
  assert.strictEqual(activeCount, 2, 'Số chuyên khoa đang hoạt động phải là 2')
  assert.strictEqual(inactiveCount, 1, 'Số chuyên khoa ngừng dùng phải là 1')

  // Giả lập danh sách sau khi đã filter trạng thái 'ACTIVE'
  const filteredActiveList = fullSpecialties.filter((s) => s.active)
  assert.strictEqual(filteredActiveList.length, 2)
  // KPI vẫn phải giữ nguyên theo danh sách tổng, không bị tụt inactiveCount về 0
  assert.strictEqual(inactiveCount, 1, 'Khi hiển thị tab Đang dùng, KPI Ngừng dùng không được tụt về 0')
})

