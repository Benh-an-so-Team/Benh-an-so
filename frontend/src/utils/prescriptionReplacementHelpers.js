/**
 * prescriptionReplacementHelpers.js
 * 
 * Nghiệp vụ và hàm tiện ích cho chức năng "Thay thế đơn thuốc đã liên thông"
 * User Story: NCL-12-CN-008 (QTN-42, QTN-21, QTN-12)
 * Acceptance Criteria: TC-01, TC-02, TC-03, TC-04
 */

export const PRESET_REPLACEMENT_REASONS = [
  'Sai liều lượng so với chẩn đoán đã cập nhật',
  'Sai thuốc điều trị',
  'Sai số lượng hoặc thời gian dùng thuốc',
  'Bổ sung hoặc loại bỏ thuốc theo diễn biến lâm sàng',
  'Điều chỉnh theo khuyến cáo tương tác/dị ứng thuốc',
]

export const PRESCRIPTION_STATUS_REPLACED = 'REPLACED'

export const REPLACED_STATUS_CONFIG = {
  key: 'REPLACED',
  label: 'Đã bị thay thế',
  color: 'purple',
  text: '#7c3aed',
  bg: '#f5f3ff',
  border: '#ddd6fe',
  description: 'Đơn thuốc gốc đã bị thay thế bởi đơn thuốc mới, không thể cấp phát hay in ấn.',
}

/**
 * Kiểm tra xem người dùng hiện tại có đủ điều kiện và thẩm quyền thay thế đơn thuốc hay không.
 * Điều kiện:
 * 1. Đơn gốc phải có status = 'PENDING_DISPENSE' (chờ cấp phát, chưa cấp phát)
 * 2. Đơn gốc phải có interconnectionStatus = 'SUCCESS' (đã liên thông thành công)
 * 3. Người dùng phải có vai trò DOCTOR (Bác sĩ)
 * 4. Người dùng phải là chính Bác sĩ đã kê đơn gốc (so sánh ID)
 * Lưu ý: Quản trị viên (Admin) không phải bác sĩ kê đơn gốc sẽ không được thao tác (Backend chặn 403).
 * 
 * @param {Object} prescription Đơn thuốc cần kiểm tra
 * @param {Object} currentUser Người dùng đang đăng nhập
 * @param {string[]} [userPermissions] Danh sách quyền của người dùng (tùy chọn)
 * @returns {boolean}
 */
export function canReplacePrescription(prescription, currentUser, userPermissions = null) {
  if (!prescription || typeof prescription !== 'object') return false
  if (!currentUser || typeof currentUser !== 'object') return false

  // 1. Phải là đơn ở trạng thái PENDING_DISPENSE (chờ cấp phát)
  if (prescription.status !== 'PENDING_DISPENSE') return false

  // 2. Phải là đơn đã liên thông thành công (interconnectionStatus === 'SUCCESS')
  const interStatus = String(prescription.interconnectionStatus || '').toUpperCase()
  const hasReceipt = Boolean(prescription.interconnectionReceiptCode || prescription.receiptCode)
  const isInterconnected = interStatus === 'SUCCESS' || (hasReceipt && interStatus !== 'FAILED')
  if (!isInterconnected) return false

  // 3. Quyền bác sĩ: Người dùng phải có vai trò DOCTOR (hoặc roles có 'doctor')
  let roles = []
  if (Array.isArray(currentUser.roles)) {
    roles = currentUser.roles
  } else if (currentUser.role) {
    roles = [currentUser.role]
  }
  const normalizedRoles = roles.map((r) =>
    String(r || '')
      .toLowerCase()
      .replace(/^role_/, ''),
  )
  const isDoctor = normalizedRoles.includes('doctor')
  if (!isDoctor) return false

  // Nếu có permissions, kiểm tra PRESCRIPTION_UPDATE nếu mảng có dữ liệu
  const permissions = Array.isArray(userPermissions)
    ? userPermissions
    : Array.isArray(currentUser.permissions)
    ? currentUser.permissions
    : null
  if (permissions && permissions.length > 0 && !permissions.includes('PRESCRIPTION_UPDATE')) {
    return false
  }

  // 4. Quyền sở hữu: Bác sĩ hiện tại phải là người kê đơn gốc
  const cleanId = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const currentUserId = cleanId(currentUser.id || currentUser.userId)
  const prescribingDoctorId = cleanId(
    prescription.prescribedBy ||
    prescription.prescribedById ||
    prescription.doctorId ||
    prescription.doctor?.id,
  )

  if (!currentUserId || !prescribingDoctorId) return false
  return currentUserId === prescribingDoctorId
}

