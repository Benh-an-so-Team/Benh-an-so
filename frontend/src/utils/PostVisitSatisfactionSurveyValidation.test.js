import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dayjs from 'dayjs'

import {
  SCORE_LABELS,
  SCORE_COLORS,
  LOW_SCORE_THRESHOLD,
  DATE_PRESETS,
  getDateRangeFromPreset,
  validateSurveySubmission,
  checkVisitSurveyEligibility,
  calculateSatisfactionKpis,
  sortAndFilterDoctorSummaries,
  filterCommentsByScore,
  getAnonymizedPatientLabel,
} from './satisfactionSurveyHelpers.js'
import satisfactionSurveyApi from '../api/satisfactionSurveyApi.js'
import { getNavigationItems, navigationSections } from '../components/layout/navigationConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('TC01: satisfactionSurveyApi - verifies method contracts', () => {
  assert.equal(typeof satisfactionSurveyApi.submitSurvey, 'function')
  assert.equal(typeof satisfactionSurveyApi.updateSurvey, 'function')
  assert.equal(typeof satisfactionSurveyApi.getByVisitId, 'function')
  assert.equal(typeof satisfactionSurveyApi.getById, 'function')
  assert.equal(typeof satisfactionSurveyApi.getSatisfactionReport, 'function')
})

test('TC02: validateSurveySubmission - score and comment constraints', () => {
  // Valid scores (1 to 5)
  for (let s = 1; s <= 5; s++) {
    const res = validateSurveySubmission(s, 'Dịch vụ rất tốt')
    assert.equal(res.isValid, true, `Score ${s} should be valid`)
  }

  // Optional comment (empty or null is valid)
  assert.equal(validateSurveySubmission(5, '').isValid, true)
  assert.equal(validateSurveySubmission(4, undefined).isValid, true)

  // Invalid scores (0, 6, floats, strings, negative)
  assert.equal(validateSurveySubmission(0).isValid, false)
  assert.equal(validateSurveySubmission(6).isValid, false)
  assert.equal(validateSurveySubmission(-1).isValid, false)
  assert.equal(validateSurveySubmission(3.5).isValid, false)
  assert.equal(validateSurveySubmission('5').isValid, false)
  assert.equal(validateSurveySubmission(null).isValid, false)

  // Comment length constraint (max 1000 chars)
  const valid1000 = 'A'.repeat(1000)
  assert.equal(validateSurveySubmission(5, valid1000).isValid, true)

  const invalid1001 = 'A'.repeat(1001)
  const overLengthRes = validateSurveySubmission(5, invalid1001)
  assert.equal(overLengthRes.isValid, false)
  assert.match(overLengthRes.error, /1000 ký tự/)
})

test('TC03: checkVisitSurveyEligibility - role, status, financial balance', () => {
  const patientUser = { id: 'user-p1', patientId: 'patient-100', roles: ['ROLE_PATIENT'] }
  const doctorUser = { id: 'user-d1', roles: ['ROLE_DOCTOR'] }

  // 1. Eligible visit: Patient + COMPLETED + PAID
  const eligibleVisit = {
    id: 'visit-1',
    patientId: 'patient-100',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    isPaid: true,
  }
  assert.equal(checkVisitSurveyEligibility(eligibleVisit, patientUser).canSurvey, true)

  // 2. Non-patient rejected
  const doctorRes = checkVisitSurveyEligibility(eligibleVisit, doctorUser)
  assert.equal(doctorRes.canSurvey, false)
  assert.match(doctorRes.reason, /Chỉ bệnh nhân/)

  // 3. Incomplete visit rejected
  const inProgressVisit = { ...eligibleVisit, status: 'IN_PROGRESS' }
  const inProgRes = checkVisitSurveyEligibility(inProgressVisit, patientUser)
  assert.equal(inProgRes.canSurvey, false)
  assert.match(inProgRes.reason, /chưa hoàn tất/)

  // 4. Financial unpaid visit rejected
  const unpaidVisit = { ...eligibleVisit, paymentStatus: 'PENDING', isPaid: false, totalAmount: 150000 }
  const unpaidRes = checkVisitSurveyEligibility(unpaidVisit, patientUser)
  assert.equal(unpaidRes.canSurvey, false)
  assert.match(unpaidRes.reason, /chưa hoàn tất thu phí/)

  // 5. Free-of-charge visit completed is eligible
  const freeVisit = { ...eligibleVisit, paymentStatus: 'UNPAID', totalAmount: 0, isFreeOfCharge: true }
  assert.equal(checkVisitSurveyEligibility(freeVisit, patientUser).canSurvey, true)
})

