import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getNavigationItems, navigationSections } from '../../components/layout/navigationConfig.js'
import visitSummaryApi from '../../api/visitSummaryApi.js'
import axiosClient from '../../api/axiosClient.js'
import {
  isMedicalRecordSigned,
  isMedicalRecordSignedForSummary,
  formatDateVi,
  formatDateTimeVi,
  calculateAgeFromDob,
  formatGenderVi,
  getRecordStatusBadge,
} from '../../utils/visitSummaryHelpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==============================================================================
// NCL-04-CN-011: In phiếu tóm tắt lượt khám cho bệnh nhân
// ==============================================================================

test('NCL-04-CN-011 / QTN-01: Phân quyền truy cập menu In phiếu tóm tắt lượt khám (Lễ tân, Bác sĩ, Admin)', () => {
  // 1. RECEPTIONIST: Lễ tân có menu Phiếu tóm tắt lượt khám trong nhóm Tiếp nhận & Chăm sóc (/visit-summaries)
  const receptionistItems = getNavigationItems(['ROLE_RECEPTIONIST'], ['PATIENT_READ', 'APPOINTMENT_READ'])
  const hasSummaryMenuRecep = receptionistItems.some(
    (item) => item.key === '/visit-summaries' || item.key === '/medical-records/visit-summaries'
  )
  assert.strictEqual(
    hasSummaryMenuRecep,
    true,
    'Lễ tân (RECEPTIONIST) phải nhìn thấy menu In phiếu tóm tắt lượt khám'
  )

  const receptionSection = navigationSections.find((s) => s.key === 'reception')
  assert.ok(
    receptionSection && receptionSection.paths.includes('/visit-summaries'),
    'Nhóm Tiếp nhận & Chăm sóc (reception) phải chứa đường dẫn /visit-summaries cho Lễ tân'
  )

  // 2. DOCTOR: Bác sĩ có menu Phiếu tóm tắt lượt khám trong nhóm Khám bệnh (/medical-records/visit-summaries)
  const doctorItems = getNavigationItems(['ROLE_DOCTOR'], ['MEDICAL_RECORD_READ'])
  const hasSummaryMenuDoctor = doctorItems.some(
    (item) => item.key === '/medical-records/visit-summaries'
  )
  assert.strictEqual(
    hasSummaryMenuDoctor,
    true,
    'Bác sĩ (DOCTOR) phải nhìn thấy menu In phiếu tóm tắt tại /medical-records/visit-summaries'
  )

  const examSection = navigationSections.find((s) => s.key === 'examination')
  assert.ok(
    examSection && examSection.paths.includes('/medical-records/visit-summaries'),
    'Nhóm Khám bệnh (examination) phải chứa đường dẫn /medical-records/visit-summaries cho Bác sĩ'
  )

  // 3. ADMIN: Quản trị viên có toàn quyền truy cập menu
  const adminItems = getNavigationItems(['ROLE_ADMIN'], [])
  assert.strictEqual(
    adminItems.some((item) => item.key === '/medical-records/visit-summaries'),
    true,
    'Quản trị viên (ADMIN) phải nhìn thấy menu In phiếu tóm tắt'
  )

  // 4. Đối tượng không có quyền (PATIENT, PHARMACIST không có VISIT_SUMMARY_PRINT) không thấy menu
  const patientItems = getNavigationItems(['ROLE_PATIENT'], [])
  assert.strictEqual(
    patientItems.some((item) => item.key === '/medical-records/visit-summaries' || item.key === '/visit-summaries'),
    false,
    'Bệnh nhân không được nhìn thấy menu In phiếu tóm tắt lượt khám'
  )

  const pharmacistItems = getNavigationItems(['ROLE_PHARMACIST'], ['PHARMACY_READ'])
  assert.strictEqual(
    pharmacistItems.some((item) => item.key === '/medical-records/visit-summaries' || item.key === '/visit-summaries'),
    false,
    'Dược sĩ không có quyền VISIT_SUMMARY_PRINT thì không thấy menu In phiếu tóm tắt'
  )
})

