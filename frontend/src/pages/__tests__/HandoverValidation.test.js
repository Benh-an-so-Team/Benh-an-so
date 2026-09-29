import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import visitApi from '../../api/visitApi.js'
import axiosClient from '../../api/axiosClient.js'
import {
  PRESET_HANDOVER_REASONS,
  canHandoverVisit,
  validateHandoverInput,
  formatHandoverDateTime,
} from '../../utils/handoverValidation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==============================================================================
// NCL-04-CN-014: Bàn giao bệnh nhân sang bác sĩ khác
// ==============================================================================

test('NCL-04-CN-014-TC-01: Luồng thành công - Bàn giao bệnh nhân khi ca khám đang diễn ra và bệnh án chưa ký', async () => {
  let capturedPostUrl = ''
  let capturedPayload = null
  let capturedGetUrl = ''
  const originalPost = axiosClient.post
  const originalGet = axiosClient.get

  const mockHandoverResult = {
    id: 'handover-uuid-01',
    visitId: 'visit-uuid-101',
    fromDoctorId: 'doc-001',
    fromDoctorName: 'BS. CKII Trần Văn Bình',
    toDoctorId: 'doc-002',
    toDoctorName: 'BS. Nguyễn Minh Anh',
    reason: 'Có ca mổ cấp cứu đột xuất, bàn giao tiếp tục khám',
    handedOverAt: '2026-09-21T10:00:00Z',
  }

  const mockDoctors = [
    { id: 'doc-001', fullName: 'BS. CKII Trần Văn Bình' },
    { id: 'doc-002', fullName: 'BS. Nguyễn Minh Anh' },
    { id: 'doc-003', fullName: 'BS. Lê Thị Cúc' },
  ]

  axiosClient.post = async (url, data) => {
    capturedPostUrl = url
    capturedPayload = data
    return { data: mockHandoverResult }
  }

  axiosClient.get = async (url) => {
    capturedGetUrl = url
    if (url === '/visits/handover/doctors') {
      return { data: mockDoctors }
    }
    if (url === '/visits/visit-uuid-101/handovers') {
      return { data: [mockHandoverResult] }
    }
    return { data: [] }
  }

  try {
    // 1. Kiểm tra điều kiện hợp lệ
    const visit = {
      id: 'visit-uuid-101',
      doctorId: 'doc-001',
      status: 'IN_PROGRESS',
    }
    const medicalRecord = {
      status: 'DRAFT',
    }
    const currentUser = {
      id: 'doc-001',
      roles: ['doctor'],
    }

    const check = canHandoverVisit(visit, medicalRecord, currentUser)
    assert.strictEqual(check.canHandover, true, 'Ca khám đang diễn ra và chưa ký phải cho phép bàn giao')

    // 2. Kiểm tra tính hợp lệ của dữ liệu form
    const validation = validateHandoverInput(
      'doc-002',
      'Có ca mổ cấp cứu đột xuất, bàn giao tiếp tục khám',
      'doc-001'
    )
    assert.strictEqual(validation.isValid, true)

    // 3. Gọi API bàn giao bệnh nhân
    const res = await visitApi.handoverPatient('visit-uuid-101', {
      targetDoctorId: 'doc-002',
      reason: 'Có ca mổ cấp cứu đột xuất, bàn giao tiếp tục khám',
    })

    assert.strictEqual(capturedPostUrl, '/visits/visit-uuid-101/handover')
    assert.strictEqual(capturedPayload.targetDoctorId, 'doc-002')
    assert.strictEqual(res.data.id, 'handover-uuid-01')
    assert.strictEqual(res.data.toDoctorName, 'BS. Nguyễn Minh Anh')

    // 4. Gọi API lấy danh sách bác sĩ và lịch sử bàn giao
    const docsRes = await visitApi.getHandoverDoctors()
    assert.strictEqual(capturedGetUrl, '/visits/handover/doctors')
    assert.strictEqual(docsRes.data.length, 3)

    const historyRes = await visitApi.getVisitHandovers('visit-uuid-101')
    assert.strictEqual(historyRes.data.length, 1)
  } finally {
    axiosClient.post = originalPost
    axiosClient.get = originalGet
  }
})