test('TC04: calculateSatisfactionKpis - metrics, low-score alerts, satisfaction rate, quality tiers', () => {
  // Empty data
  const emptyKpis = calculateSatisfactionKpis({})
  assert.equal(emptyKpis.totalSurveys, 0)
  assert.equal(emptyKpis.averageScore, 0)
  assert.equal(emptyKpis.lowScoreCount, 0)
  assert.equal(emptyKpis.satisfactionRate, 0)
  assert.equal(emptyKpis.qualityTier, 'CHƯA CÓ ĐÁNH GIÁ')

  // Sample report: 100 surveys total
  // 1 star: 5, 2 star: 5, 3 star: 10 (Total low-score <= 3: 20)
  // 4 star: 30, 5 star: 50 (Total high-quality: 80 -> 80% satisfaction rate)
  const reportData = {
    totalSurveys: 100,
    averageScore: 4.15,
    scoreDistribution: {
      1: 5,
      2: 5,
      3: 10,
      4: 30,
      5: 50,
    },
  }
  const kpis = calculateSatisfactionKpis(reportData)
  assert.equal(kpis.totalSurveys, 100)
  assert.equal(kpis.averageScore, 4.15)
  assert.equal(kpis.lowScoreCount, 20) // 5 + 5 + 10
  assert.equal(kpis.highQualityCount, 80) // 30 + 50
  assert.equal(kpis.satisfactionRate, 80.0)
  assert.equal(kpis.qualityTier, 'TỐT')
  assert.equal(kpis.qualityTone, 'processing')

  // Tier checks
  assert.equal(calculateSatisfactionKpis({ totalSurveys: 10, averageScore: 4.8 }).qualityTier, 'XUẤT SẮC')
  assert.equal(calculateSatisfactionKpis({ totalSurveys: 10, averageScore: 3.5 }).qualityTier, 'TRUNG BÌNH')
  assert.equal(calculateSatisfactionKpis({ totalSurveys: 10, averageScore: 2.4 }).qualityTier, 'CẦN CẢI THIỆN GẤP')
})

test('TC05: sortAndFilterDoctorSummaries - doctor ranking & 0-review handling', () => {
  const doctors = [
    { doctorId: 'doc-1', doctorName: 'BS. Nguyễn Văn A', totalSurveys: 25, averageScore: 4.8 },
    { doctorId: 'doc-2', doctorName: 'BS. Trần Thị B', totalSurveys: 0, averageScore: 0.0 }, // Chưa có đánh giá
    { doctorId: 'doc-3', doctorName: 'BS. Lê Văn C', totalSurveys: 15, averageScore: 3.9 },
  ]

  // Sort desc by averageScore: Doc-1 (4.8) -> Doc-3 (3.9) -> Doc-2 (0 reviews at the bottom, not treated as poor 0.0 rating)
  const sortedDesc = sortAndFilterDoctorSummaries(doctors, 'averageScore', 'desc')
  assert.equal(sortedDesc[0].doctorId, 'doc-1')
  assert.equal(sortedDesc[1].doctorId, 'doc-3')
  assert.equal(sortedDesc[2].doctorId, 'doc-2')

  // Sort asc by averageScore: Doc-3 (3.9) -> Doc-1 (4.8) -> Doc-2 (0 reviews still at end)
  const sortedAsc = sortAndFilterDoctorSummaries(doctors, 'averageScore', 'asc')
  assert.equal(sortedAsc[0].doctorId, 'doc-3')
  assert.equal(sortedAsc[1].doctorId, 'doc-1')
  assert.equal(sortedAsc[2].doctorId, 'doc-2')
})

test('TC06: filterCommentsByScore & getAnonymizedPatientLabel - anonymity and alert filters', () => {
  // Anonymization label
  assert.equal(getAnonymizedPatientLabel(), 'Bệnh nhân ẩn danh')

  const comments = [
    { id: 1, score: 5, comment: 'Bác sĩ rất nhiệt tình' },
    { id: 2, score: 4, comment: 'Dịch vụ ổn' },
    { id: 3, score: 3, comment: 'Chờ đợi hơi lâu' },
    { id: 4, score: 2, comment: 'Bác sĩ vội vã' },
    { id: 5, score: 1, comment: 'Rất không hài lòng' },
  ]

  // Filter ALL
  assert.equal(filterCommentsByScore(comments, 'ALL').length, 5)

  // Filter LOW (<= 3 stars)
  const lowComments = filterCommentsByScore(comments, 'LOW')
  assert.equal(lowComments.length, 3)
  assert.deepEqual(lowComments.map((c) => c.score), [3, 2, 1])

  // Filter VERY_LOW (<= 2 stars)
  const veryLow = filterCommentsByScore(comments, 'VERY_LOW')
  assert.equal(veryLow.length, 2)
  assert.deepEqual(veryLow.map((c) => c.score), [2, 1])

  // Filter POSITIVE (>= 4 stars)
  const positive = filterCommentsByScore(comments, 'POSITIVE')
  assert.equal(positive.length, 2)
  assert.deepEqual(positive.map((c) => c.score), [5, 4])

  // Specific score '1'
  assert.equal(filterCommentsByScore(comments, '1').length, 1)
})