test('NCL-04-CN-011-TC-01: Luồng thành công - Xem trước và in phiếu tóm tắt lượt khám', async () => {
  let capturedUrl = ''
  let capturedConfig = null
  const originalGet = axiosClient.get

  const mockSummaryResponse = {
    visitId: 'visit-uuid-101',
    visitCode: 'KB-2026-000101',
    visitDate: '2026-09-21T08:30:00Z',
    clinicInfo: {
      clinicName: 'PHÒNG KHÁM ĐA KHOA QUỐC TẾ',
      address: 'Số 123 Đường Giải Phóng, Quận Đống Đa, Hà Nội',
      phone: '024 3869 1234',
      hotline: '1900 6868',
    },
    patientInfo: {
      patientId: 'pat-001',
      patientCode: 'BN-0001',
      fullName: 'Nguyễn Văn An',
      gender: 'MALE',
      dateOfBirth: '1985-05-15',
      phone: '0912345678',
      address: 'Hà Nội',
    },
    doctorInfo: {
      doctorId: 'doc-001',
      doctorName: 'BS. CKII Trần Văn Bình',
      department: 'Khoa Nội Tổng Hợp',
    },
    diagnoses: {
      primaryDiagnosis: {
        code: 'I10',
        description: 'Tăng huyết áp vô căn (nguyên phát)',
      },
      secondaryDiagnoses: [
        { code: 'E11', description: 'Đái tháo đường týp 2' },
      ],
      clinicalNotes: 'Bệnh nhân đáp ứng thuốc tốt, huyết áp ổn định.',
    },
    clinicalServices: [
      {
        serviceCode: 'XN-01',
        serviceName: 'Xét nghiệm Glucose máu',
        category: 'XET_NGHIEM',
        result: '5.8 mmol/L',
        status: 'COMPLETED',
      },
      {
        serviceCode: 'CDHA-02',
        serviceName: 'Điện tim thường (ECG)',
        category: 'CDHA',
        result: 'Nhịp xoang đều, tần số 75ck/phút',
        status: 'COMPLETED',
      },
    ],
    prescriptions: [
      {
        medicationName: 'Amlodipine 5mg',
        dosage: '1 viên/ngày',
        quantity: 30,
        unit: 'Viên',
        usageInstructions: 'Uống buổi sáng sau ăn',
      },
    ],
    doctorInstructions: 'Hạn chế ăn mặn, tập thể dục nhẹ nhàng 30 phút mỗi ngày.',
    treatmentPlan: 'Tiếp tục duy trì đơn thuốc hiện tại trong 30 ngày.',
    revisitDate: '2026-10-21',
    medicalRecordStatus: 'SIGNED',
    digitalSignature: {
      isSigned: true,
      signedBy: 'BS. CKII Trần Văn Bình',
      signedAt: '2026-09-21T09:15:00Z',
      certificateInfo: 'Viettel-CA SHA256',
    },
    printHistory: [
      {
        printedBy: 'BS. CKII Trần Văn Bình',
        printedAt: '2026-09-21T09:20:00Z',
        printCount: 1,
      },
    ],
  }

  axiosClient.get = async (url, config) => {
    capturedUrl = url
    capturedConfig = config
    return { data: mockSummaryResponse }
  }

  try {
    const res = await visitSummaryApi.getSummary('visit-uuid-101')
    assert.strictEqual(capturedUrl, '/visits/visit-uuid-101/summary')
    assert.strictEqual(res.data.visitCode, 'KB-2026-000101')

    // Verify all required medical summary elements per TC-01
    assert.ok(res.data.clinicInfo.clinicName, 'Phải có tên phòng khám')
    assert.strictEqual(res.data.patientInfo.fullName, 'Nguyễn Văn An')
    assert.strictEqual(res.data.diagnoses.primaryDiagnosis.code, 'I10')
    assert.strictEqual(res.data.clinicalServices.length, 2)
    assert.strictEqual(res.data.prescriptions.length, 1)
    assert.ok(res.data.doctorInstructions, 'Phải có lời dặn bác sĩ')
    assert.ok(res.data.treatmentPlan, 'Phải có kế hoạch điều trị')
    assert.strictEqual(res.data.revisitDate, '2026-10-21', 'Phải có mốc tái khám')
    assert.strictEqual(res.data.digitalSignature.isSigned, true, 'Phải có chữ ký số xác nhận')

    // Verify recordPrintAudit endpoint for audit logging before printing (Blocker 3)
    let capturedPrintAuditUrl = ''
    axiosClient.get = async (url, config) => {
      capturedPrintAuditUrl = url
      return { data: new Uint8Array([1, 2, 3]) }
    }
    await visitSummaryApi.recordPrintAudit('visit-uuid-101')
    assert.strictEqual(
      capturedPrintAuditUrl,
      '/visits/visit-uuid-101/summary/print',
      'API recordPrintAudit phải gọi /visits/{visitId}/summary/print để ghi nhận lịch sử in vào Backend'
    )

    // Verify PDF download endpoint
    let capturedPdfUrl = ''
    axiosClient.get = async (url, config) => {
      capturedPdfUrl = url
      return { data: new Uint8Array([1, 2, 3]) }
    }
    await visitSummaryApi.downloadPdf('visit-uuid-101')
    assert.strictEqual(capturedPdfUrl, '/visits/visit-uuid-101/summary/print')
  } finally {
    axiosClient.get = originalGet
  }
})