/**
 * Kiểm tra hợp lệ lý do thay thế đơn thuốc.
 * - Bắt buộc (không rỗng, không toàn khoảng trắng)
 * - Tối đa 500 ký tự
 * 
 * @param {string} reason 
 * @returns {{ valid: boolean, error: string | null, reason: string }}
 */
export function validateReplacementReason(reason) {
  if (reason == null) {
    return {
      valid: false,
      error: 'Vui lòng nhập lý do thay thế đơn thuốc (1 - 500 ký tự).',
      reason: '',
    }
  }

  const trimmed = String(reason).trim()

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Lý do thay thế đơn thuốc không được để trống hoặc chỉ chứa khoảng trắng.',
      reason: '',
    }
  }

  if (trimmed.length > 500) {
    return {
      valid: false,
      error: `Lý do thay thế không được vượt quá 500 ký tự (hiện tại: ${trimmed.length} ký tự).`,
      reason: trimmed,
    }
  }

  return {
    valid: true,
    error: null,
    reason: trimmed,
  }
}

/**
 * Trích xuất thông tin chuỗi liên kết đơn thuốc (đơn thay thế cho đơn nào, hoặc bị đơn nào thay thế).
 * 
 * @param {Object} prescription 
 * @returns {{ type: 'REPLACEMENT' | 'REPLACED', isReplacement: boolean, isReplaced: boolean, linkedId: string, linkedCode: string, reason: string, label: string } | null}
 */
export function getReplacementLinkInfo(prescription) {
  if (!prescription || typeof prescription !== 'object') return null

  const replacesId = prescription.replacesPrescriptionId
  const replacesCode = prescription.replacesPrescriptionCode
  const replacementReason = prescription.replacementReason

  const replacedById = prescription.replacedByPrescriptionId
  const replacedByCode = prescription.replacedByPrescriptionCode

  if (replacesId || replacesCode) {
    return {
      type: 'REPLACEMENT',
      isReplacement: true,
      isReplaced: false,
      linkedId: replacesId,
      linkedCode: replacesCode || '—',
      reason: replacementReason || '',
      label: `Thay thế cho đơn gốc: ${replacesCode || replacesId}`,
    }
  }

  if (replacedById || replacedByCode) {
    return {
      type: 'REPLACED',
      isReplacement: false,
      isReplaced: true,
      linkedId: replacedById,
      linkedCode: replacedByCode || '—',
      reason: replacementReason || '',
      label: `Đã bị thay thế bởi đơn: ${replacedByCode || replacedById}`,
    }
  }

  return null
}

/**
 * Ánh xạ lỗi trả về từ API sang thông điệp tiếng Việt cụ thể, rõ ràng cho từng trường hợp.
 * 
 * @param {Object|string} error 
 * @returns {string}
 */
