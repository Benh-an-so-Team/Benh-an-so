/**
 * Danh sách phân loại yêu cầu dữ liệu cá nhân (NCL-15-CN-006 / QTN-24, QTN-19).
 * Backend hỗ trợ open string tối đa 50 ký tự; các loại chuẩn phục vụ nghiệp vụ phòng khám.
 */
export const REQUEST_TYPE_OPTIONS = {
  MEDICAL_RECORD_COPY: 'Trích sao bệnh án',
  DATA_ACCESS: 'Truy cập dữ liệu',
  DATA_CORRECTION: 'Đính chính dữ liệu',
  DATA_DELETION: 'Rút lại đồng ý / Xóa dữ liệu',
  RESTRICT_PROCESSING: 'Hạn chế xử lý dữ liệu',
  OTHER: 'Yêu cầu khác',
}

/**
 * Lấy nhãn hiển thị của loại yêu cầu
 * @param {string} type - Mã loại yêu cầu
 * @returns {string} Tên loại yêu cầu tiếng Việt
 */
export const getRequestTypeLabel = (type) => {
  if (!type) return '---'
  return REQUEST_TYPE_OPTIONS[type] || type
}

/**
 * Lấy cấu hình Tag trạng thái yêu cầu
 * @param {string} status - Trạng thái: RECEIVED | COMPLETED
 * @returns {{ label: string, color: string }}
 */
export const getStatusTag = (status) => {
  switch (status) {
    case 'RECEIVED':
      return { label: 'Chờ xử lý', color: 'orange' }
    case 'COMPLETED':
      return { label: 'Đã hoàn tất', color: 'green' }
    default:
      return { label: status || 'Không xác định', color: 'default' }
  }
}

/**
 * Kiểm tra yêu cầu có bị quá hạn hay không.
 * Quá hạn khi: dueAt < now && status !== 'COMPLETED'
 * @param {Object} request - Bản ghi yêu cầu dữ liệu cá nhân
 * @param {Date|string|number} now - Thời điểm đối chiếu (mặc định là hiện tại)
 * @returns {boolean}
 */
export const getOverdueFlag = (request, now = new Date()) => {
  if (!request || !request.dueAt || request.status === 'COMPLETED') {
    return false
  }
  const dueDate = new Date(request.dueAt).getTime()
  const nowDate = now instanceof Date ? now.getTime() : new Date(now).getTime()
  return dueDate < nowDate
}

/**
 * Kiểm tra yêu cầu có sắp tới hạn (trong vòng 24 giờ) hay không.
 * @param {Object} request - Bản ghi yêu cầu dữ liệu cá nhân
 * @param {Date|string|number} now - Thời điểm đối chiếu (mặc định là hiện tại)
 * @returns {boolean}
 */
export const isUpcomingDue = (request, now = new Date()) => {
  if (!request || !request.dueAt || request.status === 'COMPLETED') {
    return false
  }
  const dueDate = new Date(request.dueAt).getTime()
  const nowDate = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const diffMs = dueDate - nowDate
  // Còn trong tương lai và <= 24 giờ (86,400,000 ms)
  return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000
}

/**
 * Điều kiện cho phép hoàn tất xử lý yêu cầu.
 * Chỉ cho phép khi trạng thái là 'RECEIVED' (chờ xử lý).
 * Dùng để ẩn hoặc vô hiệu hóa nút "Hoàn tất" khi đã COMPLETED.
 * @param {Object} request
 * @returns {boolean}
 */
export const canComplete = (request) => {
  return request?.status === 'RECEIVED'
}

/**
 * Validate form tiếp nhận yêu cầu dữ liệu cá nhân mới.
 * - patientId: bắt buộc
 * - requestType: bắt buộc
 * - reason: bắt buộc, không vượt quá 2000 ký tự
 * - dueAt: bắt buộc, không được trước thời điểm tiếp nhận (receivedAt)
 *
 * @param {string} patientId - ID bệnh nhân
 * @param {string} requestType - Loại yêu cầu
 * @param {string} reason - Lý do yêu cầu
 * @param {string|Date} dueAt - Hạn xử lý
 * @param {string|Date} receivedAt - Thời điểm tiếp nhận (mặc định là hiện tại)
 * @returns {{ isValid: boolean, errors: Object }}
 */
