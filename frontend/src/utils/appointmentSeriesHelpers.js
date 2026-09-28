import dayjs from 'dayjs'

export const SERIES_WARNING_LABELS = {
  DOCTOR_NOT_WORKING: 'Bác sĩ không làm việc/ngoài ca',
  DOCTOR_TIME_OFF: 'Bác sĩ nghỉ phép',
  APPOINTMENT_CONFLICT: 'Trùng lịch hẹn khác',
  INTERNAL_CONFLICT: 'Trùng buổi khác trong liệu trình',
  PAST_TIME: 'Thời điểm đã qua',
  INVALID_TIME: 'Thời gian không hợp lệ',
}

export const getSeriesWarningLabel = (code) => {
  if (!code) return 'Không xác định'
  return SERIES_WARNING_LABELS[code] || `Cảnh báo khác (${code})`
}

export const getSeriesWarningColor = (code) => {
  switch (code) {
    case 'DOCTOR_NOT_WORKING':
    case 'DOCTOR_TIME_OFF':
      return 'orange'
    case 'APPOINTMENT_CONFLICT':
    case 'INTERNAL_CONFLICT':
    case 'PAST_TIME':
    case 'INVALID_TIME':
      return 'error'
    default:
      return 'warning'
  }
}

export const getSeriesStatusTag = (status) => {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Đang hoạt động', color: 'processing' }
    case 'COMPLETED':
      return { label: 'Đã hoàn thành', color: 'success' }
    case 'CANCELLED':
      return { label: 'Đã hủy', color: 'default' }
    default:
      return { label: status || 'Chưa xác định', color: 'default' }
  }
}

