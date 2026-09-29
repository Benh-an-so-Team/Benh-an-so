/**
 * familyAppointmentHelpers.js
 * Tiện ích hỗ trợ nghiệp vụ "Đặt lịch cho người thân trong cùng tài khoản"
 * NCL-14-CN-010 (Cổng bệnh nhân & Người giám hộ đặt lịch)
 */

export const DEFAULT_ADULT_AGE_THRESHOLD = 18

export const RELATIONSHIP_LABELS = {
  SELF: 'Chính tôi',
  CON: 'Con',
  BO: 'Bố',
  CHA: 'Cha',
  ME: 'Mẹ',
  VO: 'Vợ',
  CHONG: 'Chồng',
  ONG: 'Ông',
  BA: 'Bà',
  ANH: 'Anh',
  CHI: 'Chị',
  EM: 'Em',
  NGUOI_GIAM_HO: 'Người giám hộ',
  DEPENDENT: 'Người phụ thuộc',
}

/**
 * Chuẩn hóa nhãn mối quan hệ sang tiếng Việt thân thiện
 */
export function formatProfileRelationship(relationship, self = false) {
  if (self) return 'Chính tôi'
  if (!relationship) return 'Người thân'

  const normalized = String(relationship).trim().toUpperCase()
  if (normalized === 'SELF') return 'Chính tôi'
  if (normalized === 'BO' || normalized === 'CHA') return 'Bố'
  if (normalized === 'ME') return 'Mẹ'
  if (normalized === 'CON') return 'Con'
  if (normalized === 'VO') return 'Vợ'
  if (normalized === 'CHONG') return 'Chồng'
  if (normalized === 'ONG') return 'Ông'
  if (normalized === 'BA') return 'Bà'
  if (normalized.includes('GIAM') || normalized === 'GUARDIAN') return 'Người giám hộ'

  return RELATIONSHIP_LABELS[normalized] || relationship
}

/**
 * Lấy chữ cái viết tắt đại diện cho avatar
 */
export function getProfileInitials(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'BN'
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'BN'
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
  return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Định dạng tuổi hiển thị
 */
export function formatProfileAge(age, dateOfBirth) {
  if (typeof age === 'number' && !isNaN(age)) {
    return `${age} tuổi`
  }
  if (dateOfBirth) {
    const birthYear = new Date(dateOfBirth).getFullYear()
    if (!isNaN(birthYear)) {
      const currentYear = new Date().getFullYear()
      const calcAge = Math.max(0, currentYear - birthYear)
      return `${calcAge} tuổi`
    }
  }
  return ''
}

/**
 * Kiểm tra xem hồ sơ người thân có thuộc diện cần rà soát liên kết do đủ tuổi thành niên không
 * Ngưỡng tuổi có thể cấu hình (mặc định 18 tuổi)
 */
export function isAdultReviewRequired(profile, adultAgeThreshold = DEFAULT_ADULT_AGE_THRESHOLD) {
  if (!profile || profile.self) return false
  if (profile.requiresGuardianLinkReview === true) return true

  const age = typeof profile.age === 'number' ? profile.age : null
  if (age !== null && age >= adultAgeThreshold) {
    return true
  }

  if (profile.dateOfBirth) {
    const birthYear = new Date(profile.dateOfBirth).getFullYear()
    if (!isNaN(birthYear)) {
      const currentYear = new Date().getFullYear()
      if (currentYear - birthYear >= adultAgeThreshold) {
        return true
      }
    }
  }

  return false
}

/**
 * Làm sạch nội dung thông báo hiển thị để tránh lộ Họ tên đầy đủ hoặc PHI của người thân
 * theo quy định bảo mật NCL-14-CN-010
 */
export function sanitizeFamilyNoticeMessage(rawMessage, fallback = 'Thao tác thực hiện thành công') {
  if (!rawMessage || typeof rawMessage !== 'string') return fallback
  // Nếu thông báo chứa thông tin người thân hoặc thành công chung
  if (rawMessage.toLowerCase().includes('đã đặt lịch')) {
    return 'Đã đặt lịch cho hồ sơ đang chọn'
  }
  if (rawMessage.toLowerCase().includes('gỡ liên kết') || rawMessage.toLowerCase().includes('unlink')) {
    return 'Đã gỡ liên kết giám hộ thành công'
  }
  if (rawMessage.toLowerCase().includes('không tìm thấy') || rawMessage.toLowerCase().includes('access denied')) {
    return 'Không tìm thấy nội dung yêu cầu'
  }
  return rawMessage
}

/**
 * Kiểm tra tính hợp lệ của hồ sơ được yêu cầu truy cập trong danh sách uỷ quyền
 */
export function validateAccessScope(targetPatientId, linkedProfiles = []) {
  if (!targetPatientId) {
    // Mặc định chọn chính mình
    return { valid: true, profile: linkedProfiles.find((p) => p.self) || linkedProfiles[0] || null }
  }

  const found = linkedProfiles.find(
    (p) => String(p.patientId) === String(targetPatientId) || String(p.id) === String(targetPatientId)
  )

  if (found) {
    return { valid: true, profile: found }
  }

  return {
    valid: false,
    profile: null,
    errorMessage: 'Không tìm thấy nội dung yêu cầu',
  }
}

/**
 * Tạo màu sắc avatar theo chỉ số hoặc vai trò
 */
export function getAvatarColor(profile, index = 0) {
  if (profile?.self) {
    return {
      bg: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
      text: '#ffffff',
      border: '#bfdbfe',
    }
  }
  const palette = [
    { bg: 'linear-gradient(135deg, #10b981, #059669)', text: '#ffffff', border: '#a7f3d0' },
    { bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', text: '#ffffff', border: '#ddd6fe' },
    { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', text: '#ffffff', border: '#fde68a' },
    { bg: 'linear-gradient(135deg, #ec4899, #db2777)', text: '#ffffff', border: '#fbcfe8' },
    { bg: 'linear-gradient(135deg, #06b6d4, #0891b2)', text: '#ffffff', border: '#a5f3fc' },
  ]
  return palette[index % palette.length]
}

/**
 * Dữ liệu hồ sơ mẫu mô phỏng trong trường hợp tài khoản người dùng chưa liên kết DB thực tế
 */
export function createDefaultFallbackProfiles(user) {
  const selfId = user?.patientId || user?.id || 'self-patient-001'
  const selfName = user?.fullName || user?.username || 'Bệnh nhân'

  return [
    {
      patientId: selfId,
      patientCode: 'BN-SELF',
      fullName: selfName,
      dateOfBirth: '1990-01-01',
      age: 34,
      isMinor: false,
      relationship: 'SELF',
      self: true,
      requiresGuardianLinkReview: false,
    },
    {
      patientId: 'dependent-child-001',
      patientCode: 'BN-CON01',
      fullName: 'Nguyễn Văn Con',
      dateOfBirth: '2015-05-10',
      age: 11,
      isMinor: true,
      relationship: 'Con',
      self: false,
      requiresGuardianLinkReview: false,
    },
    {
      patientId: 'dependent-adult-002',
      patientCode: 'BN-CON02',
      fullName: 'Nguyễn Thị Lớn (Đã đủ 18 tuổi)',
      dateOfBirth: '2006-02-15',
      age: 18,
      isMinor: false,
      relationship: 'Con',
      self: false,
      requiresGuardianLinkReview: true,
    },
  ]
}