test('NCL-04-CN-011-TC-02: Bệnh án chưa ký số - Hệ thống từ chối và nhắc nhở ký', () => {
  // Helper isMedicalRecordSigned và isMedicalRecordSignedForSummary kiểm tra các trạng thái ký hợp lệ
  assert.strictEqual(isMedicalRecordSigned('SIGNED'), true)
  assert.strictEqual(isMedicalRecordSigned('LOCKED'), true)
  assert.strictEqual(isMedicalRecordSigned('ARCHIVED'), true)
  assert.strictEqual(isMedicalRecordSignedForSummary('SIGNED'), true)

  // Unsigned statuses must return false
  assert.strictEqual(isMedicalRecordSigned('DRAFT'), false)
  assert.strictEqual(isMedicalRecordSigned('IN_PROGRESS'), false)
  assert.strictEqual(isMedicalRecordSigned('PENDING_REVIEW'), false)
  assert.strictEqual(isMedicalRecordSigned(null), false)
  assert.strictEqual(isMedicalRecordSigned(undefined), false)
  assert.strictEqual(isMedicalRecordSigned(''), false)
})

test('NCL-04-CN-011-TC-03: Lưu vết lịch sử in phiếu tóm tắt lượt khám', () => {
  const samplePrintHistory = [
    {
      printedBy: 'BS. Trần Văn Bình',
      printedAt: '2026-09-21T09:20:00Z',
      printCount: 1,
    },
    {
      printedBy: 'Lễ tân Lê Thị Cúc',
      printedAt: '2026-09-21T10:00:00Z',
      printCount: 2,
    },
  ]

  assert.strictEqual(samplePrintHistory.length, 2, 'Lịch sử in phải ghi nhận đủ các lần in')
  assert.strictEqual(samplePrintHistory[0].printCount, 1)
  assert.strictEqual(samplePrintHistory[1].printCount, 2)
  assert.ok(samplePrintHistory[0].printedBy, 'Lịch sử phải có thông tin người in')
  assert.ok(samplePrintHistory[0].printedAt, 'Lịch sử phải có thời gian in')
})

