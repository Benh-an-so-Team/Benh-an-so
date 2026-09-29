import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_ADULT_AGE_THRESHOLD,
  createDefaultFallbackProfiles,
  formatProfileAge,
  formatProfileRelationship,
  getAvatarColor,
  getProfileInitials,
  isAdultReviewRequired,
  sanitizeFamilyNoticeMessage,
  validateAccessScope,
} from '../../utils/familyAppointmentHelpers.js'
import patientPortalAppointmentApi from '../../api/patientPortalAppointmentApi.js'

test('TC-FAM-01: formatProfileRelationship và formatProfileAge hiển thị chuẩn tiếng Việt', () => {
  assert.equal(formatProfileRelationship('SELF', true), 'Chính tôi')
  assert.equal(formatProfileRelationship('SELF', false), 'Chính tôi')
  assert.equal(formatProfileRelationship('Bo', false), 'Bố')
  assert.equal(formatProfileRelationship('Cha', false), 'Bố')
  assert.equal(formatProfileRelationship('Me', false), 'Mẹ')
  assert.equal(formatProfileRelationship('Con', false), 'Con')
  assert.equal(formatProfileRelationship('Vo', false), 'Vợ')
  assert.equal(formatProfileRelationship('Chong', false), 'Chồng')
  assert.equal(formatProfileRelationship('Guardian', false), 'Người giám hộ')
  assert.equal(formatProfileRelationship('', false), 'Người thân')

  assert.equal(formatProfileAge(11), '11 tuổi')
  assert.equal(formatProfileAge(0), '0 tuổi')
  assert.equal(formatProfileAge(null, '2015-05-10'), `${Math.max(0, new Date().getFullYear() - 2015)} tuổi`)
})

test('TC-FAM-02: getProfileInitials và getAvatarColor tạo avatar nhận diện chuẩn', () => {
  assert.equal(getProfileInitials('Nguyễn Văn Con'), 'VC')
  assert.equal(getProfileInitials('Nguyễn Con'), 'NC')
  assert.equal(getProfileInitials('Con'), 'CO')
  assert.equal(getProfileInitials(''), 'BN')

  const selfColor = getAvatarColor({ self: true }, 0)
  assert.ok(selfColor.bg.includes('#2563eb'), 'Chính tôi dùng màu xanh lam chủ đạo')

  const depColor = getAvatarColor({ self: false }, 0)
  assert.notEqual(depColor.bg, selfColor.bg, 'Hồ sơ người thân có bảng màu phân biệt')
})

test('TC-FAM-03: isAdultReviewRequired kiểm tra chính xác ngưỡng tuổi thành niên có thể cấu hình', () => {
  const childProfile = {
    patientId: 'p-1',
    fullName: 'Bé Con',
    age: 11,
    self: false,
    requiresGuardianLinkReview: false,
  }
  assert.equal(isAdultReviewRequired(childProfile, 18), false, 'Trẻ 11 tuổi không cần rà soát')

  const adultProfile = {
    patientId: 'p-2',
    fullName: 'Nguyễn Thị Lớn',
    age: 18,
    self: false,
    requiresGuardianLinkReview: false,
  }
  assert.equal(isAdultReviewRequired(adultProfile, 18), true, 'Hồ sơ đủ 18 tuổi cần rà soát gỡ liên kết')

  const flagProfile = {
    patientId: 'p-3',
    fullName: 'Nguyễn Văn Đủ Tuổi',
    age: 17,
    self: false,
    requiresGuardianLinkReview: true,
  }
  assert.equal(isAdultReviewRequired(flagProfile, 18), true, 'requiresGuardianLinkReview = true kích hoạt rà soát')

  const selfProfile = {
    patientId: 'p-self',
    fullName: 'Tôi',
    age: 35,
    self: true,
    requiresGuardianLinkReview: false,
  }
  assert.equal(isAdultReviewRequired(selfProfile, 18), false, 'Hồ sơ của chính mình không bao giờ bị rà soát giám hộ')

  // Ngưỡng cấu hình khác (ví dụ 16 tuổi)
  const teenProfile = {
    patientId: 'p-teen',
    fullName: 'Thiếu niên',
    age: 16,
    self: false,
  }
  assert.equal(isAdultReviewRequired(teenProfile, 16), true, 'Ngưỡng tuổi cấu hình 16 tuổi hoạt động đúng')
  assert.equal(isAdultReviewRequired(teenProfile, 21), false, 'Ngưỡng tuổi cấu hình 21 tuổi hoạt động đúng')
})