export const validateCreateForm = (patientId, requestType, reason, dueAt, receivedAt = new Date()) => {
  const errors = {}

  if (!patientId || (typeof patientId === 'string' && !patientId.trim())) {
    errors.patientId = 'Vui lòng chọn bệnh nhân.'
  }

  if (!requestType || (typeof requestType === 'string' && !requestType.trim())) {
    errors.requestType = 'Vui lòng chọn loại yêu cầu.'
  } else if (String(requestType).length > 50) {
    errors.requestType = 'Loại yêu cầu không được vượt quá 50 ký tự.'
  }

  const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
  if (!trimmedReason) {
    errors.reason = 'Vui lòng nhập lý do yêu cầu.'
  } else if (trimmedReason.length > 2000) {
    errors.reason = 'Lý do yêu cầu không được vượt quá 2000 ký tự.'
  }

  if (!dueAt) {
    errors.dueAt = 'Vui lòng chọn hạn xử lý.'
  } else {
    const dueTime = new Date(dueAt).getTime()
    const receivedTime = receivedAt instanceof Date ? receivedAt.getTime() : new Date(receivedAt).getTime()
    if (isNaN(dueTime)) {
      errors.dueAt = 'Hạn xử lý không đúng định dạng ngày giờ.'
    } else if (dueTime < receivedTime) {
      errors.dueAt = 'Hạn xử lý không được trước thời điểm tiếp nhận.'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate form hoàn tất xử lý yêu cầu.
 * - result: bắt buộc, không vượt quá 2000 ký tự
 *
 * @param {string} result - Kết quả / bằng chứng xử lý
 * @returns {{ isValid: boolean, errors: Object }}
 */
export const validateCompleteForm = (result) => {
  const errors = {}
  const trimmed = typeof result === 'string' ? result.trim() : ''

  if (!trimmed) {
    errors.result = 'Vui lòng nhập kết quả hoặc bằng chứng xử lý.'
  } else if (trimmed.length > 2000) {
    errors.result = 'Kết quả xử lý không được vượt quá 2000 ký tự.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Map các mã lỗi đặc thù từ Backend sang thông điệp tiếng Việt thân thiện
 * @param {Object} error - Đối tượng AxiosError hoặc API Error
 * @param {string} defaultMessage - Thông báo mặc định
 * @returns {string}
 */
export const mapPersonalDataRequestError = (error, defaultMessage = 'Có lỗi xảy ra khi xử lý yêu cầu dữ liệu cá nhân.') => {
  if (!error) return defaultMessage

  const status = error.response?.status || error.status || error.apiError?.status
  const data = error.response?.data || error.apiError || {}
  const code = data.code || error.code
  const serverMsg = data.message || error.message || ''

  // 409 Conflict: đã hoàn tất trước đó
  if (
    status === 409 ||
    code === 'PERSONAL_DATA_REQUEST_ALREADY_COMPLETED' ||
    serverMsg.includes('already completed') ||
    serverMsg.includes('đã hoàn tất')
  ) {
    return 'Yêu cầu dữ liệu cá nhân này đã được hoàn tất trước đó, không thể chỉnh sửa tiếp.'
  }

  // 403 Forbidden: không có quyền (không phải ADMIN)
  if (status === 403 || code === 'FORBIDDEN' || code === 'ACCESS_DENIED') {
    return 'Bạn không có quyền thực hiện thao tác này. Chức năng này chỉ dành cho Quản trị viên (ADMIN).'
  }

  // 404 Not Found
  if (status === 404 || code === 'NOT_FOUND') {
    if (serverMsg.includes('Patient') || serverMsg.includes('bệnh nhân')) {
      return 'Không tìm thấy thông tin bệnh nhân tương ứng trên hệ thống.'
    }
    return 'Không tìm thấy yêu cầu dữ liệu cá nhân hoặc tài nguyên đã bị xóa.'
  }

  // 400 Bad Request
  if (status === 400 || code === 'VALIDATION_FAILED' || code === 'BAD_REQUEST') {
    if (
      serverMsg.includes('Due date must not be before') ||
      serverMsg.includes('dueAt') ||
      serverMsg.includes('received date')
    ) {
      return 'Hạn xử lý không được trước thời điểm tiếp nhận.'
    }
    if (serverMsg.includes('result')) {
      return 'Kết quả xử lý không được để trống hoặc vượt quá 2000 ký tự.'
    }
    if (serverMsg.includes('reason')) {
      return 'Lý do yêu cầu không được để trống hoặc vượt quá 2000 ký tự.'
    }
    if (serverMsg.includes('requestType')) {
      return 'Loại yêu cầu không hợp lệ hoặc vượt quá 50 ký tự.'
    }
    if (serverMsg.includes('dueFrom must be before or equal to dueTo')) {
      return 'Khoảng ngày hạn xử lý không hợp lệ: ngày bắt đầu phải trước ngày kết thúc.'
    }
    if (serverMsg && typeof serverMsg === 'string' && serverMsg.trim()) {
      return serverMsg
    }
    return 'Dữ liệu yêu cầu không hợp lệ. Vui lòng kiểm tra lại các trường thông tin.'
  }

  return serverMsg || defaultMessage
}