test('NCL-04-CN-014-TC-02: Sai trạng thái - Bệnh án đã ký số từ chối bàn giao', () => {
  const visit = {
    id: 'visit-uuid-101',
    doctorId: 'doc-001',
    status: 'IN_PROGRESS',
  }
  const currentUser = {
    id: 'doc-001',
    roles: ['doctor'],
  }

  // Bệnh án trạng thái SIGNED
  const signedCheck = canHandoverVisit(visit, { status: 'SIGNED' }, currentUser)
  assert.strictEqual(signedCheck.canHandover, false)
  assert.strictEqual(signedCheck.reasonCode, 'RECORD_ALREADY_SIGNED')
  assert.ok(signedCheck.message.includes('Bệnh án đã được ký số'))

  // Bệnh án trạng thái LOCKED
  const lockedCheck = canHandoverVisit(visit, { status: 'LOCKED' }, currentUser)
  assert.strictEqual(lockedCheck.canHandover, false)
  assert.strictEqual(lockedCheck.reasonCode, 'RECORD_ALREADY_SIGNED')

  // Bệnh án trạng thái ARCHIVED
  const archivedCheck = canHandoverVisit(visit, { status: 'ARCHIVED' }, currentUser)
  assert.strictEqual(archivedCheck.canHandover, false)
  assert.strictEqual(archivedCheck.reasonCode, 'RECORD_ALREADY_SIGNED')

  // Lượt khám đã COMPLETED
  const completedCheck = canHandoverVisit({ ...visit, status: 'COMPLETED' }, { status: 'DRAFT' }, currentUser)
  assert.strictEqual(completedCheck.canHandover, false)
  assert.strictEqual(completedCheck.reasonCode, 'VISIT_CLOSED')
})

test('NCL-04-CN-014-TC-03: Không có quyền (QTN-17) - Bác sĩ khác không phụ trách ca khám bị từ chối', () => {
  const visit = {
    id: 'visit-uuid-101',
    doctorId: 'doc-001', // Phụ trách bởi doc-001
    status: 'IN_PROGRESS',
  }
  const medicalRecord = {
    status: 'DRAFT',
  }

  // doc-999 là bác sĩ khác thử can thiệp
  const otherDoctor = {
    id: 'doc-999',
    roles: ['doctor'],
  }
  const deniedCheck = canHandoverVisit(visit, medicalRecord, otherDoctor)
  assert.strictEqual(deniedCheck.canHandover, false, 'Bác sĩ khác không được phép bàn giao ca khám')
  assert.strictEqual(deniedCheck.reasonCode, 'NOT_ASSIGNED_DOCTOR')
  assert.ok(deniedCheck.message.includes('Chỉ bác sĩ đang phụ trách'))

  // Quản trị viên (ADMIN) có quyền hỗ trợ điều phối bàn giao
  const adminUser = {
    id: 'admin-001',
    roles: ['admin'],
  }
  const adminCheck = canHandoverVisit(visit, medicalRecord, adminUser)
  assert.strictEqual(adminCheck.canHandover, true, 'Quản trị viên được phép điều phối bàn giao ca khám')
})

