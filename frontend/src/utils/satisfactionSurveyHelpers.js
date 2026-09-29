/**
 * Helpers & Specifications for Post-Visit Satisfaction Survey (NCL-10-CN-005).
 * Khảo sát hài lòng sau khám trên Cổng bệnh nhân & Báo cáo quản lý phòng khám.
 */
import dayjs from 'dayjs'

export const SCORE_LABELS = {
  5: 'Rất hài lòng',
  4: 'Hài lòng',
  3: 'Bình thường',
  2: 'Chưa hài lòng',
  1: 'Rất không hài lòng',
}

export const SCORE_COLORS = {
  5: '#16a34a', // Xanh lá đậm
  4: '#22c55e', // Xanh lá
  3: '#eab308', // Vàng
  2: '#f97316', // Cam
  1: '#dc2626', // Đỏ
}

export const LOW_SCORE_THRESHOLD = 3 // Điểm <= 3 được xếp vào diện cần chú ý / phản ánh tiêu cực

export const DATE_PRESETS = {
  TODAY: 'TODAY',
  SEVEN_DAYS: '7DAYS',
  THIRTY_DAYS: '30DAYS',
  THIS_MONTH: 'THIS_MONTH',
  LAST_MONTH: 'LAST_MONTH',
}

/**
 * Tính toán khoảng ngày theo Preset
 * @param {string} preset
 * @returns {[dayjs.Dayjs, dayjs.Dayjs]}
 */
export const getDateRangeFromPreset = (preset) => {
  const now = dayjs()
  switch (preset) {
    case DATE_PRESETS.TODAY:
      return [now.startOf('day'), now.endOf('day')]
    case DATE_PRESETS.SEVEN_DAYS:
      return [now.subtract(6, 'day').startOf('day'), now.endOf('day')]
    case DATE_PRESETS.THIRTY_DAYS:
      return [now.subtract(29, 'day').startOf('day'), now.endOf('day')]
    case DATE_PRESETS.LAST_MONTH: {
      const prevMonth = now.subtract(1, 'month')
      return [prevMonth.startOf('month'), prevMonth.endOf('month')]
    }
    case DATE_PRESETS.THIS_MONTH:
    default:
      return [now.startOf('month'), now.endOf('day')]
  }
}

/**
 * Validate dữ liệu form gửi khảo sát
 * @param {number} score Thang điểm 1-5
 * @param {string} comment Nhận xét tự do
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validateSurveySubmission = (score, comment = '') => {
  if (!score || typeof score !== 'number' || score < 1 || score > 5 || !Number.isInteger(score)) {
    return {
      isValid: false,
      error: 'Vui lòng chọn mức độ hài lòng từ 1 đến 5 sao.',
    }
  }

  if (comment && typeof comment === 'string' && comment.length > 1000) {
    return {
      isValid: false,
      error: 'Nội dung nhận xét không được vượt quá 1000 ký tự.',
    }
  }

  return { isValid: true }
}

/**
 * Kiểm tra xem một lượt khám có đủ điều kiện để bệnh nhân đánh giá hay không
 * Điều kiện:
 * 1. Thuộc về chính bệnh nhân đang đăng nhập
 * 2. Lượt khám đã hoàn tất (COMPLETED)
 * 3. Đã thanh toán xong (PAID hoặc isPaid = true)
 * @param {Object} visit Lượt khám hoặc appointment
 * @param {Object} currentUser Người dùng đang đăng nhập
 * @returns {{ canSurvey: boolean, reason?: string }}
 */
export const checkVisitSurveyEligibility = (visit, currentUser) => {
  if (!visit) {
    return { canSurvey: false, reason: 'Không tìm thấy thông tin lượt khám.' }
  }

  // 1. Kiểm tra vai trò Bệnh nhân
  const roles = (currentUser?.roles || [currentUser?.role || ''])
    .map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  const isPatient = roles.includes('patient')

  if (!isPatient) {
    return {
      canSurvey: false,
      reason: 'Chỉ bệnh nhân mới có quyền gửi khảo sát đánh giá chất lượng phục vụ.',
    }
  }

  // 2. Kiểm tra tính sở hữu (thuộc bệnh nhân đăng nhập hoặc hồ sơ liên kết chính chủ)
  const currentPatientId = String(currentUser?.patientId || currentUser?.id || '')
  const visitPatientId = String(visit?.patientId || visit?.patient?.id || '')
  if (visitPatientId && currentPatientId && visitPatientId !== currentPatientId) {
    // Nếu là hồ sơ người thân, chỉ xem theo dõi hoặc phải là người giám hộ chính thức
    if (visit.isDependent && !currentUser.isGuardian) {
      return {
        canSurvey: false,
        reason: 'Bạn không có quyền đánh giá lượt khám của hồ sơ này.',
      }
    }
  }

  // 3. Kiểm tra trạng thái lượt khám: Phải hoàn tất (COMPLETED)
  const status = String(visit.status || '').toUpperCase()
  if (status !== 'COMPLETED') {
    return {
      canSurvey: false,
      reason: 'Lượt khám chưa hoàn tất khám bệnh.',
    }
  }

  // 4. Kiểm tra tài chính: Phải đã thu phí xong
  const paymentStatus = String(visit.paymentStatus || '').toUpperCase()
  const isPaid = visit.isPaid === true || paymentStatus === 'PAID' || paymentStatus === 'SUCCESS' || paymentStatus === 'RECORDED'

  // Trường hợp trong hồ sơ khám cũ hoặc miễn phí đã hoàn tất
  const isFreeOrCompleted = visit.totalAmount === 0 || visit.isFreeOfCharge === true

  if (!isPaid && !isFreeOrCompleted && visit.paymentStatus !== undefined && paymentStatus !== 'PAID') {
    return {
      canSurvey: false,
      reason: 'Lượt khám chưa hoàn tất thu phí tài chính tại phòng khám.',
    }
  }

  return { canSurvey: true }
}

