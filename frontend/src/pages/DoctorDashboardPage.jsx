import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  AuditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  RedoOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Badge, Tag, Tooltip, notification } from 'antd'

import { useAuthContext } from '../context/AuthContext'
import doctorDashboardApi from '../api/doctorDashboardApi'
import {
  buildDoctorDeepLink,
  calculateDoctorDashboardSummary,
  findCurrentOrNextAppointment,
  formatAppointmentTime,
  formatRemainingOrOverdueTime,
  formatWaitTime,
  isClinicalResultAbnormal,
  mapAppointmentStatus,
  mapQueueStatus,
  sortPendingMedicalRecords,
} from '../utils/doctorDashboardHelpers'
import { getDoctorDisplayName } from '../utils/overdueMedicalRecordHelpers'
import '../styles/doctorDashboard.css'

const AUTO_REFRESH_INTERVAL_MS = 30_000

export default function DoctorDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthContext()

  // Doctor display name
  const [currentTime, setCurrentTime] = useState(dayjs())
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Block data states
  const [appointments, setAppointments] = useState([])
  const [queue, setQueue] = useState([])
  const [pendingRecords, setPendingRecords] = useState([])
  const [clinicalResults, setClinicalResults] = useState([])

  // Block loading states (independent per block)
  const [blockLoading, setBlockLoading] = useState({
    appointments: true,
    queue: true,
    pendingRecords: true,
    clinicalResults: true,
  })

  // Block error states (independent per block)
  const [blockErrors, setBlockErrors] = useState({
    appointments: null,
    queue: null,
    pendingRecords: null,
    clinicalResults: null,
  })

  const refreshTimerRef = useRef(null)
  const isMountedRef = useRef(true)

  // Doctor display name
  const doctorName = useMemo(() => {
    return getDoctorDisplayName(user?.id, [], user) || 'Bác sĩ'
  }, [user])

  // Fetch all dashboard data
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    }

    try {
      // Call aggregated doctor dashboard API
      const response = await doctorDashboardApi.getDoctorDashboard({
        date: dayjs().format('YYYY-MM-DD'),
      })

      if (!isMountedRef.current) return

      const data = response?.data || {}
      setAppointments(Array.isArray(data.appointments) ? data.appointments : [])
      setQueue(Array.isArray(data.queue) ? data.queue : [])
      setPendingRecords(Array.isArray(data.pendingMedicalRecords) ? data.pendingMedicalRecords : [])
      setClinicalResults(Array.isArray(data.newClinicalResults) ? data.newClinicalResults : [])

      setLastUpdatedAt(dayjs())
      setBlockLoading({
        appointments: false,
        queue: false,
        pendingRecords: false,
        clinicalResults: false,
      })
      setBlockErrors({
        appointments: null,
        queue: null,
        pendingRecords: null,
        clinicalResults: null,
      })
    } catch (err) {
      if (!isMountedRef.current) return
      // If full load failed, mark each block as error if previously empty
      const errMsg = err?.response?.data?.message || 'Không thể tải dữ liệu khối này'
      setBlockErrors((prev) => ({
        appointments: prev.appointments || errMsg,
        queue: prev.queue || errMsg,
        pendingRecords: prev.pendingRecords || errMsg,
        clinicalResults: prev.clinicalResults || errMsg,
      }))
      setBlockLoading({
        appointments: false,
        queue: false,
        pendingRecords: false,
        clinicalResults: false,
      })
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false)
      }
    }
  }, [])

  // Retry loading a single block
  const handleRetryBlock = useCallback(async (blockKey) => {
    setBlockLoading((prev) => ({ ...prev, [blockKey]: true }))
    setBlockErrors((prev) => ({ ...prev, [blockKey]: null }))

    try {
      if (blockKey === 'queue') {
        const res = await doctorDashboardApi.getMyQueue({ date: dayjs().format('YYYY-MM-DD') })
        if (isMountedRef.current) {
          setQueue(Array.isArray(res.data) ? res.data : [])
        }
      } else {
        // Re-call aggregated endpoint for the other blocks
        const res = await doctorDashboardApi.getDoctorDashboard({ date: dayjs().format('YYYY-MM-DD') })
        if (isMountedRef.current) {
          const d = res.data || {}
          if (blockKey === 'appointments') setAppointments(Array.isArray(d.appointments) ? d.appointments : [])
          if (blockKey === 'pendingRecords') setPendingRecords(Array.isArray(d.pendingMedicalRecords) ? d.pendingMedicalRecords : [])
          if (blockKey === 'clinicalResults') setClinicalResults(Array.isArray(d.newClinicalResults) ? d.newClinicalResults : [])
        }
      }
      setLastUpdatedAt(dayjs())
    } catch (err) {
      if (isMountedRef.current) {
        setBlockErrors((prev) => ({
          ...prev,
          [blockKey]: err?.response?.data?.message || 'Thử lại thất bại. Vui lòng kiểm tra kết nối.',
        }))
      }
    } finally {
      if (isMountedRef.current) {
        setBlockLoading((prev) => ({ ...prev, [blockKey]: false }))
      }
    }
  }, [])

  // Auto-refresh interval and clock ticking
  useEffect(() => {
    isMountedRef.current = true
    loadDashboardData()

    // Clock update every 15s to update wait durations accurately
    const clockInterval = setInterval(() => {
      setCurrentTime(dayjs())
    }, 15_000)

    // Auto-refresh every 30s
    refreshTimerRef.current = setInterval(() => {
      loadDashboardData()
    }, AUTO_REFRESH_INTERVAL_MS)

    return () => {
      isMountedRef.current = false
      clearInterval(clockInterval)
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [loadDashboardData])

  // Summary KPIs derived from block states
  const summary = useMemo(() => {
    return calculateDoctorDashboardSummary(appointments, queue, pendingRecords, clinicalResults)
  }, [appointments, queue, pendingRecords, clinicalResults])

  // Overdue notification check: notify doctor if there are overdue records
  useEffect(() => {
    if (summary.overdueSignaturesCount > 0) {
      // Show notification according to requirement: no full name or detailed health info
      notification.warning({
        key: 'overdue-signature-warning',
        message: 'Nhắc nhở ký bệnh án',
        description: `Bác sĩ có ${summary.overdueSignaturesCount} hồ sơ bệnh án đã quá thời hạn ký số. Vui lòng hoàn tất ký sớm.`,
        placement: 'bottomRight',
        duration: 8,
      })
    }
  }, [summary.overdueSignaturesCount])

  // Sorted appointments by startTime ascending
  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : 0
      const bTime = b.startTime ? new Date(b.startTime).getTime() : 0
      return aTime - bTime
    })
  }, [appointments])

  // Highlight current or next appointment
  const highlightedAppointmentId = useMemo(() => {
    return findCurrentOrNextAppointment(sortedAppointments, currentTime)
  }, [sortedAppointments, currentTime])

  // Sorted pending records (overdue first)
  const sortedPendingRecords = useMemo(() => {
    return sortPendingMedicalRecords(pendingRecords)
  }, [pendingRecords])

  // Filter waiting queue items
  const waitingQueueItems = useMemo(() => {
    return queue.filter((q) => {
      const s = String(q.status || '').toUpperCase()
      return s === 'WAITING' || s === 'CALLED'
    })
  }, [queue])

  // Deep navigation handler
  const handleItemClick = (type, item) => {
    const targetUrl = buildDoctorDeepLink(type, item)
    navigate(targetUrl)
  }

  return (
    <div className="doc-dashboard" aria-label="Bảng điều khiển dành cho bác sĩ">
      {/* Top Header */}
      <header className="doc-header">
        <div className="doc-header-info">
          <div className="doc-doctor-badge">
            <UserOutlined />
            <span>{doctorName}</span>
          </div>
          <h1>Bảng điều khiển Bác sĩ</h1>
          <p>Màn hình đầu ngày làm việc — Khởi đầu công việc và điều hướng nhanh</p>
        </div>

        <div className="doc-header-actions">
          <div className="doc-sync-meta">
            <small>Cập nhật lần cuối</small>
            <strong>
              {lastUpdatedAt ? lastUpdatedAt.format('HH:mm:ss') : 'Đang tải...'}
            </strong>
          </div>

          <button
            type="button"
            className="doc-refresh-btn"
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            aria-label="Làm mới bảng điều khiển"
          >
            <RedoOutlined spin={isRefreshing} />
            <span>Làm mới</span>
          </button>
        </div>
      </header>

      {/* 4 Summary KPI Cards */}
      <section className="doc-kpi-grid" aria-label="Các chỉ số tóm tắt">
        {/* Card 1: Today Appointments */}
        <div className="doc-kpi-card blue" id="kpi-appointments">
          <div className="doc-kpi-top">
            <div className="doc-kpi-icon">
              <CalendarOutlined />
            </div>
            <span className="doc-kpi-label">Lịch hẹn hôm nay</span>
          </div>
          <span className="doc-kpi-val">{summary.todayAppointmentsCount}</span>
          <div className="doc-kpi-sub">
            {summary.remainingAppointmentsCount > 0 ? (
              <span>Còn {summary.remainingAppointmentsCount} lượt chưa khám</span>
            ) : (
              <span className="doc-kpi-sub success">
                <CheckCircleOutlined /> Đã hoàn tất hôm nay
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Waiting Queue */}
        <div className="doc-kpi-card teal" id="kpi-queue">
          <div className="doc-kpi-top">
            <div className="doc-kpi-icon">
              <TeamOutlined />
            </div>
            <span className="doc-kpi-label">Đang chờ trong hàng đợi</span>
          </div>
          <span className="doc-kpi-val">{summary.waitingQueueCount}</span>
          <div className="doc-kpi-sub">
            {summary.waitingQueueCount > 0 ? (
              <span>Bệnh nhân có mặt tại phòng khám</span>
            ) : (
              <span>Hiện không có bệnh nhân chờ</span>
            )}
          </div>
        </div>

        {/* Card 3: Unsigned Medical Records */}
        <div
          className={`doc-kpi-card ${summary.overdueSignaturesCount > 0 ? 'rose' : 'amber'}`}
          id="kpi-unsigned-records"
        >
          <div className="doc-kpi-top">
            <div className="doc-kpi-icon">
              <AuditOutlined />
            </div>
            <span className="doc-kpi-label">Bệnh án chưa ký</span>
          </div>
          <span className="doc-kpi-val">{summary.pendingSignaturesCount}</span>
          <div className="doc-kpi-sub">
            {summary.overdueSignaturesCount > 0 ? (
              <span className="doc-kpi-sub danger">
                <WarningOutlined /> {summary.overdueSignaturesCount} bệnh án quá hạn ký
              </span>
            ) : (
              <span className="doc-kpi-sub success">
                <CheckCircleOutlined /> Trong thời hạn quy định
              </span>
            )}
          </div>
        </div>

        {/* Card 4: New Clinical Results */}
        <div className="doc-kpi-card violet" id="kpi-clinical-results">
          <div className="doc-kpi-top">
            <div className="doc-kpi-icon">
              <ExperimentOutlined />
            </div>
            <span className="doc-kpi-label">Kết quả cận lâm sàng mới</span>
          </div>
          <span className="doc-kpi-val">{summary.newClinicalResultsCount}</span>
          <div className="doc-kpi-sub">
            {summary.abnormalClinicalResultsCount > 0 ? (
              <span className="doc-kpi-sub danger">
                <ExclamationCircleOutlined /> {summary.abnormalClinicalResultsCount} kết quả bất thường
              </span>
            ) : (
              <span>Chưa có chỉ số bất thường</span>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Grid (4 Blocks) */}
      <main className="doc-content-grid">
        {/* BLOCK 1: Lịch khám hôm nay */}
        <section className="doc-block" aria-labelledby="block-appointments-title">
          <div className="doc-block-header">
            <div className="doc-block-title">
              <div className="doc-block-icon blue">
                <CalendarOutlined />
              </div>
              <h2 id="block-appointments-title">Lịch khám hôm nay</h2>
              <span className="doc-block-count active">{sortedAppointments.length}</span>
            </div>
            <span className="doc-block-hint">Theo giờ tăng dần</span>
          </div>

          <div className="doc-block-body">
            {blockLoading.appointments ? (
              <div className="doc-skeleton-container" aria-label="Đang tải lịch khám">
                <div className="doc-skeleton-row" />
                <div className="doc-skeleton-row" />
                <div className="doc-skeleton-row" />
              </div>
            ) : blockErrors.appointments ? (
              <div className="doc-block-error">
                <ExclamationCircleOutlined className="doc-block-error-icon" />
                <p>{blockErrors.appointments}</p>
                <button
                  type="button"
                  className="doc-retry-btn"
                  onClick={() => handleRetryBlock('appointments')}
                >
                  <RedoOutlined /> Thử lại
                </button>
              </div>
            ) : sortedAppointments.length === 0 ? (
              <div className="doc-block-empty">
                <div className="doc-empty-icon neutral">
                  <CalendarOutlined />
                </div>
                <p>Không có lịch khám nào trong hôm nay</p>
              </div>
            ) : (
              sortedAppointments.map((appt) => {
                const isHighlight = appt.appointmentId === highlightedAppointmentId
                const statusMeta = mapAppointmentStatus(appt.status)
                const timeText = formatAppointmentTime(appt.startTime, appt.endTime)

                return (
                  <div
                    key={appt.appointmentId}
                    className={`doc-list-item ${isHighlight ? 'highlight-current' : ''}`}
                    onClick={() => handleItemClick('appointment', appt)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleItemClick('appointment', appt)}
                    aria-label={`Mở lượt khám của ${appt.patientName || appt.patientCode}`}
                  >
                    <div className="doc-item-main">
                      <div className="doc-item-primary">
                        <span className="doc-item-name">{appt.patientName || 'Bệnh nhân'}</span>
                        {appt.patientCode && (
                          <span className="doc-item-code">{appt.patientCode}</span>
                        )}
                        {isHighlight && (
                          <Tag color="blue" className="doc-item-badge-pill">
                            {String(appt.status).toUpperCase() === 'IN_PROGRESS'
                              ? 'Đang diễn ra'
                              : 'Lượt kế tiếp'}
                          </Tag>
                        )}
                      </div>

                      <div className="doc-item-secondary">
                        <span className="doc-item-time">{timeText}</span>
                        {appt.reason && (
                          <span className="doc-item-reason" title={appt.reason}>
                            Lý do: {appt.reason}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="doc-item-meta">
                      <Badge
                        status={statusMeta.color === 'default' ? 'default' : statusMeta.color}
                        text={statusMeta.label}
                      />
                    </div>

                    <RightOutlined className="doc-item-arrow" />
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* BLOCK 2: Hàng đợi */}
        <section className="doc-block" aria-labelledby="block-queue-title">
          <div className="doc-block-header">
            <div className="doc-block-title">
              <div className="doc-block-icon teal">
                <TeamOutlined />
              </div>
              <h2 id="block-queue-title">Hàng đợi khám</h2>
              <span className="doc-block-count active">{waitingQueueItems.length}</span>
            </div>
            <span className="doc-block-hint">Theo thứ tự gọi số</span>
          </div>

          <div className="doc-block-body">
            {blockLoading.queue ? (
              <div className="doc-skeleton-container" aria-label="Đang tải hàng đợi">
                <div className="doc-skeleton-row" />
                <div className="doc-skeleton-row" />
                <div className="doc-skeleton-row" />
              </div>
            ) : blockErrors.queue ? (
              <div className="doc-block-error">
                <ExclamationCircleOutlined className="doc-block-error-icon" />
                <p>{blockErrors.queue}</p>
                <button
                  type="button"
                  className="doc-retry-btn"
                  onClick={() => handleRetryBlock('queue')}
                >
                  <RedoOutlined /> Thử lại
                </button>
              </div>
            ) : waitingQueueItems.length === 0 ? (
              <div className="doc-block-empty">
                <div className="doc-empty-icon neutral">
                  <TeamOutlined />
                </div>
                <p>Hàng đợi đang trống, hiện chưa có bệnh nhân chờ</p>
              </div>
            ) : (
              waitingQueueItems.map((item) => {
                const waitInfo = formatWaitTime(item.checkedInAt, currentTime)
                const isPriority = String(item.priority || '').toUpperCase() === 'EMERGENCY'
                const queueStatus = mapQueueStatus(item.status)

                return (
                  <div
                    key={item.queueItemId || item.visitId}
                    className="doc-list-item"
                    onClick={() => handleItemClick('queue', item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleItemClick('queue', item)}
                    aria-label={`Mở lượt khám số ${item.queueNumber}`}
                  >
                    <div
                      className={`doc-queue-num ${isPriority ? 'priority' : ''}`}
                      title={isPriority ? 'Ưu tiên' : `Số thứ tự ${item.queueNumber}`}
                    >
                      {item.queueNumber}
                    </div>

                    <div className="doc-item-main">
                      <div className="doc-item-primary">
                        <span className="doc-item-name">{item.patientName || 'Bệnh nhân'}</span>
                        {item.patientCode && (
                          <span className="doc-item-code">{item.patientCode}</span>
                        )}
                        {isPriority && (
                          <Tag color="error" className="doc-item-badge-pill">
                            Ưu tiên
                          </Tag>
                        )}
                      </div>

                      <div className="doc-item-secondary">
                        {item.roomNumber && <span>Phòng: {item.roomNumber}</span>}
                        <span
                          className={`doc-wait-badge ${waitInfo.isLongWait ? 'long-wait' : ''}`}
                        >
                          <ClockCircleOutlined />
                          {waitInfo.text}
                        </span>
                      </div>
                    </div>

                    <div className="doc-item-meta">
                      <Tag color={queueStatus.color}>{queueStatus.label}</Tag>
                    </div>

                    <RightOutlined className="doc-item-arrow" />
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* BLOCK 3: Bệnh án chờ ký */}
        <section className="doc-block" aria-labelledby="block-pending-records-title">
          <div className="doc-block-header">
            <div className="doc-block-title">
              <div className="doc-block-icon amber">
                <AuditOutlined />
              </div>
              <h2 id="block-pending-records-title">Bệnh án chờ ký</h2>
              <span
                className={`doc-block-count ${
                  summary.overdueSignaturesCount > 0 ? 'danger' : 'active'
                }`}
              >
                {sortedPendingRecords.length}
              </span>
            </div>
            <span className="doc-block-hint">Quá hạn đẩy lên đầu</span>
          </div>

          <div className="doc-block-body">
            {blockLoading.pendingRecords ? (
              <div className="doc-skeleton-container" aria-label="Đang tải bệnh án chờ ký">
                <div className="doc-skeleton-row" />
                <div className="doc-skeleton-row" />
                <div className="doc-skeleton-row" />
              </div>
            ) : blockErrors.pendingRecords ? (
              <div className="doc-block-error">
                <ExclamationCircleOutlined className="doc-block-error-icon" />
                <p>{blockErrors.pendingRecords}</p>
                <button
                  type="button"
                  className="doc-retry-btn"
                  onClick={() => handleRetryBlock('pendingRecords')}
                >
                  <RedoOutlined /> Thử lại
                </button>
              </div>
            ) : sortedPendingRecords.length === 0 ? (
              <div className="doc-block-empty">
                <div className="doc-empty-icon success">
                  <CheckCircleOutlined />
                </div>
                <p>Không có bệnh án nào chờ ký, bạn đã hoàn tất mọi việc</p>
              </div>
            ) : (
              sortedPendingRecords.map((record) => {
                const timeMeta = formatRemainingOrOverdueTime(record, currentTime)

                return (
                  <div
                    key={record.medicalRecordId || record.visitId}
                    className={`doc-list-item ${timeMeta.isOverdue ? 'overdue-item' : ''}`}
                    onClick={() => handleItemClick('medical_record', record)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleItemClick('medical_record', record)
                    }
                    aria-label={`Mở bệnh án của ${record.patientName || record.patientCode}`}
                  >
                    <div className="doc-item-main">
                      <div className="doc-item-primary">
                        <span className="doc-item-name">
                          {record.patientName || 'Bệnh nhân'}
                        </span>
                        {record.patientCode && (
                          <span className="doc-item-code">{record.patientCode}</span>
                        )}
                        {record.visitCode && (
                          <span className="doc-item-code">Lượt: {record.visitCode}</span>
                        )}
                      </div>

                      <div className="doc-item-secondary">
                        {record.visitCompletedAt && (
                          <span>
                            Khám xong:{' '}
                            {dayjs(record.visitCompletedAt).format('HH:mm DD/MM')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="doc-item-meta">
                      <Tag color={timeMeta.color}>{timeMeta.label}</Tag>
                    </div>

                    <RightOutlined className="doc-item-arrow" />
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* BLOCK 4: Kết quả cận lâm sàng mới */}
        <section className="doc-block" aria-labelledby="block-clinical-results-title">
          <div className="doc-block-header">
            <div className="doc-block-title">
              <div className="doc-block-icon violet">
                <ExperimentOutlined />
              </div>
              <h2 id="block-clinical-results-title">Kết quả cận lâm sàng mới</h2>
              <span
                className={`doc-block-count ${
                  summary.abnormalClinicalResultsCount > 0 ? 'danger' : 'active'
                }`}
              >
                {clinicalResults.length}
              </span>
            </div>
            <span className="doc-block-hint">Kết quả vừa có</span>
          </div>

          <div className="doc-block-body">
            {blockLoading.clinicalResults ? (
              <div className="doc-skeleton-container" aria-label="Đang tải kết quả cận lâm sàng">
                <div className="doc-skeleton-row" />
                <div className="doc-skeleton-row" />
                <div className="doc-skeleton-row" />
              </div>
            ) : blockErrors.clinicalResults ? (
              <div className="doc-block-error">
                <ExclamationCircleOutlined className="doc-block-error-icon" />
                <p>{blockErrors.clinicalResults}</p>
                <button
                  type="button"
                  className="doc-retry-btn"
                  onClick={() => handleRetryBlock('clinicalResults')}
                >
                  <RedoOutlined /> Thử lại
                </button>
              </div>
            ) : clinicalResults.length === 0 ? (
              <div className="doc-block-empty">
                <div className="doc-empty-icon neutral">
                  <ExperimentOutlined />
                </div>
                <p>Chưa có kết quả cận lâm sàng mới cần xử lý</p>
              </div>
            ) : (
              clinicalResults.map((result) => {
                const isAbnormal = isClinicalResultAbnormal(result)
                const resultTime = result.enteredAt
                  ? dayjs(result.enteredAt).format('HH:mm DD/MM')
                  : 'Vừa có'

                return (
                  <div
                    key={result.clinicalResultId || result.clinicalOrderItemId}
                    className={`doc-list-item ${isAbnormal ? 'abnormal-item' : ''}`}
                    onClick={() => handleItemClick('clinical_result', result)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleItemClick('clinical_result', result)
                    }
                    aria-label={`Mở kết quả ${result.serviceName || 'CĐLS'}`}
                  >
                    <div className="doc-item-main">
                      <div className="doc-item-primary">
                        <span className="doc-item-name">
                          {result.patientName || 'Bệnh nhân'}
                        </span>
                        {result.patientCode && (
                          <span className="doc-item-code">{result.patientCode}</span>
                        )}
                        {isAbnormal && (
                          <Tag color="error" className="doc-item-badge-pill">
                            Bất thường
                          </Tag>
                        )}
                      </div>

                      <div className="doc-item-secondary">
                        <span className="doc-item-reason" title={result.serviceName}>
                          {result.serviceName || result.serviceCode || 'Chỉ định CLS'}
                        </span>
                        <span>{resultTime}</span>
                      </div>
                    </div>

                    <div className="doc-item-meta">
                      {isAbnormal ? (
                        <Tag color="volcano">Cần chú ý</Tag>
                      ) : (
                        <Tag color="green">Bình thường</Tag>
                      )}
                    </div>

                    <RightOutlined className="doc-item-arrow" />
                  </div>
                )
              })
            )}
          </div>
        </section>
      </main>

      {/* Footnote Notice */}
      <footer className="doc-dashboard-footnote">
        <InfoCircleOutlined />
        <span>
          Bảng điều khiển cá nhân của bác sĩ đang đăng nhập. Nhấp vào từng mục để mở thẳng chi tiết
          lượt khám hoặc hồ sơ bệnh án. Việc ký số và kê đơn thực hiện trong màn hình bệnh án.
        </span>
      </footer>
    </div>
  )
}
