import dayjs from 'dayjs'

export const REPORT_TYPES = [
  { value: 'VISIT_REPORT', label: 'Báo cáo lượt khám' },
  { value: 'REVENUE_REPORT', label: 'Báo cáo doanh thu' },
  { value: 'OPERATIONAL_REPORT', label: 'Báo cáo tổng hợp vận hành' },
  { value: 'ACCESS_LOG_REPORT', label: 'Báo cáo nhật ký truy cập hồ sơ bệnh án' },
]

export const REPORTS_WITH_IDENTIFYING_DATA = [
  'VISIT_REPORT',
  'OPERATIONAL_REPORT',
  'DOCTOR_VISITS_REPORT',
]

export const isIdentifyingReportType = (reportType) => {
  return REPORTS_WITH_IDENTIFYING_DATA.includes(reportType)
}

export const canUserExportUnmasked = (permissions) => {
  if (!Array.isArray(permissions)) return false
  return permissions.some(
    (p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, '') === 'REPORT_UNMASKED_EXPORT'
  )
}

export const validateUnmaskReason = (reason) => {
  if (reason === null || reason === undefined || !String(reason).trim()) {
    return {
      isValid: false,
      error: 'Vui lòng nhập lý do xuất bản dữ liệu đầy đủ.',
    }
  }
  const trimmed = String(reason).trim()
  if (trimmed.length < 5) {
    return {
      isValid: false,
      error: 'Lý do xuất bản dữ liệu đầy đủ phải có ít nhất 5 ký tự.',
    }
  }
  if (trimmed.length > 500) {
    return {
      isValid: false,
      error: 'Lý do xuất không được vượt quá 500 ký tự.',
    }
  }
  return {
    isValid: true,
    error: null,
    reason: trimmed,
  }
}

export const buildExportQueryParams = ({
  reportType,
  from,
  to,
  doctorId,
  unmask,
  reason,
  ...extra
} = {}) => {
  const isIdentifiable = isIdentifyingReportType(reportType)
  const isUnmasked = Boolean(isIdentifiable && unmask)

  const params = {
    reportType,
    from,
    to,
    ...extra,
  }

  if (doctorId) {
    params.doctorId = doctorId
  }

  if (isIdentifiable) {
    params.unmask = isUnmasked
    if (isUnmasked && reason) {
      params.reason = String(reason).trim()
    }
  }

  return params
}

export const validateExportParams = (arg1, arg2) => {
  let from = arg1
  let to = arg2
  if (arg1 && typeof arg1 === 'object' && !(arg1 instanceof Date) && !dayjs.isDayjs(arg1)) {
    from = arg1.from
    to = arg1.to
  }

  if (!from || !to) {
    const msg = 'Vui lòng chọn khoảng thời gian.'
    return {
      isValid: false,
      message: msg,
      errorMessage: msg,
    }
  }

  const fromDay = dayjs(from)
  const toDay = dayjs(to)

  if (!fromDay.isValid() || !toDay.isValid()) {
    const msg = 'Khoảng thời gian không hợp lệ.'
    return {
      isValid: false,
      message: msg,
      errorMessage: msg,
    }
  }

  if (fromDay.isAfter(toDay, 'day')) {
    const msg = 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'
    return {
      isValid: false,
      message: msg,
      errorMessage: msg,
    }
  }

  const daysDiff = toDay.diff(fromDay, 'day') + 1
  if (daysDiff > 366) {
    const msg = 'Khoảng thời gian xuất báo cáo không được vượt quá 366 ngày.'
    return {
      isValid: false,
      message: msg,
      errorMessage: msg,
    }
  }

  return {
    isValid: true,
    from: fromDay.format('YYYY-MM-DD'),
    to: toDay.format('YYYY-MM-DD'),
    message: null,
    errorMessage: null,
  }
}

export const getExportFilename = (arg1, arg2, arg3, arg4) => {
  let contentDisposition = null
  let reportType = null
  let fromVal = null
  let toVal = null

  if (arg4 !== undefined || (arg3 !== undefined && typeof arg2 === 'string')) {
    // Standard signature: (contentDisposition, reportType, from, to)
    contentDisposition = arg1
    reportType = arg2
    fromVal = arg3
    toVal = arg4
  } else {
    // 2-argument signature: (reportType, params) or (contentDisposition, reportType)
    if (typeof arg1 === 'string' && (arg1.includes('filename') || arg1.includes('attachment'))) {
      contentDisposition = arg1
      reportType = arg2
    } else {
      reportType = arg1
      if (arg2 && typeof arg2 === 'object') {
        fromVal = arg2.from
        toVal = arg2.to
      } else {
        fromVal = arg2
      }
    }
  }

  if (contentDisposition) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ''))
      } catch {
        // ignore decode failure and try standard match
      }
    }

    const standardMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
    if (standardMatch && standardMatch[1]) {
      return standardMatch[1].trim().replace(/^["']|["']$/g, '')
    }
  }

  const fromStr = String(fromVal || '')
  const toStr = String(toVal || '')

  switch (reportType) {
    case 'VISIT_REPORT':
      return `visit-report-${fromStr}-to-${toStr}.csv`
    case 'REVENUE_REPORT':
      return `revenue-report-${fromStr}-to-${toStr}.csv`
    case 'OPERATIONAL_REPORT':
      return `operational-report-${fromStr}-to-${toStr}.csv`
    case 'ACCESS_LOG_REPORT':
      return `access-log-report-${fromStr}-to-${toStr}.csv`
    default:
      return `report-${fromStr}-to-${toStr}.csv`
  }
}

export const downloadCsvBlob = (data, fileName) => {
  const blob = new Blob([data], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const getExportErrorMessage = async (error) => {
  let errorData = null

  if (error?.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text()
      errorData = JSON.parse(text)
    } catch {
      // ignore
    }
  } else if (error?.response?.data) {
    errorData = error.response.data
  }

  const status = error?.response?.status
  const errorCode = String(errorData?.code || errorData?.errorCode || '')
  const errorMsg = String(errorData?.message || '')

  if (status === 403) {
    if (errorMsg.includes('unmasked') || errorMsg.includes('REPORT_UNMASKED_EXPORT')) {
      return 'Bạn không có quyền xuất dữ liệu đầy đủ'
    }
    return 'Bạn không có quyền xuất báo cáo (Yêu cầu quyền ACCESS_LOG_REPORT_EXPORT của Quản trị viên).'
  }

  if (
    status === 404 ||
    status === 422 ||
    errorCode === 'REPORT_DATA_EMPTY' ||
    errorMsg.includes('No report data') ||
    errorMsg.includes('No medical record access logs available') ||
    errorMsg.toLowerCase().includes('không có dữ liệu')
  ) {
    return 'Không có dữ liệu nhật ký truy cập trong khoảng thời gian đã chọn.'
  }

  if (status === 400) {
    if (errorMsg.toLowerCase().includes('reason') || errorMsg.toLowerCase().includes('lý do')) {
      return errorMsg
    }
    return 'Khoảng thời gian không hợp lệ.'
  }

  return 'Không thể xuất báo cáo. Vui lòng thử lại.'
}