test('TC07: getDateRangeFromPreset - range calculations', () => {
  const presets = [
    DATE_PRESETS.TODAY,
    DATE_PRESETS.SEVEN_DAYS,
    DATE_PRESETS.THIRTY_DAYS,
    DATE_PRESETS.THIS_MONTH,
    DATE_PRESETS.LAST_MONTH,
  ]

  presets.forEach((preset) => {
    const [from, to] = getDateRangeFromPreset(preset)
    assert.equal(dayjs.isDayjs(from), true, `${preset} from must be a dayjs object`)
    assert.equal(dayjs.isDayjs(to), true, `${preset} to must be a dayjs object`)
    assert.equal(from.isBefore(to) || from.isSame(to), true, `${preset} from <= to`)
  })
})

test('TC08: navigationConfig - role-based access for /reports/satisfaction', () => {
  // Manager has access
  const managerItems = getNavigationItems(['manager'], [])
  const hasManager = managerItems.some((item) => item.key === '/reports/satisfaction')
  assert.equal(hasManager, true, 'Manager should have access to /reports/satisfaction')

  // Admin has access
  const adminItems = getNavigationItems(['admin'], [])
  const hasAdmin = adminItems.some((item) => item.key === '/reports/satisfaction')
  assert.equal(hasAdmin, true, 'Admin should have access to /reports/satisfaction')

  // User with REPORT_VIEW permission has access
  const permItems = getNavigationItems([], ['REPORT_VIEW'])
  const hasPerm = permItems.some((item) => item.key === '/reports/satisfaction')
  assert.equal(hasPerm, true, 'User with REPORT_VIEW permission should have access')

  // Pure Doctor should NOT see /reports/satisfaction
  const doctorItems = getNavigationItems(['doctor'], [])
  const hasDoctor = doctorItems.some((item) => item.key === '/reports/satisfaction')
  assert.equal(hasDoctor, false, 'Doctor should not have access to satisfaction report')

  // Pure Receptionist should NOT see /reports/satisfaction
  const receptionistItems = getNavigationItems(['receptionist'], [])
  const hasReceptionist = receptionistItems.some((item) => item.key === '/reports/satisfaction')
  assert.equal(hasReceptionist, false, 'Receptionist should not have access')

  // Section paths include /reports/satisfaction
  const reportsSection = navigationSections.find((s) => s.key === 'reports')
  assert.equal(reportsSection.paths.includes('/reports/satisfaction'), true)
})

test('TC09: UI source contracts - verification of key components', () => {
  const modalPath = path.resolve(__dirname, '../components/portal/SatisfactionSurveyModal.jsx')
  const reportPath = path.resolve(__dirname, '../pages/SatisfactionReportPage.jsx')
  const historyPath = path.resolve(__dirname, '../pages/PatientMedicalHistoryPage.jsx')
  const appRoutesPath = path.resolve(__dirname, '../routes/AppRoutes.jsx')

  assert.equal(fs.existsSync(modalPath), true, 'SatisfactionSurveyModal.jsx must exist')
  assert.equal(fs.existsSync(reportPath), true, 'SatisfactionReportPage.jsx must exist')
  assert.equal(fs.existsSync(historyPath), true, 'PatientMedicalHistoryPage.jsx must exist')
  assert.equal(fs.existsSync(appRoutesPath), true, 'AppRoutes.jsx must exist')

  const modalSource = fs.readFileSync(modalPath, 'utf8')
  assert.match(modalSource, /survey-quick-numbers/, 'Modal should contain quick touch number buttons for mobile')
  assert.match(modalSource, /Rate/, 'Modal should render Ant Design Rate component')
  assert.match(modalSource, /isEditing/, 'Modal should support editing existing survey')
  assert.match(modalSource, /1000/, 'Modal should limit comment to 1000 chars')

  const reportSource = fs.readFileSync(reportPath, 'utf8')
  assert.match(reportSource, /satisfaction-kpi-grid/, 'Report page should display KPI cards grid')
  assert.match(reportSource, /getAnonymizedPatientLabel|Bệnh nhân ẩn danh/, 'Report page must anonymize patient names')
  assert.match(reportSource, /sortAndFilterDoctorSummaries/, 'Report page must sort doctors by score/surveys')
  assert.match(reportSource, /filterCommentsByScore/, 'Report page must filter comments by score to spot issues early')

  const historySource = fs.readFileSync(historyPath, 'utf8')
  assert.match(historySource, /SatisfactionSurveyModal/, 'PatientMedicalHistoryPage should include SatisfactionSurveyModal')
  assert.match(historySource, /surveyMap/, 'PatientMedicalHistoryPage should maintain survey state map')
  assert.match(historySource, /Đã đánh giá — Sửa|Đánh giá lượt khám này/, 'PatientMedicalHistoryPage should render prompt tags')

  const routesSource = fs.readFileSync(appRoutesPath, 'utf8')
  assert.match(routesSource, /reports\/satisfaction/, 'AppRoutes must route /reports/satisfaction')
})