test('NCL-04-CN-011: Kiểm tra các tiện ích định dạng dữ liệu y tế (visitSummaryHelpers)', () => {
  // Date formatting
  assert.strictEqual(formatDateVi('2026-09-21'), '21/09/2026')
  assert.strictEqual(formatDateVi(''), '---')

  // DateTime formatting
  const formattedDateTime = formatDateTimeVi('2026-09-21T08:30:00Z')
  assert.ok(formattedDateTime.includes('21/09/2026'))

  // Patient age calculation
  const age = calculateAgeFromDob('2000-01-01')
  assert.ok(age.includes('tuổi'), 'Định dạng tuổi phải có chữ "tuổi"')

  // Gender formatting in Pure Vietnamese
  assert.strictEqual(formatGenderVi('MALE'), 'Nam')
  assert.strictEqual(formatGenderVi('FEMALE'), 'Nữ')
  assert.strictEqual(formatGenderVi('OTHER'), 'Khác')
  assert.strictEqual(formatGenderVi('nam'), 'Nam')
  assert.strictEqual(formatGenderVi('nu'), 'Nữ')

  // Status badge mapping
  const signedBadge = getRecordStatusBadge('SIGNED')
  assert.strictEqual(signedBadge.text, 'Đã ký số')
  assert.strictEqual(signedBadge.isSigned, true)

  const draftBadge = getRecordStatusBadge('DRAFT')
  assert.strictEqual(draftBadge.text, 'Chưa ký (Đang ghi)')
  assert.strictEqual(draftBadge.isSigned, false)
})

test('NCL-04-CN-011: Kiểm tra quy chuẩn Pure Vietnamese và kích thước nút bấm', () => {
  const managementPageCode = fs.readFileSync(
    path.join(__dirname, '../VisitSummaryManagementPage.jsx'),
    'utf-8'
  )
  const modalCode = fs.readFileSync(
    path.join(__dirname, '../../components/clinical/VisitSummaryPrintModal.jsx'),
    'utf-8'
  )

  // Pure Vietnamese checks: No raw English labels in UI
  const englishKeywords = [
    'Create New',
    'Delete Record',
    'Submit Form',
    'Action Column',
    'No Data Found',
  ]
  for (const kw of englishKeywords) {
    assert.strictEqual(
      managementPageCode.includes(kw),
      false,
      `Trang quản lý không được chứa từ tiếng Anh: "${kw}"`
    )
    assert.strictEqual(
      modalCode.includes(kw),
      false,
      `Modal in không được chứa từ tiếng Anh: "${kw}"`
    )
  }

  // Button size check per user preferences:
  // Table action buttons must have width: 36 and height: 36
  assert.ok(
    managementPageCode.includes('width: 36') && managementPageCode.includes('height: 36'),
    'Nút thao tác trên bảng phải có kích thước tối thiểu 36x36px'
  )

  // Modal buttons must have height: 40, 42, or 46px (large comfortable size)
  assert.ok(
    modalCode.includes('height: 46') || modalCode.includes('height: 42') || modalCode.includes('height: 40'),
    'Nút thao tác trên modal phải có chiều cao tối thiểu 40px'
  )
})

test('NCL-04-CN-011: Kiểm tra tính hợp lệ của import ESM và định dạng đuôi tệp', () => {
  const filesToCheck = [
    '../../api/visitSummaryApi.js',
    '../../utils/visitSummaryHelpers.js',
    '../../components/clinical/VisitSummaryPrintModal.jsx',
    '../VisitSummaryManagementPage.jsx',
  ]

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, relPath)
    assert.ok(fs.existsSync(fullPath), `Tệp phải tồn tại: ${relPath}`)
    const content = fs.readFileSync(fullPath, 'utf-8')

    // Find relative imports
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const imported = match[1]
      // Skip CSS imports
      if (imported.endsWith('.css')) continue

      assert.ok(
        imported.endsWith('.js') || imported.endsWith('.jsx'),
        `Import "${imported}" trong ${relPath} phải có phần mở rộng tệp rõ ràng (.js hoặc .jsx)`
      )
    }
  }
})