export const validateSeriesForm = (values = {}) => {
  const errors = {}

  if (!values.patientId) {
    errors.patientId = 'Vui lòng chọn bệnh nhân.'
  }

  if (!values.doctorId) {
    errors.doctorId = 'Vui lòng chọn bác sĩ.'
  }

  if (!values.firstSessionStartTime) {
    errors.firstSessionStartTime = 'Vui lòng chọn thời gian bắt đầu buổi đầu tiên.'
  } else {
    const startTime = dayjs(values.firstSessionStartTime)
    if (!startTime.isValid()) {
      errors.firstSessionStartTime = 'Thời gian bắt đầu không hợp lệ.'
    } else if (startTime.isBefore(dayjs())) {
      errors.firstSessionStartTime = 'Thời gian bắt đầu buổi đầu tiên không được ở trong quá khứ.'
    }
  }

  const totalSessions = Number(values.totalSessions)
  if (values.totalSessions === undefined || values.totalSessions === null || values.totalSessions === '' || Number.isNaN(totalSessions)) {
    errors.totalSessions = 'Vui lòng nhập số buổi của liệu trình.'
  } else if (totalSessions < 2) {
    errors.totalSessions = 'Số buổi của liệu trình phải từ 2 trở lên.'
  } else if (totalSessions > 30) {
    errors.totalSessions = 'Số buổi của liệu trình tối đa là 30 buổi.'
  }

  const intervalDays = Number(values.intervalDays)
  if (values.intervalDays === undefined || values.intervalDays === null || values.intervalDays === '' || Number.isNaN(intervalDays)) {
    errors.intervalDays = 'Vui lòng nhập khoảng cách giữa các buổi.'
  } else if (intervalDays < 1) {
    errors.intervalDays = 'Khoảng cách giữa các buổi phải từ 1 ngày trở lên.'
  } else if (intervalDays > 90) {
    errors.intervalDays = 'Khoảng cách giữa các buổi tối đa là 90 ngày.'
  }

  if (values.sessionDurationMinutes !== undefined && values.sessionDurationMinutes !== null && values.sessionDurationMinutes !== '') {
    const duration = Number(values.sessionDurationMinutes)
    if (Number.isNaN(duration) || duration < 1 || duration > 480) {
      errors.sessionDurationMinutes = 'Thời lượng buổi khám phải từ 1 đến 480 phút.'
    }
  }

  if (values.title && values.title.length > 255) {
    errors.title = 'Tiêu đề liệu trình không được vượt quá 255 ký tự.'
  }

  if (values.notes && values.notes.length > 1000) {
    errors.notes = 'Ghi chú liệu trình không được vượt quá 1000 ký tự.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export const canSubmitSeries = (previewResult) => {
  if (!previewResult || !Array.isArray(previewResult.sessions) || previewResult.sessions.length < 2) {
    return false
  }

  if (previewResult.conflictCount > 0) {
    return false
  }

  if (previewResult.allAvailable === false) {
    return false
  }

  const hasConflict = previewResult.sessions.some(
    (s) => s.status && s.status !== 'AVAILABLE'
  )
  return !hasConflict
}

export const buildCreateSeriesPayload = (formValues, previewSessions = []) => {
  return {
    patientId: formValues.patientId,
    doctorId: formValues.doctorId,
    medicalRecordId: formValues.medicalRecordId || null,
    title: formValues.title ? formValues.title.trim() : null,
    notes: formValues.notes ? formValues.notes.trim() : null,
    totalSessions: Number(formValues.totalSessions),
    intervalDays: Number(formValues.intervalDays),
    sessions: previewSessions.map((s) => ({
      sequenceNumber: Number(s.sequenceNumber),
      startTime: typeof s.startTime === 'string' ? s.startTime : new Date(s.startTime).toISOString(),
      endTime: typeof s.endTime === 'string' ? s.endTime : new Date(s.endTime).toISOString(),
    })),
  }
}

export const mapSeriesErrorMessage = (error) => {
  if (!error) return 'Đã xảy ra lỗi khi xử lý lịch hẹn theo liệu trình.'

  const status = error.response?.status
  const data = error.response?.data
  const backendMsg = data?.message || error.message

  if (status === 403) {
    return 'Bạn không có quyền thực hiện thao tác này (Chỉ Lễ tân và Quản trị viên được phép đặt lịch theo liệu trình).'
  }

  if (status === 409 || data?.code === 'APPOINTMENT_SERIES_CONFLICT') {
    const conflicts = data?.details?.conflicts
    if (Array.isArray(conflicts) && conflicts.length > 0) {
      return `Có ${conflicts.length} buổi khám bị xung đột lịch hẹn hoặc ngoài giờ làm việc. Vui lòng kiểm tra và chọn lại.`
    }
    return backendMsg || 'Có xung đột lịch hẹn trong liệu trình (buổi khám bị trùng hoặc ngoài ca làm việc).'
  }

  if (status === 400) {
    return backendMsg || 'Dữ liệu đặt lịch liệu trình không hợp lệ. Vui lòng kiểm tra lại thông tin.'
  }

  if (status === 404) {
    return backendMsg || 'Không tìm thấy thông tin bệnh nhân, bác sĩ hoặc bệnh án yêu cầu.'
  }

  return backendMsg || 'Đã xảy ra lỗi khi xử lý lịch hẹn theo liệu trình.'
}

export const canUserCreateSeries = (user) => {
  if (!user) return false
  const roles = (user.roles || []).map((r) => (typeof r === 'string' ? r.toUpperCase() : (r.code || r.name || '').toUpperCase()))
  const perms = (user.permissions || []).map((p) => (typeof p === 'string' ? p.toUpperCase() : (p.code || p.name || '').toUpperCase()))

  const isAdmin = roles.includes('ADMIN') || roles.includes('ROLE_ADMIN')
  const isReceptionist = roles.includes('RECEPTIONIST') || roles.includes('ROLE_RECEPTIONIST')
  const hasApptCreate = perms.includes('APPOINTMENT_CREATE') || isAdmin

  return (isAdmin || isReceptionist) && hasApptCreate
}
