/**
 * NCL-05-CN-008 / QTN-20, QTN-26: Helpers cho tính năng Bộ đơn thuốc mẫu theo chẩn đoán
 */

/**
 * Danh sách 15 đường dùng chuẩn y tế đối chiếu CHÍNH XÁC với enum AdministrationRoute
 * và CHECK constraint chk_prescription_template_items_route trong Migration V91.
 */
export const ROUTE_OPTIONS = [
  { value: 'ORAL', label: 'Uống' },
  { value: 'SUBLINGUAL', label: 'Ngậm dưới lưỡi' },
  { value: 'BUCCAL', label: 'Ngậm áp má' },
  { value: 'INTRAVENOUS', label: 'Tiêm tĩnh mạch' },
  { value: 'INTRAMUSCULAR', label: 'Tiêm bắp' },
  { value: 'SUBCUTANEOUS', label: 'Tiêm dưới da' },
  { value: 'TOPICAL', label: 'Bôi ngoài da' },
  { value: 'OPHTHALMIC', label: 'Nhỏ / Tra mắt' },
  { value: 'OTIC', label: 'Nhỏ tai' },
  { value: 'NASAL', label: 'Xịt / Nhỏ mũi' },
  { value: 'INHALATION', label: 'Hít / Khí dung' },
  { value: 'RECTAL', label: 'Đặt hậu môn / Trực tràng' },
  { value: 'VAGINAL', label: 'Đặt âm đạo' },
  { value: 'TRANSDERMAL', label: 'Dán ngoài da' },
  { value: 'OTHER', label: 'Cách dùng khác' },
]

export const ROUTE_LABELS = ROUTE_OPTIONS.reduce((acc, curr) => {
  acc[curr.value] = curr.label
  return acc
}, {})

export const getRouteLabel = (route) => {
  if (!route) return ''
  return ROUTE_LABELS[route] || route
}

/**
 * Chuẩn hóa UUID so sánh (loại bỏ gạch ngang, chữ thường).
 */
export const normalizeId = (id) => {
  if (!id) return ''
  return String(id).toLowerCase().replace(/-/g, '').trim()
}

/**
 * Kiểm tra xem người dùng hiện tại có quyền lưu đơn thuốc thành mẫu hay không.
 * Điều kiện:
 * 1. Bác sĩ (role DOCTOR)
 * 2. Đơn thuốc tồn tại
 * 3. Trạng thái khác 'CANCELLED'
 * 4. Đơn thuốc do chính bác sĩ đang đăng nhập kê (prescribedBy === currentUserId)
 *
 * @param {Object} params
 * @param {Object} [params.prescription]
 * @param {string} [params.currentUserId]
 * @param {string[]} [params.userRoles]
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export const canSaveAsTemplate = ({
  prescription = null,
  currentUserId = null,
  userRoles = [],
} = {}) => {
  const normalizedRoles = (userRoles || [])
    .map((r) => String(r || '').toLowerCase().replace(/^role_/, '').trim())
    .filter(Boolean)

  const isDoctor = normalizedRoles.includes('doctor')

  if (!isDoctor) {
    return {
      allowed: false,
      reason: 'Chỉ Bác sĩ mới có quyền lưu đơn thuốc thành mẫu.',
    }
  }

  if (!prescription) {
    return {
      allowed: false,
      reason: 'Không tìm thấy thông tin đơn thuốc.',
    }
  }

  if (prescription.status === 'CANCELLED') {
    return {
      allowed: false,
      reason: 'Không thể lưu đơn thuốc đã hủy thành mẫu.',
    }
  }

  const prescribedById = normalizeId(
    prescription.prescribedBy || prescription.prescribedById || prescription.doctorId,
  )
  const currentId = normalizeId(currentUserId)

  if (!prescribedById || !currentId || prescribedById !== currentId) {
    return {
      allowed: false,
      reason: 'Chỉ bác sĩ đã kê đơn thuốc này mới có quyền lưu thành đơn mẫu.',
    }
  }

  return {
    allowed: true,
    reason: null,
  }
}

/**
 * Trả về true nếu BẤT KỲ mảng cảnh báo an toàn nào (interactionWarnings,
 * allergyWarnings, contraindicationWarnings) không rỗng.
 *
 * @param {Object} response - AppliedPrescriptionTemplateResponse
 * @returns {boolean}
 */
export const hasSafetyWarnings = (response) => {
  if (!response || typeof response !== 'object') return false

  const hasInteractions =
    Array.isArray(response.interactionWarnings) && response.interactionWarnings.length > 0
  const hasAllergies =
    Array.isArray(response.allergyWarnings) && response.allergyWarnings.length > 0
  const hasContraindications =
    Array.isArray(response.contraindicationWarnings) && response.contraindicationWarnings.length > 0

  return hasInteractions || hasAllergies || hasContraindications
}

