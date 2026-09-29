import dayjs from 'dayjs'

/**
 * Format patient waiting duration in queue.
 * @param {string|Date} checkedInAt
 * @param {Date|dayjs.Dayjs} [now]
 * @returns {{ text: string, minutes: number, isLongWait: boolean }}
 */
export const formatWaitTime = (checkedInAt, now = dayjs()) => {
  if (!checkedInAt) {
    return { text: 'Chưa xác định', minutes: 0, isLongWait: false }
  }

  const checkIn = dayjs(checkedInAt)
  const current = dayjs(now)
  const minutes = Math.max(0, current.diff(checkIn, 'minute'))

  let text = ''
  if (minutes < 1) {
    text = 'Vừa mới đến'
  } else if (minutes < 60) {
    text = `Đã chờ ${minutes} phút`
  } else {
    const hours = Math.floor(minutes / 60)
    const remMin = minutes % 60
    text = remMin > 0 ? `Đã chờ ${hours}h ${remMin}p` : `Đã chờ ${hours} giờ`
  }

  // Waiting longer than 30 minutes is marked as long wait
  const isLongWait = minutes >= 30

  return { text, minutes, isLongWait }
}

/**
 * Format appointment time display.
 * @param {string|Date} startTime
 * @param {string|Date} [endTime]
 * @returns {string}
 */
export const formatAppointmentTime = (startTime, endTime) => {
  if (!startTime) return '--:--'
  const start = dayjs(startTime).format('HH:mm')
  if (!endTime) return start
  const end = dayjs(endTime).format('HH:mm')
  return `${start} - ${end}`
}

/**
 * Map appointment status to Vietnamese display label and AntD badge color.
 * @param {string} status
 * @returns {{ label: string, color: string, isDone: boolean }}
 */
export const mapAppointmentStatus = (status) => {
  const raw = String(status || '').toUpperCase()
  switch (raw) {
    case 'PENDING':
    case 'CONFIRMED':
      return { label: 'Chưa đến', color: 'default', isDone: false }
    case 'CHECKED_IN':
      return { label: 'Đã đến', color: 'blue', isDone: false }
    case 'IN_PROGRESS':
      return { label: 'Đang khám', color: 'processing', isDone: false }
    case 'COMPLETED':
      return { label: 'Đã khám', color: 'success', isDone: true }
    case 'CANCELLED':
      return { label: 'Đã hủy', color: 'error', isDone: true }
    case 'NO_SHOW':
      return { label: 'Vắng mặt', color: 'warning', isDone: true }
    default:
      return { label: raw || 'Chưa khám', color: 'default', isDone: false }
  }
}

/**
 * Map queue item status to display label and badge color.
 * @param {string} status
 * @returns {{ label: string, color: string }}
 */
export const mapQueueStatus = (status) => {
  const raw = String(status || '').toUpperCase()
  switch (raw) {
    case 'WAITING':
      return { label: 'Đang chờ', color: 'gold' }
    case 'CALLED':
      return { label: 'Đã gọi vào', color: 'cyan' }
    case 'IN_PROGRESS':
      return { label: 'Đang khám', color: 'processing' }
    case 'WAITING_FOR_RESULT':
      return { label: 'Chờ kết quả', color: 'purple' }
    case 'COMPLETED':
      return { label: 'Đã xong', color: 'success' }
    case 'SKIPPED':
      return { label: 'Đã qua lượt', color: 'default' }
    case 'CANCELLED':
      return { label: 'Đã hủy', color: 'error' }
    default:
      return { label: raw || 'Chờ khám', color: 'default' }
  }
}

/**
 * Find the current or next appointment to highlight.
 * @param {Array} appointments
 * @returns {string|null} appointmentId
 */
export const findCurrentOrNextAppointment = (appointments = []) => {
  if (!Array.isArray(appointments) || appointments.length === 0) return null

  // 1. Look for currently active appointment (IN_PROGRESS)
  const inProgress = appointments.find(
    (a) => String(a.status).toUpperCase() === 'IN_PROGRESS'
  )
  if (inProgress) return inProgress.appointmentId

  // 2. Look for checked-in patient next
  const checkedIn = appointments.find(
    (a) => String(a.status).toUpperCase() === 'CHECKED_IN'
  )
  if (checkedIn) return checkedIn.appointmentId

  // 3. Otherwise pick the earliest upcoming confirmed/pending appointment
  const upcoming = appointments.find((a) => {
    const s = String(a.status).toUpperCase()
    return s !== 'COMPLETED' && s !== 'CANCELLED' && s !== 'NO_SHOW'
  })

  return upcoming ? upcoming.appointmentId : null
}

/**
 * Sort pending medical records: overdue first (sorted by overdueHours desc), then pending by deadline asc.
 * @param {Array} records
 * @returns {Array}
 */
export const sortPendingMedicalRecords = (records = []) => {
  if (!Array.isArray(records)) return []
  return [...records].sort((a, b) => {
    const aOverdue = Boolean(a.isOverdue)
    const bOverdue = Boolean(b.isOverdue)

    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1

    if (aOverdue && bOverdue) {
      const aHours = Number(a.overdueHours) || 0
      const bHours = Number(b.overdueHours) || 0
      return bHours - aHours
    }

    // Both not overdue: sort by deadline ascending (soonest deadline first)
    const aDeadline = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Infinity
    const bDeadline = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Infinity
    return aDeadline - bDeadline
  })
}

/**
 * Format remaining deadline or overdue hours for a medical record.
 * @param {Object} record
 * @param {Date|dayjs.Dayjs} [now]
 * @returns {{ isOverdue: boolean, label: string, color: string, badgeType: string }}
 */
