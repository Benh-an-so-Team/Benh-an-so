import assert from 'node:assert/strict'
import test from 'node:test'
import contraindicationApi from '../../api/contraindicationApi.js'
import axiosClient from '../../api/axiosClient.js'
import {
  areAllContraindicationsHandled,
  CONTRAINDICATION_SEVERITY_META,
  CONTRAINDICATION_TYPE_META,
  getUnhandledContraindications,
  isContraindicationHandled,
  PRESET_CONTRAINDICATION_OVERRIDE_REASONS,
  sanitizeContraindicationOverrides,
  validateContraindicationOverrideReason,
} from '../../utils/contraindicationValidation.js'

// ============================================================================
// TC-01: GỌI ĐÚNG API CONTRACT THEO ĐẶC TẢ BACKEND
// ============================================================================
test('TC-01.1: contraindicationApi.checkContraindications gửi đúng payload và endpoint', async () => {
  const calls = []
  const originalPost = axiosClient.post
  axiosClient.post = async (...args) => {
    calls.push(['post', ...args])
    return {
      data: {
        warnings: [
          {
            ruleId: 'rule-01',
            medicineId: 'med-01',
            medicineName: 'Aspirin 500mg',
            type: 'AGE',
            severity: 'CONTRAINDICATED',
            message: 'Chống chỉ định cho trẻ em dưới 16 tuổi do nguy cơ hội chứng Reye.',
            recommendation: 'Thay thế bằng Paracetamol.',
          },
        ],
        missingData: [],
      },
    }
  }

  try {
    const res = await contraindicationApi.checkContraindications('rec-uuid-001', ['med-01', 'med-02'])
    assert.equal(res.data.warnings.length, 1)
    assert.deepEqual(calls, [
      [
        'post',
        '/prescriptions/check-contraindications',
        { medicalRecordId: 'rec-uuid-001', medicineIds: ['med-01', 'med-02'] },
      ],
    ])
  } finally {
    axiosClient.post = originalPost
  }
})

test('TC-01.2: contraindicationApi các endpoint phụ trợ (pregnancy, chronic diseases) gọi đúng REST method', async () => {
  const calls = []
  const originals = {
    patch: axiosClient.patch,
    get: axiosClient.get,
    post: axiosClient.post,
    delete: axiosClient.delete,
  }

  axiosClient.patch = async (...args) => { calls.push(['patch', ...args]); return { data: {} } }
  axiosClient.get = async (...args) => { calls.push(['get', ...args]); return { data: [] } }
  axiosClient.post = async (...args) => { calls.push(['post', ...args]); return { data: {} } }
  axiosClient.delete = async (...args) => { calls.push(['delete', ...args]); return { data: {} } }

  try {
    await contraindicationApi.updatePregnancyStatus('pat-001', 'PREGNANT')
    await contraindicationApi.getChronicDiseases('pat-001')
    await contraindicationApi.addChronicDisease('pat-001', { diagnosisCatalogId: 'diag-001', diagnosedYear: 2020 })
    await contraindicationApi.deleteChronicDisease('chr-001')

    assert.deepEqual(calls, [
      ['patch', '/patients/pat-001/pregnancy-status', { pregnancyStatus: 'PREGNANT' }],
      ['get', '/patients/pat-001/chronic-diseases'],
      ['post', '/patients/pat-001/chronic-diseases', { diagnosisCatalogId: 'diag-001', diagnosedYear: 2020 }],
      ['delete', '/patients/chronic-diseases/chr-001'],
    ])
  } finally {
    Object.assign(axiosClient, originals)
  }
})

// ============================================================================
// TC-02: THỨ TỰ SEVERITY & MÀU SẮC PHÂN CẤP CHUẨN XÁC
// ============================================================================
test('TC-02.1: Thứ tự độ nghiêm trọng từ CONTRAINDICATED -> SEVERE -> MODERATE -> LOW', () => {
  assert.equal(CONTRAINDICATION_SEVERITY_META.CONTRAINDICATED.rank, 4)
  assert.equal(CONTRAINDICATION_SEVERITY_META.SEVERE.rank, 3)
  assert.equal(CONTRAINDICATION_SEVERITY_META.MODERATE.rank, 2)
  assert.equal(CONTRAINDICATION_SEVERITY_META.LOW.rank, 1)

  assert.equal(CONTRAINDICATION_SEVERITY_META.CONTRAINDICATED.label, 'Chống chỉ định tuyệt đối')
  assert.equal(CONTRAINDICATION_SEVERITY_META.CONTRAINDICATED.tagColor, '#7f1d1d')
})