/**
 * Map mã lỗi hoặc phản hồi lỗi từ Backend sang thông điệp tiếng Việt thân thiện, chính xác.
 *
 * @param {any} error
 * @returns {string}
 */
export const mapTemplateErrorMessage = (error) => {
  if (!error) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.'

  if (typeof error === 'string') return error

  const status = error.response?.status
  const rawMsg =
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.apiError?.message ||
    error.message ||
    ''

  const lowerMsg = String(rawMsg).toLowerCase()

  // Phân quyền / Người kê đơn gốc
  if (status === 403 || lowerMsg.includes('access denied') || lowerMsg.includes('only the doctor')) {
    if (lowerMsg.includes('who prescribed') || lowerMsg.includes('save this prescription')) {
      return 'Chỉ bác sĩ đã kê đơn thuốc này mới có quyền lưu thành đơn mẫu.'
    }
    if (lowerMsg.includes('only apply their own')) {
      return 'Bác sĩ chỉ có thể áp dụng đơn thuốc mẫu do chính mình tạo.'
    }
    if (lowerMsg.includes('only doctors are allowed')) {
      return 'Chức năng đơn thuốc mẫu chỉ dành cho Bác sĩ điều trị.'
    }
    return 'Bạn không có quyền thực hiện thao tác này trên đơn thuốc mẫu.'
  }

  // Đơn nguồn đã hủy
  if (lowerMsg.includes('cancelled prescription cannot be saved') || lowerMsg.includes('đơn thuốc đã hủy')) {
    return 'Không thể lưu đơn thuốc đã hủy thành mẫu.'
  }

  // Mã chẩn đoán không thuộc bệnh án
  if (
    lowerMsg.includes('does not belong to the prescription') ||
    lowerMsg.includes('không thuộc bệnh án')
  ) {
    return 'Mã chẩn đoán được chọn không thuộc bệnh án của đơn thuốc này.'
  }

  // Mã chẩn đoán không tìm thấy
  if (lowerMsg.includes('diagnosis code not found') || lowerMsg.includes('không tìm thấy mã chẩn đoán')) {
    return 'Mã chẩn đoán không tồn tại trong danh mục hệ thống.'
  }

  // Không tìm thấy mẫu / đơn thuốc
  if (status === 404 || lowerMsg.includes('not found')) {
    if (lowerMsg.includes('template')) {
      return 'Không tìm thấy đơn thuốc mẫu yêu cầu.'
    }
    if (lowerMsg.includes('prescription')) {
      return 'Không tìm thấy đơn thuốc nguồn.'
    }
    return 'Không tìm thấy tài nguyên yêu cầu trên hệ thống.'
  }

  // Required fields
  if (lowerMsg.includes('prescription id is required')) {
    return 'Thiếu thông tin đơn thuốc nguồn.'
  }
  if (lowerMsg.includes('diagnosis code is required')) {
    return 'Vui lòng chọn chẩn đoán gắn với đơn thuốc mẫu.'
  }
  if (lowerMsg.includes('medical record id is required')) {
    return 'Thiếu thông tin bệnh án để áp dụng đơn thuốc mẫu.'
  }

  if (rawMsg) return rawMsg

  return 'Thao tác với đơn thuốc mẫu thất bại. Vui lòng thử lại.'
}

/**
 * Chuyển đổi DraftItem từ Backend sang cấu trúc item của PrescriptionPage form.
 *
 * @param {Object} draftItem - Item từ AppliedPrescriptionTemplateResponse.items
 * @param {number} [index=0]
 * @returns {Object} Form item tương thích với PrescriptionPage
 */
export const mapDraftItemToFormItem = (draftItem, index = 0) => {
  return {
    clientId: `template-item-${draftItem?.medicineId || index}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    medicineId: draftItem?.medicineId,
    quantity: Number(draftItem?.quantity) > 0 ? Number(draftItem.quantity) : 1,
    dosage: draftItem?.dosage || '1 viên',
    frequency: Number(draftItem?.frequency) > 0 ? Number(draftItem.frequency) : 1,
    route: draftItem?.route || 'ORAL',
    durationDays: Number(draftItem?.durationDays) > 0 ? Number(draftItem.durationDays) : 1,
    instructions: draftItem?.instructions || '',
    isOriginal: false,
    quantityManuallyEdited: true, // Giữ nguyên số lượng từ đơn mẫu
  }
}