test('NCL-04-CN-014-TC-04: Kiểm tra tính hợp lệ dữ liệu và quy tắc bàn giao', () => {
  // Không chọn bác sĩ tiếp nhận
  const noDoctor = validateHandoverInput('', 'Có việc bận', 'doc-001')
  assert.strictEqual(noDoctor.isValid, false)
  assert.ok(noDoctor.error.includes('chọn bác sĩ tiếp nhận'))

  // Chọn chính bác sĩ đang phụ trách
  const sameDoctor = validateHandoverInput('doc-001', 'Có việc bận', 'doc-001')
  assert.strictEqual(sameDoctor.isValid, false)
  assert.ok(sameDoctor.error.includes('chính bác sĩ đang phụ trách'))

  // Lý do trống
  const emptyReason = validateHandoverInput('doc-002', '   ', 'doc-001')
  assert.strictEqual(emptyReason.isValid, false)
  assert.ok(emptyReason.error.includes('lý do bàn giao'))

  // Lý do vượt quá 500 ký tự
  const longReason = 'a'.repeat(501)
  const tooLong = validateHandoverInput('doc-002', longReason, 'doc-001')
  assert.strictEqual(tooLong.isValid, false)
  assert.ok(tooLong.error.includes('500 ký tự'))

  // Hợp lệ
  const valid = validateHandoverInput('doc-002', 'Hết ca trực chuyển giao', 'doc-001')
  assert.strictEqual(valid.isValid, true)

  // Danh mục lý do mẫu có đủ các tình huống thực tế
  assert.ok(PRESET_HANDOVER_REASONS.length >= 3, 'Phải có danh mục gợi ý lý do mẫu')

  // Định dạng ngày giờ bàn giao thuần Việt
  assert.strictEqual(formatHandoverDateTime('2026-09-21T10:30:00Z').includes('21/09/2026'), true)
  assert.strictEqual(formatHandoverDateTime(''), '---')
})

test('NCL-04-CN-014: Kiểm tra quy chuẩn Pure Vietnamese và kích thước nút bấm', () => {
  const modalCode = fs.readFileSync(
    path.join(__dirname, '../../components/clinical/HandoverPatientModal.jsx'),
    'utf-8'
  )
  const historyModalCode = fs.readFileSync(
    path.join(__dirname, '../../components/clinical/HandoverHistoryModal.jsx'),
    'utf-8'
  )
  const encounterCode = fs.readFileSync(
    path.join(__dirname, '../MedicalEncounter.jsx'),
    'utf-8'
  )

  // Pure Vietnamese checks: Không chứa các từ tiếng Anh thô trên UI
  const rawEnglishKeywords = [
    'Submit Handover',
    'Cancel Handover',
    'Transfer Doctor',
    'Handover Patient to Another Doctor',
  ]
  for (const kw of rawEnglishKeywords) {
    assert.strictEqual(
      modalCode.includes(kw),
      false,
      `HandoverPatientModal không được chứa từ tiếng Anh: "${kw}"`
    )
    assert.strictEqual(
      historyModalCode.includes(kw),
      false,
      `HandoverHistoryModal không được chứa từ tiếng Anh: "${kw}"`
    )
  }

  // Button height check: Nút thao tác trên modal phải có chiều cao tối thiểu 42-46px
  assert.ok(
    modalCode.includes('height: 46') || modalCode.includes('height: 42'),
    'Nút thao tác trên modal phải đạt chuẩn chiều cao 42-46px'
  )

  // Nút Bàn giao ca khám phải được tích hợp vào MedicalEncounter.jsx
  assert.ok(
    encounterCode.includes('Bàn giao ca khám'),
    'MedicalEncounter phải có nút Bàn giao ca khám'
  )
})

test('NCL-04-CN-014: Kiểm tra tính hợp lệ của import ESM và định dạng đuôi tệp', () => {
  const filesToCheck = [
    '../../utils/handoverValidation.js',
    '../../components/clinical/HandoverPatientModal.jsx',
    '../../components/clinical/HandoverHistoryModal.jsx',
  ]

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, relPath)
    assert.ok(fs.existsSync(fullPath), `Tệp phải tồn tại: ${relPath}`)
    const content = fs.readFileSync(fullPath, 'utf-8')

    const importRegex = /from\s+['"](\.[^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const imported = match[1]
      if (imported.endsWith('.css')) continue
      assert.ok(
        imported.endsWith('.js') || imported.endsWith('.jsx'),
        `Import "${imported}" trong ${relPath} phải có phần mở rộng tệp rõ ràng (.js hoặc .jsx)`
      )
    }
  }
})