/**
 * Tính toán các chỉ số KPI tổng hợp cho Báo cáo quản trị
 * @param {Object} reportData Dữ liệu từ GET /reports/satisfaction
 * @returns {Object}
 */
export const calculateSatisfactionKpis = (reportData = {}) => {
  const totalSurveys = Number(reportData.totalSurveys || 0)
  const averageScore = Number(reportData.averageScore || 0)
  const distribution = reportData.scoreDistribution || {}

  // Đếm số lượng điểm thấp (1, 2, 3 sao)
  const score1 = Number(distribution[1] || 0)
  const score2 = Number(distribution[2] || 0)
  const score3 = Number(distribution[3] || 0)
  const score4 = Number(distribution[4] || 0)
  const score5 = Number(distribution[5] || 0)

  const lowScoreCount = score1 + score2 + score3
  const highQualityCount = score4 + score5

  // Tỷ lệ hài lòng (% đánh giá 4 và 5 sao)
  const satisfactionRate = totalSurveys > 0
    ? Math.round((highQualityCount / totalSurveys) * 1000) / 10
    : 0

  // Đánh giá mức độ hài lòng chung
  let qualityTier = 'CHƯA CÓ ĐÁNH GIÁ'
  let qualityTone = 'default'
  if (totalSurveys > 0) {
    if (averageScore >= 4.5) {
      qualityTier = 'XUẤT SẮC'
      qualityTone = 'success'
    } else if (averageScore >= 4.0) {
      qualityTier = 'TỐT'
      qualityTone = 'processing'
    } else if (averageScore >= 3.0) {
      qualityTier = 'TRUNG BÌNH'
      qualityTone = 'warning'
    } else {
      qualityTier = 'CẦN CẢI THIỆN GẤP'
      qualityTone = 'error'
    }
  }

  return {
    totalSurveys,
    averageScore,
    lowScoreCount,
    satisfactionRate,
    highQualityCount,
    qualityTier,
    qualityTone,
    distribution: {
      1: score1,
      2: score2,
      3: score3,
      4: score4,
      5: score5,
    },
  }
}

/**
 * Sắp xếp và lọc danh sách Bác sĩ
 * Lưu ý: Bác sĩ trong kỳ chưa có đánh giá nào (totalSurveys = 0) không tính vào xếp hạng
 * để tránh hiển thị 0.0 sao gây hiểu lầm đánh giá kém.
 * @param {Array} doctors
 * @param {string} sortBy 'averageScore' | 'totalSurveys' | 'doctorName'
 * @param {string} sortOrder 'asc' | 'desc'
 * @returns {Array}
 */
export const sortAndFilterDoctorSummaries = (doctors = [], sortBy = 'averageScore', sortOrder = 'desc') => {
  if (!Array.isArray(doctors)) return []

  const list = [...doctors].filter((d) => d && typeof d === 'object')

  list.sort((a, b) => {
    // Ưu tiên bác sĩ có đánh giá lên trước
    const aHasReviews = (a.totalSurveys || 0) > 0
    const bHasReviews = (b.totalSurveys || 0) > 0

    if (aHasReviews && !bHasReviews) return -1
    if (!aHasReviews && bHasReviews) return 1

    let diff = 0
    if (sortBy === 'averageScore') {
      diff = Number(a.averageScore || 0) - Number(b.averageScore || 0)
    } else if (sortBy === 'totalSurveys') {
      diff = Number(a.totalSurveys || 0) - Number(b.totalSurveys || 0)
    } else {
      diff = String(a.doctorName || '').localeCompare(String(b.doctorName || ''))
    }

    return sortOrder === 'asc' ? diff : -diff
  })

  return list
}

/**
 * Lọc danh sách nhận xét theo tiêu chí điểm
 * @param {Array} comments
 * @param {string} filter 'ALL' | 'LOW' | 'VERY_LOW' | 'POSITIVE' | '1' | '2' | '3' | '4' | '5'
 * @returns {Array}
 */
export const filterCommentsByScore = (comments = [], filter = 'ALL') => {
  if (!Array.isArray(comments)) return []

  switch (filter) {
    case 'LOW':
      return comments.filter((c) => Number(c.score) <= LOW_SCORE_THRESHOLD)
    case 'VERY_LOW':
      return comments.filter((c) => Number(c.score) <= 2)
    case 'POSITIVE':
      return comments.filter((c) => Number(c.score) >= 4)
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
      return comments.filter((c) => Number(c.score) === Number(filter))
    case 'ALL':
    default:
      return comments
  }
}

/**
 * Ẩn danh tuyệt đối thông tin bệnh nhân để bảo vệ tính khách quan của khảo sát
 * @returns {string}
 */
export const getAnonymizedPatientLabel = () => 'Bệnh nhân ẩn danh'