export const formatRemainingOrOverdueTime = (record, now = dayjs()) => {
  if (!record) return { isOverdue: false, label: '', color: 'default', badgeType: 'default' }

  if (record.isOverdue) {
    const hours = Number(record.overdueHours) || 0
    let label = ''
    if (hours < 24) {
      label = `Quá hạn ${hours} giờ`
    } else {
      const days = Math.floor(hours / 24)
      const rem = hours % 24
      label = rem > 0 ? `Quá hạn ${days} ngày ${rem}h` : `Quá hạn ${days} ngày`
    }

    let color = 'orange'
    let badgeType = 'warning'
    if (hours >= 72) {
      color = '#cf1322'
      badgeType = 'error'
    } else if (hours >= 24) {
      color = '#d4380d'
      badgeType = 'error'
    }

    return { isOverdue: true, label, color, badgeType }
  }

  // Not overdue yet: calculate remaining time from deadlineAt
  if (record.deadlineAt) {
    const deadline = dayjs(record.deadlineAt)
    const current = dayjs(now)
    const remainingHours = Math.max(0, deadline.diff(current, 'hour'))
    const remainingMins = Math.max(0, deadline.diff(current, 'minute')) % 60

    if (remainingHours <= 0 && remainingMins <= 0) {
      return { isOverdue: true, label: 'Sắp hết hạn', color: '#d48806', badgeType: 'warning' }
    }

    const label = remainingHours > 0
      ? `Còn ${remainingHours} giờ`
      : `Còn ${remainingMins} phút`

    return { isOverdue: false, label, color: '#1677ff', badgeType: 'processing' }
  }

  return { isOverdue: false, label: 'Trong hạn ký', color: '#52c41a', badgeType: 'success' }
}

/**
 * Determine if clinical result is abnormal.
 * @param {Object} result
 * @returns {boolean}
 */
export const isClinicalResultAbnormal = (result) => {
  if (!result) return false
  const flag = String(result.abnormalFlag || '').toUpperCase()
  if (flag === 'ABNORMAL' || flag === 'HIGH' || flag === 'LOW') {
    return true
  }
  const status = String(result.status || '').toUpperCase()
  return status === 'ABNORMAL'
}

/**
 * Calculate doctor dashboard summary metrics.
 * @param {Array} appointments
 * @param {Array} queue
 * @param {Array} pendingMedicalRecords
 * @param {Array} clinicalResults
 * @returns {Object}
 */
export const calculateDoctorDashboardSummary = (
  appointments = [],
  queue = [],
  pendingMedicalRecords = [],
  clinicalResults = []
) => {
  const safeAppts = Array.isArray(appointments) ? appointments : []
  const safeQueue = Array.isArray(queue) ? queue : []
  const safeRecords = Array.isArray(pendingMedicalRecords) ? pendingMedicalRecords : []
  const safeResults = Array.isArray(clinicalResults) ? clinicalResults : []

  const validAppointments = safeAppts.filter(
    (a) => String(a.status).toUpperCase() !== 'CANCELLED'
  )
  const remainingAppointments = validAppointments.filter(
    (a) => String(a.status).toUpperCase() !== 'COMPLETED'
  )

  const waitingQueue = safeQueue.filter(
    (q) => String(q.status).toUpperCase() === 'WAITING'
  )

  const overdueRecords = safeRecords.filter((r) => Boolean(r.isOverdue))

  const abnormalResults = safeResults.filter((r) => isClinicalResultAbnormal(r))

  return {
    todayAppointmentsCount: validAppointments.length,
    remainingAppointmentsCount: remainingAppointments.length,
    waitingQueueCount: waitingQueue.length,
    pendingSignaturesCount: safeRecords.length,
    overdueSignaturesCount: overdueRecords.length,
    newClinicalResultsCount: safeResults.length,
    abnormalClinicalResultsCount: abnormalResults.length,
  }
}

/**
 * Build deep link URL for each item on the dashboard.
 * Ensures direct navigation to the exact record/visit, never to generic list page.
 * @param {'appointment'|'queue'|'medical_record'|'clinical_result'} type
 * @param {Object} item
 * @returns {string}
 */
export const buildDoctorDeepLink = (type, item) => {
  if (!item) return '/medical-records'

  switch (type) {
    case 'appointment': {
      if (item.visitId) {
        return `/medical-records/visits/${item.visitId}`
      }
      const params = new URLSearchParams()
      if (item.appointmentId) params.set('appointmentId', item.appointmentId)
      if (item.patientId) params.set('patientId', item.patientId)
      const q = params.toString()
      return q ? `/medical-records?${q}` : '/medical-records'
    }

    case 'queue': {
      if (item.visitId) {
        return `/medical-records/visits/${item.visitId}`
      }
      const params = new URLSearchParams()
      if (item.queueItemId) params.set('queueItemId', item.queueItemId)
      if (item.patientId) params.set('patientId', item.patientId)
      const q = params.toString()
      return q ? `/medical-records?${q}` : '/medical-records'
    }

    case 'medical_record': {
      if (item.visitId) {
        return `/medical-records/visits/${item.visitId}`
      }
      if (item.medicalRecordId) {
        return `/medical-records?recordId=${item.medicalRecordId}`
      }
      return '/medical-records/overdue-signing'
    }

    case 'clinical_result': {
      if (item.visitId) {
        return `/medical-records/visits/${item.visitId}?tab=results`
      }
      if (item.patientId) {
        return `/medical-records?patientId=${item.patientId}&tab=results`
      }
      return '/clinical-results'
    }

    default:
      return '/medical-records'
  }
}