export function mapReplacementErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định khi phát hành đơn thay thế.'

  const status = error.response?.status || error.status
  const data = error.response?.data || error.data || {}
  const code = String(data.code || error.code || '').toUpperCase()
  const rawMessage = String(data.message || error.message || '')

  // 1. Lỗi thẩm quyền bác sĩ (403)
  if (code === 'UNAUTHORIZED_PRESCRIPTION_REPLACEMENT') {
    return 'Chỉ bác sĩ trực tiếp kê đơn thuốc gốc mới có quyền phát hành đơn thay thế.'
  }
  if (status === 403 || code === 'ACCESS_DENIED') {
    if (
      rawMessage.toLowerCase().includes('doctor who created') ||
      rawMessage.toLowerCase().includes('prescribed by another doctor')
    ) {
      return 'Chỉ bác sĩ trực tiếp kê đơn thuốc gốc mới có quyền phát hành đơn thay thế.'
    }
    return 'Tài khoản không có quyền thay thế đơn thuốc (yêu cầu vai trò Bác sĩ kê đơn gốc).'
  }

  // 2. Không tìm thấy đơn thuốc (404)
  if (status === 404 || code === 'PRESCRIPTION_NOT_FOUND') {
    return 'Không tìm thấy đơn thuốc gốc trên hệ thống.'
  }

  // 3. Lỗi xung đột trạng thái (409)
  if (code === 'PRESCRIPTION_ALREADY_DISPENSED') {
    return 'Đơn thuốc đã được cấp phát, không thể thay thế. Vui lòng tạo đơn mới cho lượt khám.'
  }
  if (code === 'PRESCRIPTION_ALREADY_CANCELLED') {
    return 'Đơn thuốc đã bị hủy, không thể thay thế.'
  }
  if (code === 'PRESCRIPTION_INVALID_STATUS') {
    if (rawMessage.toLowerCase().includes('interconnect')) {
      return 'Chỉ có thể thay thế đơn thuốc đã liên thông thành công lên Cổng quốc gia.'
    }
    if (
      rawMessage.toLowerCase().includes('already been replaced') ||
      rawMessage.toLowerCase().includes('already replaced')
    ) {
      return 'Đơn thuốc này đã được thay thế trước đó. Mỗi đơn gốc chỉ được thay thế tối đa một lần.'
    }
    return rawMessage || 'Trạng thái đơn thuốc không hợp lệ để phát hành đơn thay thế.'
  }

  // 4. Lỗi cảnh báo an toàn lâm sàng cần xác nhận override
  if (
    code === 'INTERACTION_CONFIRMATION_REQUIRED' ||
    rawMessage.includes('INTERACTION_CONFIRMATION_REQUIRED')
  ) {
    return 'Đơn thuốc có tương tác thuốc chưa được xác nhận lý do chuyên môn.'
  }
  if (
    code === 'ALLERGY_CONFIRMATION_REQUIRED' ||
    rawMessage.includes('ALLERGY_CONFIRMATION_REQUIRED')
  ) {
    return 'Đơn thuốc có cảnh báo dị ứng chưa được xác nhận lý do chuyên môn.'
  }
  if (
    code === 'CONTRAINDICATION_CONFIRMATION_REQUIRED' ||
    rawMessage.includes('CONTRAINDICATION_CONFIRMATION_REQUIRED')
  ) {
    return 'Đơn thuốc có chống chỉ định chưa được xác nhận lý do chuyên môn.'
  }
  if (
    code === 'MAX_DAILY_DOSE_CONFIRMATION_REQUIRED' ||
    rawMessage.includes('MAX_DAILY_DOSE_CONFIRMATION_REQUIRED')
  ) {
    return 'Đơn thuốc có thuốc vượt quá liều tối đa hàng ngày chưa được xác nhận lý do chuyên môn.'
  }
  if (
    code === 'CONTROLLED_MEDICINE_CONFIRMATION_REQUIRED' ||
    rawMessage.includes('CONTROLLED_MEDICINE_CONFIRMATION_REQUIRED')
  ) {
    return 'Đơn thuốc có thuốc kiểm soát đặc biệt chưa được xác nhận.'
  }

  // 5. Lỗi dữ liệu không hợp lệ (400)
  if (status === 400 || code === 'VALIDATION_FAILED') {
    if (rawMessage.toLowerCase().includes('reason')) {
      return 'Lý do thay thế đơn thuốc là bắt buộc và không quá 500 ký tự.'
    }
    if (
      rawMessage.toLowerCase().includes('item') ||
      rawMessage.toLowerCase().includes('thuốc')
    ) {
      return 'Đơn thay thế phải có ít nhất một loại thuốc hợp lệ.'
    }
    return rawMessage
      ? `Dữ liệu đơn thay thế không hợp lệ: ${rawMessage}`
      : 'Dữ liệu đơn thay thế không hợp lệ. Vui lòng kiểm tra lại.'
  }

  // 6. Lỗi chung
  if (rawMessage && !rawMessage.startsWith('Request failed with status code')) {
    return rawMessage
  }

  return 'Không thể phát hành đơn thay thế do lỗi hệ thống. Vui lòng thử lại sau.'
}