test('TC-02.2: Danh sách warnings từ Backend giữ nguyên thứ tự sắp xếp và phân loại đúng type', () => {
  const serverWarnings = [
    { ruleId: 'r1', medicineId: 'm1', severity: 'CONTRAINDICATED', type: 'AGE' },
    { ruleId: 'r2', medicineId: 'm2', severity: 'SEVERE', type: 'PREGNANCY' },
    { ruleId: 'r3', medicineId: 'm3', severity: 'MODERATE', type: 'DISEASE' },
    { ruleId: 'r4', medicineId: 'm4', severity: 'LOW', type: 'AGE' },
  ]

  // Đảm bảo không bị xáo trộn thứ tự
  assert.equal(serverWarnings[0].severity, 'CONTRAINDICATED')
  assert.equal(serverWarnings[1].severity, 'SEVERE')
  assert.equal(serverWarnings[2].severity, 'MODERATE')
  assert.equal(serverWarnings[3].severity, 'LOW')

  assert.equal(CONTRAINDICATION_TYPE_META.AGE.label, 'Độ tuổi')
  assert.equal(CONTRAINDICATION_TYPE_META.PREGNANCY.label, 'Thai kỳ')
  assert.equal(CONTRAINDICATION_TYPE_META.DISEASE.label, 'Bệnh nền / Bệnh mạn tính')
})

// ============================================================================
// TC-03: VALIDATION LÝ DO BỎ QUA CẢNH BÁO (OVERRIDE REASON)
// ============================================================================
test('TC-03.1: Từ chối lý do rỗng, chỉ có khoảng trắng, hoặc quá ngắn dưới 5 ký tự', () => {
  assert.equal(validateContraindicationOverrideReason('').valid, false)
  assert.equal(validateContraindicationOverrideReason('   ').valid, false)
  assert.equal(validateContraindicationOverrideReason(null).valid, false)
  assert.equal(validateContraindicationOverrideReason('ok').valid, false, 'Quá ngắn dưới 5 ký tự phải bị từ chối')

  const validRes = validateContraindicationOverrideReason('   Đã hội chẩn chuyên môn   ')
  assert.equal(validRes.valid, true)
  assert.equal(validRes.trimmedReason, 'Đã hội chẩn chuyên môn')
})

test('TC-03.2: Kiểm tra trạng thái đã xử lý (handled) của từng cảnh báo và toàn bộ danh sách', () => {
  const warningA = { ruleId: 'rule-A', medicineId: 'med-1' }
  const warningB = { ruleId: 'rule-B', medicineId: 'med-2' }
  const allWarnings = [warningA, warningB]

  // Chưa có override nào
  assert.equal(isContraindicationHandled(warningA, []), false)
  assert.equal(areAllContraindicationsHandled(allWarnings, []), false)
  assert.equal(getUnhandledContraindications(allWarnings, []).length, 2)

  // Mới xử lý 1 warning
  const partialOverrides = [
    { ruleId: 'rule-A', medicineId: 'med-1', overrideReason: 'Lý do chuyên môn hợp lệ A' },
  ]
  assert.equal(isContraindicationHandled(warningA, partialOverrides), true)
  assert.equal(isContraindicationHandled(warningB, partialOverrides), false)
  assert.equal(areAllContraindicationsHandled(allWarnings, partialOverrides), false)
  assert.equal(getUnhandledContraindications(allWarnings, partialOverrides).length, 1)

  // Đã xử lý đầy đủ
  const fullOverrides = [
    { ruleId: 'rule-A', medicineId: 'med-1', overrideReason: 'Lý do chuyên môn hợp lệ A' },
    { ruleId: 'rule-B', medicineId: 'med-2', overrideReason: 'Lý do chuyên môn hợp lệ B' },
  ]
  assert.equal(areAllContraindicationsHandled(allWarnings, fullOverrides), true)
  assert.equal(getUnhandledContraindications(allWarnings, fullOverrides).length, 0)
})

// ============================================================================
// TC-04: XÂY DỰNG VÀ CHUẨN HÓA MẢNG CONTRAINDICATION_OVERRIDES GỬI ĐẾN POST /prescriptions
// ============================================================================
test('TC-04: sanitizeContraindicationOverrides lọc bỏ các override không hợp lệ và chuẩn hóa dữ liệu', () => {
  const rawOverrides = [
    { ruleId: 'r1', medicineId: 'm1', overrideReason: '  Lý do hợp lệ 1  ' },
    { ruleId: null, medicineId: 'm2', overrideReason: 'Thiếu rule' },
    { ruleId: 'r3', medicineId: null, overrideReason: 'Thiếu medicine' },
    { ruleId: 'r4', medicineId: 'm4', overrideReason: '   ' }, // Toàn khoảng trắng
    null,
  ]

  const clean = sanitizeContraindicationOverrides(rawOverrides)

  assert.equal(clean.length, 1)
  assert.deepEqual(clean[0], {
    ruleId: 'r1',
    medicineId: 'm1',
    overrideReason: 'Lý do hợp lệ 1',
  })
})

// ============================================================================
// TC-05: CÁC LÝ DO MẪU LÂM SÀNG CÓ SẴN (PRESETS)
// ============================================================================
test('TC-05: PRESET_CONTRAINDICATION_OVERRIDE_REASONS chứa các lý do chuyên môn chuẩn', () => {
  assert.ok(PRESET_CONTRAINDICATION_OVERRIDE_REASONS.length >= 3)
  PRESET_CONTRAINDICATION_OVERRIDE_REASONS.forEach((reason) => {
    assert.equal(validateContraindicationOverrideReason(reason).valid, true)
  })
})
