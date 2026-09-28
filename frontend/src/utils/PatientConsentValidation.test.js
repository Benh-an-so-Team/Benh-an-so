import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'

import {
  CONSENT_SCOPES,
  CONSENT_HISTORY_STATUS,
  calculateConsentImpact,
  validateScopeAdjustment,
  getConsentStatusMeta,
  QTN19_PLAIN_EXPLANATION,
  formatDate,
  formatDateTime,
} from './patientConsentHelpers.js'

test('TC-CS-01: validateScopeAdjustment - Bắt buộc phạm vi TREATMENT (Khám chữa bệnh) khi duy trì đồng ý', () => {
  // Đồng ý toàn bộ 3 phạm vi tiêu chuẩn
  const validAll = validateScopeAdjustment(['TREATMENT', 'COMMUNICATION', 'RESEARCH'], false)
  assert.equal(validAll.valid, true)
  assert.equal(validAll.message, '')

  // Thu hẹp: Chỉ giữ TREATMENT
  const validOnlyTreatment = validateScopeAdjustment(['TREATMENT'], false)
  assert.equal(validOnlyTreatment.valid, true)

  // Không hợp lệ: Bỏ TREATMENT nhưng cố duy trì COMMUNICATION/RESEARCH
  const invalidNoTreatment = validateScopeAdjustment(['COMMUNICATION', 'RESEARCH'], false)
  assert.equal(invalidNoTreatment.valid, false)
  assert.match(invalidNoTreatment.message, /Khám chữa bệnh và lưu trữ bệnh án.*bắt buộc/i)

  // Không hợp lệ: Mảng rỗng khi không phải rút lại toàn bộ
  const invalidEmpty = validateScopeAdjustment([], false)
  assert.equal(invalidEmpty.valid, false)
  assert.match(invalidEmpty.message, /ít nhất một phạm vi/i)

  // Hợp lệ: Rút lại toàn bộ sự đồng ý (isWithdrawingAll = true)
  const validWithdrawAll = validateScopeAdjustment([], true)
  assert.equal(validWithdrawAll.valid, true)
})

test('TC-CS-02: calculateConsentImpact - Tính toán chính xác các hoạt động sẽ dừng lại khi thu hẹp phạm vi', () => {
  const currentScopes = ['TREATMENT', 'COMMUNICATION', 'RESEARCH']

  // Thu hẹp bỏ COMMUNICATION (giữ TREATMENT và RESEARCH)
  const impactNoComm = calculateConsentImpact(currentScopes, ['TREATMENT', 'RESEARCH'], false)
  assert.equal(impactNoComm.newScopesList.length, 2)
  assert.equal(impactNoComm.removedScopesList.length, 1)
  assert.equal(impactNoComm.removedScopesList[0].key, 'COMMUNICATION')
  assert.ok(impactNoComm.stoppedActivities.some((act) => act.includes('SMS, Zalo, Email nhắc lịch')))

  // Thu hẹp bỏ RESEARCH (giữ TREATMENT và COMMUNICATION)
  const impactNoResearch = calculateConsentImpact(currentScopes, ['TREATMENT', 'COMMUNICATION'], false)
  assert.equal(impactNoResearch.removedScopesList.length, 1)
  assert.equal(impactNoResearch.removedScopesList[0].key, 'RESEARCH')
  assert.ok(impactNoResearch.stoppedActivities.some((act) => act.includes('nghiên cứu khoa học')))

  // Thu hẹp bỏ cả COMMUNICATION và RESEARCH (chỉ giữ TREATMENT)
  const impactOnlyTreatment = calculateConsentImpact(currentScopes, ['TREATMENT'], false)
  assert.equal(impactOnlyTreatment.newScopesList.length, 1)
  assert.equal(impactOnlyTreatment.newScopesList[0].key, 'TREATMENT')
  assert.equal(impactOnlyTreatment.stoppedActivities.length, 2)
})

test('TC-CS-03: calculateConsentImpact - Rút lại toàn bộ sự đồng ý hiển thị cảnh báo và dừng mọi hoạt động phi y tế', () => {
  const currentScopes = ['TREATMENT', 'COMMUNICATION', 'RESEARCH']

  const impactWithdrawAll = calculateConsentImpact(currentScopes, [], true)
  assert.equal(impactWithdrawAll.newScopesList.length, 0)
  assert.ok(impactWithdrawAll.activeScopesText[0].includes('Không có'))
  assert.ok(impactWithdrawAll.stoppedActivities.length >= 3)
  assert.match(impactWithdrawAll.legalRetentionNotice, /tối thiểu 10 năm theo Luật Khám bệnh, chữa bệnh/i)
})

test('TC-CS-04: getConsentStatusMeta - Ánh xạ đầy đủ nhãn, màu sắc cho trạng thái phiên bản', () => {
  const agreed = getConsentStatusMeta('AGREED')
  assert.equal(agreed.label, 'Đồng ý toàn bộ')
  assert.equal(agreed.tagColor, 'green')

  const partial = getConsentStatusMeta('PARTIALLY_WITHDRAWN')
  assert.equal(partial.label, 'Đã thu hẹp phạm vi')
  assert.equal(partial.tagColor, 'blue')

  const withdrawn = getConsentStatusMeta('WITHDRAWN')
  assert.equal(withdrawn.label, 'Đã rút lại toàn bộ')
  assert.equal(withdrawn.tagColor, 'red')

  const fallback = getConsentStatusMeta('UNKNOWN')
  assert.equal(fallback.label, 'UNKNOWN')
})

test('TC-CS-05: QTN19_PLAIN_EXPLANATION - Cung cấp lời giải thích pháp lý đơn giản, dễ hiểu theo luật định', () => {
  assert.ok(QTN19_PLAIN_EXPLANATION.title.includes('Luật Khám bệnh, chữa bệnh'))
  assert.match(QTN19_PLAIN_EXPLANATION.summaryForPatient, /lưu trữ bảo mật tối thiểu 10 năm/)
  assert.match(QTN19_PLAIN_EXPLANATION.summaryForPatient, /không thể xóa ngay hồ sơ bệnh án/)
  assert.match(QTN19_PLAIN_EXPLANATION.actionTakenText, /thu hồi mọi quyền đồng ý đối với các hoạt động ngoài khám chữa bệnh/)
})

test('TC-CS-06: formatDateTime và formatDate - Định dạng ngày giờ chuẩn xác', () => {
  assert.equal(formatDate('2026-09-25'), '25/09/2026')
  assert.equal(formatDateTime('2026-09-25T08:30:00Z'), dayjs('2026-09-25T08:30:00Z').format('DD/MM/YYYY HH:mm'))
  assert.equal(formatDate(null), '—')
  assert.equal(formatDateTime(undefined), '—')
})