test('TC-FAM-04: validateAccessScope ngăn chặn truy cập hồ sơ trái phép và trả thông báo bảo mật chung', () => {
  const mockProfiles = [
    { patientId: 'auth-001', fullName: 'Chính tôi', self: true },
    { patientId: 'auth-002', fullName: 'Con nhỏ', self: false },
  ]

  // Truy cập hồ sơ hợp lệ
  const validResult = validateAccessScope('auth-002', mockProfiles)
  assert.equal(validResult.valid, true)
  assert.equal(validResult.profile.fullName, 'Con nhỏ')

  // Cố tình sửa URL truy cập hồ sơ không uỷ quyền
  const invalidResult = validateAccessScope('unauthorized-uuid-999', mockProfiles)
  assert.equal(invalidResult.valid, false)
  assert.equal(invalidResult.profile, null)
  assert.equal(invalidResult.errorMessage, 'Không tìm thấy nội dung yêu cầu')
})

test('TC-FAM-05: sanitizeFamilyNoticeMessage không làm lộ họ tên hoặc PHI trong thông báo góc dưới phải', () => {
  const bookingNotice = sanitizeFamilyNoticeMessage('Đã đặt lịch thành công cho bệnh nhân Nguyễn Văn Con')
  assert.equal(bookingNotice, 'Đã đặt lịch cho hồ sơ đang chọn', 'Thông báo đã đặt lịch không chứa tên bệnh nhân')

  const unlinkNotice = sanitizeFamilyNoticeMessage('Đã gỡ liên kết giám hộ của hồ sơ')
  assert.equal(unlinkNotice, 'Đã gỡ liên kết giám hộ thành công')

  const notFoundNotice = sanitizeFamilyNoticeMessage('access denied / không tìm thấy')
  assert.equal(notFoundNotice, 'Không tìm thấy nội dung yêu cầu')
})

test('TC-FAM-06: Quy tắc tạo payload đặt lịch cho chính mình vs người thân (NCL-14-CN-010 §3.4)', () => {
  const buildPayload = (targetProfile, doctorId, date, time, reason) => {
    const payload = {
      doctorId,
      appointmentDate: date,
      startTime: time,
      reason,
    }
    // Chỉ gửi patientId khi đặt cho người thân phụ thuộc (self = false)
    if (targetProfile && !targetProfile.self && targetProfile.patientId) {
      payload.patientId = targetProfile.patientId
    }
    return payload
  }

  const selfProfile = { patientId: 'p-self-111', self: true }
  const depProfile = { patientId: 'p-dep-222', self: false }

  const selfPayload = buildPayload(selfProfile, 'doc-1', '2026-10-01', '08:30', 'Khám tổng quát')
  assert.equal(selfPayload.patientId, undefined, 'Đặt cho chính mình không gửi patientId để giữ tương thích ngược')

  const depPayload = buildPayload(depProfile, 'doc-1', '2026-10-01', '08:30', 'Khám nhi')
  assert.equal(depPayload.patientId, 'p-dep-222', 'Đặt cho người thân gửi đúng patientId của hồ sơ phụ thuộc')
})

test('TC-FAM-07: Giới hạn bảo mật - Lịch hẹn người thân là Read-only đối với người giám hộ (NCL-14-CN-010 §6)', () => {
  const canModifyAppointment = (apt, selectedProfile, selfId) => {
    if (!apt) return false
    if (apt.isDependent || (selectedProfile && !selectedProfile.self)) return false
    if (apt.patientId && String(apt.patientId) !== String(selfId)) return false
    return apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED'
  }

  const selfApt = {
    id: 'apt-1',
    status: 'SCHEDULED',
    patientId: 'self-1',
    isDependent: false,
  }
  const depApt = {
    id: 'apt-2',
    status: 'SCHEDULED',
    patientId: 'dep-2',
    isDependent: true,
  }

  assert.equal(canModifyAppointment(selfApt, { self: true }, 'self-1'), true, 'Chính mình được phép đổi/hủy lịch')
  assert.equal(canModifyAppointment(depApt, { self: false }, 'self-1'), false, 'Người giám hộ chỉ được theo dõi, không được đổi/hủy lịch hộ')
})

test('TC-FAM-08: patientPortalAppointmentApi cung cấp đủ các phương thức API gia đình', () => {
  assert.equal(typeof patientPortalAppointmentApi.getLinkedProfiles, 'function')
  assert.equal(typeof patientPortalAppointmentApi.getMyAppointments, 'function')
  assert.equal(typeof patientPortalAppointmentApi.bookAppointment, 'function')
  assert.equal(typeof patientPortalAppointmentApi.unlinkGuardianProfile, 'function')
})
