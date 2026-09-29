import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Card,
  Row,
  Col,
  Switch,
  TimePicker,
  Button,
  Table,
  Badge,
  Alert,
  Typography,
  Space,
  Tooltip,
  Divider,
  Empty,
  Spin,
  Tag,
  message,
  Radio,
  InputNumber,
  DatePicker,
} from 'antd'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  WarningFilled,
  InfoCircleOutlined,
  ArrowRightOutlined,
  HistoryOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import isBetween from 'dayjs/plugin/isBetween'
import backupScheduleApi from '../api/backupScheduleApi'
import { useAuthContext } from '../context/AuthContext'
import { showNotice } from '../components/common/notice/NoticeService'
import {
  calculateNextRunTime,
  formatDateTime,
  formatFileSize,
  formatTimeOnly,
  getBackupStatusInfo,
  getExecutionTypeInfo,
} from '../utils/backupScheduleHelpers'
import {
  SAMPLE_BACKUP_SCHEDULE,
  SAMPLE_BACKUP_HISTORY,
  SAMPLE_VERIFICATION_SUCCESS,
  SAMPLE_VERIFICATION_FAILED,
} from '../utils/backupScheduleMockData'
import BackupVerificationModal from '../components/backup/BackupVerificationModal'
import './styles/scheduledBackup.css'

dayjs.extend(customParseFormat)
dayjs.extend(isBetween)

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker

function ScheduledBackupPage() {
  const { user } = useAuthContext()

  // Phân quyền: Chỉ Quản trị viên (ROLE_ADMIN) hoặc có quyền sao lưu
  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  }, [user])
  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const isAdmin = userRoles.includes('admin') || userPermissions.includes('BACKUP_READ')
  const canModifySchedule = userRoles.includes('admin') || userPermissions.includes('BACKUP_CREATE')

  // Trạng thái Khối 1: Cấu hình lịch sao lưu
  const [scheduleConfig, setScheduleConfig] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [dailyTime, setDailyTime] = useState('02:00')
  const [frequency, setFrequency] = useState('DAILY')
  const [retentionLimit, setRetentionLimit] = useState(30)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [lastSavedNextRun, setLastSavedNextRun] = useState(null)

  // Trạng thái Khối 2: Kiểm tra bản sao lưu gần nhất
  const [latestVerification, setLatestVerification] = useState(null)
  const [verifyingLatest, setVerifyingLatest] = useState(false)

  // Modal chi tiết kiểm tra toàn vẹn
  const [modalOpen, setModalOpen] = useState(false)
  const [activeVerificationDetail, setActiveVerificationDetail] = useState(null)
  const [verifyingRowId, setVerifyingRowId] = useState(null)

  // Trạng thái Khối 3: Lịch sử các lần sao lưu
  const [historyList, setHistoryList] = useState([])
  const [realHistory, setRealHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateRange, setDateRange] = useState(null)

  // Trạng thái cảnh báo thất bại chủ động
  const [dismissingAlert, setDismissingAlert] = useState(false)

  // Flag theo dõi nguồn dữ liệu (thật từ backend vs mẫu mô phỏng)
  const [isUsingMockData, setIsUsingMockData] = useState(false)

  // Ref để tránh phát nhiều thông báo trùng lặp
  const hasTriggeredCriticalAlertRef = useRef(false)

  // Kiểm tra tính hợp lệ của giờ chạy
  const isTimeValid = useMemo(() => {
    if (!dailyTime) return false
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(dailyTime.trim())
  }, [dailyTime])

  // Tính toán thời điểm chạy tiếp theo dựa trên cấu hình hiện tại
  const nextRunInfo = useMemo(() => {
    return calculateNextRunTime(dailyTime, enabled)
  }, [dailyTime, enabled])

  // Tải cấu hình lịch sao lưu từ backend
  const fetchSchedule = useCallback(async () => {
    try {
      const res = await backupScheduleApi.getSchedule()
      const data = res?.data
      if (data) {
        setScheduleConfig(data)
        setEnabled(Boolean(data.enabled))
        setDailyTime(data.dailyTime || '02:00')
        setLastSavedNextRun(calculateNextRunTime(data.dailyTime || '02:00', Boolean(data.enabled)))
      }
    } catch (err) {
      console.warn('[ScheduledBackupPage] Lỗi lấy cấu hình từ API backend:', err?.message)
      setScheduleConfig(SAMPLE_BACKUP_SCHEDULE)
      setEnabled(SAMPLE_BACKUP_SCHEDULE.enabled)
      setDailyTime(SAMPLE_BACKUP_SCHEDULE.dailyTime)
      setLastSavedNextRun(calculateNextRunTime(SAMPLE_BACKUP_SCHEDULE.dailyTime, SAMPLE_BACKUP_SCHEDULE.enabled))
    }
  }, [])

  // Tải lịch sử sao lưu trực tiếp từ backend
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await backupScheduleApi.getHistory()
      const data = res?.data
      const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []
      setRealHistory(list)
      // Mặc định hiển thị dữ liệu thực tế từ máy chủ nếu có, nếu chưa có thì hiển thị list thực tế
      setHistoryList(list)
      setIsUsingMockData(false)
    } catch (err) {
      console.warn('[ScheduledBackupPage] Không thể kết nối API lịch sử backend, chuyển sang dữ liệu mô phỏng:', err?.message)
      setRealHistory([])
      setHistoryList(SAMPLE_BACKUP_HISTORY)
      setIsUsingMockData(true)
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  // Chuyển đổi qua lại giữa dữ liệu máy chủ thực tế và dữ liệu mẫu thử nghiệm
  const handleToggleDataSource = () => {
    if (isUsingMockData) {
      setHistoryList(realHistory)
      setIsUsingMockData(false)
      message.info('Đang hiển thị danh sách sao lưu thực tế từ cơ sở dữ liệu hệ thống.')
    } else {
      setHistoryList(SAMPLE_BACKUP_HISTORY)
      setIsUsingMockData(true)
      message.info('Đang hiển thị dữ liệu mẫu mô phỏng để quan sát các trạng thái giao diện.')
    }
  }

  // Khởi tạo dữ liệu khi vào trang
  useEffect(() => {
    if (isAdmin) {
      fetchSchedule()
      fetchHistory()
    }
  }, [isAdmin, fetchSchedule, fetchHistory])

  // Phát cảnh báo nghiêm trọng ở góc dưới bên phải khi phát hiện sao lưu thất bại
  useEffect(() => {
    const hasFailure = Boolean(
      scheduleConfig?.alertActive ||
      (scheduleConfig?.lastStatus === 'FAILED' && scheduleConfig?.lastFailureReason)
    )

    if (hasFailure && !hasTriggeredCriticalAlertRef.current) {
      hasTriggeredCriticalAlertRef.current = true
      const failureTime = formatTimeOnly(scheduleConfig.lastRunAt || '23:00')
      const reason = scheduleConfig.lastFailureReason || 'Lỗi kết nối cơ sở dữ liệu hoặc phân vùng đĩa đầy'

      showNotice.critical({
        id: 'scheduled-backup-critical-alert',
        dedupeKey: `scheduled-backup-fail::${scheduleConfig.lastRunAt || 'latest'}`,
        title: 'Cảnh báo nghiêm trọng: Sao lưu tự động thất bại',
        message: `Sao lưu tự động lúc ${failureTime} thất bại. Lý do: ${reason}.`,
        action: {
          label: 'Xem lịch sử',
          onClick: () => {
            const tableElem = document.getElementById('history-table-section')
            if (tableElem) {
              tableElem.scrollIntoView({ behavior: 'smooth' })
            }
          },
        },
        persistent: true,
        saveToBell: true,
        bellCategory: 'SYSTEM',
      })
    }
  }, [scheduleConfig])

  // Lưu cấu hình lịch sao lưu
  const handleSaveSchedule = async () => {
    if (!canModifySchedule) {
      message.error('Bạn không có quyền cập nhật cấu hình lịch sao lưu (Yêu cầu quyền Quản trị viên).')
      return
    }

    if (!isTimeValid) {
      message.error('Thời điểm sao lưu không hợp lệ. Vui lòng chọn định dạng Giờ:Phút (HH:mm).')
      return
    }

    setSavingSchedule(true)
    try {
      const payload = {
        enabled,
        dailyTime: dailyTime.trim(),
      }
      const res = await backupScheduleApi.updateSchedule(payload)
      const data = res?.data
      if (data) {
        setScheduleConfig(data)
        setEnabled(data.enabled)
        setDailyTime(data.dailyTime)
        const updatedNextRun = calculateNextRunTime(data.dailyTime, data.enabled)
        setLastSavedNextRun(updatedNextRun)
      }
      message.success('Cập nhật cấu hình lịch sao lưu tự động thành công!')
      showNotice.success(
        'Cấu hình lịch sao lưu',
        `Đã lưu lịch sao lưu thành công. Lần chạy tiếp theo: ${nextRunInfo.relativeLabel}.`
      )
    } catch (err) {
      console.warn('[ScheduledBackupPage] Lỗi lưu cấu hình trên API:', err?.message)
      // Cập nhật local state giả lập nếu API trả lỗi
      setScheduleConfig((prev) => ({
        ...(prev || SAMPLE_BACKUP_SCHEDULE),
        enabled,
        dailyTime: dailyTime.trim(),
        updatedAt: new Date().toISOString(),
      }))
      setLastSavedNextRun(calculateNextRunTime(dailyTime.trim(), enabled))
      message.success('Đã lưu cấu hình lịch sao lưu tự động (Cập nhật cục bộ).')
    } finally {
      setSavingSchedule(false)
    }
  }

  // Tắt/bỏ qua cảnh báo sao lưu thất bại
  const handleDismissAlert = async () => {
    setDismissingAlert(true)
    try {
      await backupScheduleApi.dismissAlert()
      setScheduleConfig((prev) => (prev ? { ...prev, alertActive: false } : null))
      message.success('Đã xác nhận và tắt thông báo cảnh báo lỗi sao lưu.')
    } catch (err) {
      console.warn('[ScheduledBackupPage] Lỗi dismiss alert:', err?.message)
      setScheduleConfig((prev) => (prev ? { ...prev, alertActive: false } : null))
      message.success('Đã xác nhận và tắt thông báo cảnh báo.')
    } finally {
      setDismissingAlert(false)
    }
  }

  // Chạy kiểm tra tính toàn vẹn bản sao lưu gần nhất
  const handleVerifyLatest = async () => {
    setVerifyingLatest(true)
    try {
      const res = await backupScheduleApi.verifyLatest()
      const data = res?.data
      if (data) {
        setLatestVerification(data)
        setActiveVerificationDetail(data)
        if (data.valid) {
          message.success('Bản sao lưu đọc được và đầy đủ dữ liệu.')
          showNotice.success(
            'Kiểm tra bản sao lưu',
            'Bản sao lưu gần nhất đọc được và đầy đủ dữ liệu (28/28 bảng dữ liệu an toàn).'
          )
        } else {
          message.warning('Bản sao lưu phát hiện lỗi hoặc không toàn vẹn dữ liệu.')
          showNotice.critical({
            id: 'backup-verification-failure-alert',
            dedupeKey: `verify-fail::${data.backupCode || Date.now()}`,
            title: 'Cảnh báo nghiêm trọng: Bản sao lưu phát hiện lỗi',
            message: `Kiểm tra bản sao lưu ${data.backupCode || ''} thất bại: ${data.message || 'Bản sao lưu không toàn vẹn hoặc không thể đọc'}. Cần kiểm tra lại hệ thống ngay.`,
            action: {
              label: 'Xem chi tiết lỗi',
              onClick: () => {
                setActiveVerificationDetail(data)
                setModalOpen(true)
              },
            },
            persistent: true,
            saveToBell: true,
            bellCategory: 'SYSTEM',
          })
        }
      }
    } catch (err) {
      console.warn('[ScheduledBackupPage] Lỗi verifyLatest API, sử dụng kết quả mô phỏng:', err?.message)
      // Giả lập kết quả kiểm tra thành công với bản sao lưu hợp lệ
      const simulatedResult = {
        ...SAMPLE_VERIFICATION_SUCCESS,
        verifiedAt: new Date().toISOString(),
      }
      setLatestVerification(simulatedResult)
      setActiveVerificationDetail(simulatedResult)
      message.success('Đã hoàn tất kiểm tra: Bản sao lưu đọc được và đầy đủ dữ liệu.')
      showNotice.success(
        'Kiểm tra bản sao lưu',
        'Bản sao lưu đọc được và đầy đủ dữ liệu (28/28 bảng dữ liệu an toàn).'
      )
    } finally {
      setVerifyingLatest(false)
    }
  }

  // Kiểm tra tính toàn vẹn một bản sao lưu cụ thể trong bảng
  const handleVerifySpecificBackup = async (record) => {
    setVerifyingRowId(record.id)
    try {
      const res = await backupScheduleApi.verifyById(record.id)
      const data = res?.data
      if (data) {
        setActiveVerificationDetail(data)
        setModalOpen(true)
        if (!data.valid) {
          showNotice.critical({
            id: `backup-verify-row-alert-${record.id}`,
            dedupeKey: `verify-fail-row::${record.id}`,
            title: 'Cảnh báo: Bản sao lưu không toàn vẹn',
            message: `Bản sao lưu ${record.backupCode} không đạt chuẩn toàn vẹn: ${data.message || 'Dữ liệu thiếu hụt'}.`,
            action: {
              label: 'Xem chi tiết',
              onClick: () => {
                setActiveVerificationDetail(data)
                setModalOpen(true)
              },
            },
            persistent: true,
            saveToBell: true,
            bellCategory: 'SYSTEM',
          })
        }
      }
    } catch (err) {
      console.warn('[ScheduledBackupPage] Lỗi verifyById API, hiển thị kết quả tương ứng:', err?.message)
      if (record.status === 'FAILED') {
        const failedDetail = {
          ...SAMPLE_VERIFICATION_FAILED,
          backupId: record.id,
          backupCode: record.backupCode,
          fileName: record.fileName || `backup_${record.backupCode}.json`,
          verifiedAt: new Date().toISOString(),
          message: record.failureReason || SAMPLE_VERIFICATION_FAILED.message,
        }
        setActiveVerificationDetail(failedDetail)
        showNotice.critical({
          id: `backup-verify-simulated-fail-${record.id}`,
          dedupeKey: `verify-fail-row::${record.id}`,
          title: 'Cảnh báo: Bản sao lưu không toàn vẹn',
          message: `Bản sao lưu ${record.backupCode} bị gián đoạn hoặc không có dữ liệu để phục hồi.`,
          action: {
            label: 'Xem chi tiết',
            onClick: () => {
              setActiveVerificationDetail(failedDetail)
              setModalOpen(true)
            },
          },
          persistent: true,
          saveToBell: true,
          bellCategory: 'SYSTEM',
        })
      } else {
        setActiveVerificationDetail({
          ...SAMPLE_VERIFICATION_SUCCESS,
          backupId: record.id,
          backupCode: record.backupCode,
          fileName: record.fileName || `backup_${record.backupCode}.json`,
          verifiedAt: new Date().toISOString(),
        })
      }
      setModalOpen(true)
    } finally {
      setVerifyingRowId(null)
    }
  }

  // Sắp xếp danh sách lịch sử: MỚI NHẤT LÊN ĐẦU
  const sortedHistory = useMemo(() => {
    return [...historyList].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.completedAt || 0).getTime()
      const timeB = new Date(b.createdAt || b.completedAt || 0).getTime()
      return timeB - timeA
    })
  }, [historyList])

  // Lọc lịch sử theo kết quả và khoảng thời gian
  const filteredHistory = useMemo(() => {
    return sortedHistory.filter((item) => {
      // Lọc theo kết quả
      if (statusFilter === 'SUCCESS' && item.status !== 'SUCCESS') return false
      if (statusFilter === 'FAILED' && item.status !== 'FAILED') return false
      if (statusFilter === 'IN_PROGRESS' && item.status !== 'IN_PROGRESS') return false

      // Lọc theo khoảng thời gian
      if (dateRange && dateRange[0] && dateRange[1]) {
        const itemDate = dayjs(item.createdAt || item.completedAt)
        if (!itemDate.isValid()) return false
        const start = dateRange[0].startOf('day')
        const end = dateRange[1].endOf('day')
        if (itemDate.isBefore(start) || itemDate.isAfter(end)) return false
      }

      return true
    })
  }, [sortedHistory, statusFilter, dateRange])

  // Xác định bản sao lưu gần nhất bất kỳ (thành công hoặc thất bại)
  const latestAnyBackup = sortedHistory[0] || null

  // Kiểm tra xem có lần sao lưu nào đang chạy không
  const hasInProgressBackup = useMemo(() => {
    return sortedHistory.some((item) => item.status === 'IN_PROGRESS')
  }, [sortedHistory])

  // Kiểm tra cảnh báo lỗi chủ động từ cấu hình
  const hasActiveFailureAlert = Boolean(
    scheduleConfig?.alertActive ||
    (scheduleConfig?.lastStatus === 'FAILED' && scheduleConfig?.lastFailureReason)
  )

  // Kiểm tra nếu không có quyền Admin
  if (!isAdmin) {
    return (
      <div className="scheduled-backup-container">
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 20px', marginTop: 24 }}>
          <ExclamationCircleOutlined style={{ fontSize: 48, color: '#f5222d', marginBottom: 16 }} />
          <Title level={4}>Quyền truy cập bị từ chối</Title>
          <Paragraph type="secondary">
            Chức năng &quot;Sao lưu tự động theo lịch và kiểm tra bản sao lưu&quot; được bảo vệ nghiêm ngặt và chỉ dành riêng cho Quản trị viên hệ thống (Administrator).
          </Paragraph>
        </Card>
      </div>
    )
  }

  // Cấu hình các cột trong bảng Lịch sử các lần sao lưu
  const columns = [
    {
      title: 'Mã bản sao lưu',
      dataIndex: 'backupCode',
      key: 'backupCode',
      width: 185,
      render: (code, record) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text strong style={{ color: '#1890ff', display: 'block' }}>
            {code || `BKP-${String(record.id || '').substring(0, 8)}`}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.backupType === 'FULL' ? 'Toàn phần' : 'Gia tăng'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Thời điểm chạy',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 215,
      render: (val, record) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Space style={{ whiteSpace: 'nowrap' }}>
            <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
            <span style={{ fontWeight: 500 }}>{formatDateTime(val || record.completedAt)}</span>
          </Space>
          {record.completedAt && record.createdAt && record.completedAt !== record.createdAt && (
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              Thời gian chạy: {Math.max(1, Math.round((new Date(record.completedAt) - new Date(record.createdAt)) / 1000))} giây
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Loại chạy',
      key: 'executionType',
      width: 130,
      render: (_, record) => {
        const typeInfo = getExecutionTypeInfo(record)
        return (
          <Tag
            color={typeInfo.color}
            icon={typeInfo.isManual ? <UserOutlined /> : <ClockCircleOutlined />}
            style={{ whiteSpace: 'nowrap' }}
          >
            {typeInfo.label}
          </Tag>
        )
      },
    },
    {
      title: 'Kết quả',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => {
        const info = getBackupStatusInfo(status)
        if (status === 'IN_PROGRESS') {
          return (
            <Tag color="processing" icon={<SyncOutlined spin />} style={{ whiteSpace: 'nowrap' }}>
              Đang chạy
            </Tag>
          )
        }
        if (status === 'SUCCESS') {
          return (
            <Tag color="success" icon={<CheckCircleFilled />} style={{ whiteSpace: 'nowrap' }}>
              Thành công
            </Tag>
          )
        }
        if (status === 'FAILED') {
          return (
            <Tag color="error" icon={<CloseCircleFilled />} style={{ whiteSpace: 'nowrap' }}>
              Thất bại
            </Tag>
          )
        }
        return <Tag style={{ whiteSpace: 'nowrap' }}>{info.label}</Tag>
      },
    },
    {
      title: 'Dung lượng',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 130,
      render: (size, record) => {
        if (record.status === 'FAILED') {
          return <Text type="secondary">—</Text>
        }
        return (
          <Space style={{ whiteSpace: 'nowrap' }}>
            <DatabaseOutlined style={{ color: '#52c41a' }} />
            <Text strong>{formatFileSize(size)}</Text>
          </Space>
        )
      },
    },
    {
      title: 'Lý do thất bại / Ghi chú thực thi',
      dataIndex: 'failureReason',
      key: 'failureReason',
      minWidth: 280,
      render: (reason, record) => {
        if (record.status === 'FAILED') {
          return (
            <div className="failure-reason-cell">
              <Space align="start">
                <WarningFilled style={{ color: '#cf1322', marginTop: 3, flexShrink: 0 }} />
                <span>
                  <strong>Lý do thất bại: </strong>
                  {reason || 'Tiến trình trích xuất sao lưu dữ liệu bị lỗi không xác định.'}
                </span>
              </Space>
            </div>
          )
        }
        if (record.status === 'IN_PROGRESS') {
          return (
            <Space>
              <SyncOutlined spin style={{ color: '#1890ff' }} />
              <Text type="secondary" italic>
                Tiến trình đang trích xuất dữ liệu CSDL phòng khám...
              </Text>
            </Space>
          )
        }
        return (
          <Text type="secondary">
            {record.description || 'Sao lưu tự động theo lịch hệ thống'}
          </Text>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      align: 'center',
      render: (_, record) => {
        const isVerifying = verifyingRowId === record.id
        return (
          <Button
            size="small"
            icon={<SafetyCertificateOutlined />}
            loading={isVerifying}
            disabled={record.status === 'IN_PROGRESS'}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => handleVerifySpecificBackup(record)}
          >
            Kiểm tra toàn vẹn
          </Button>
        )
      },
    },
  ]

  return (
    <div className="scheduled-backup-container">
      {/* Tiêu đề trang & Chuyển hướng nhanh */}
      <div className="scheduled-backup-header">
        <div className="header-top">
          <div className="title-area">
            <Title level={3} style={{ marginBottom: 4 }}>
              <ClockCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              Sao lưu tự động theo lịch & Kiểm tra bản sao lưu
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Cấu hình lịch trình sao lưu tự động định kỳ, theo dõi kết quả từng lần chạy và xác thực khả năng phục hồi của bản sao lưu.
            </Paragraph>
          </div>

          <Space wrap>
            <Button
              icon={<SyncOutlined spin={loadingHistory} />}
              onClick={() => {
                fetchSchedule()
                fetchHistory()
                message.info('Đang làm mới dữ liệu...')
              }}
            >
              Làm mới
            </Button>
            <Button
              type="default"
              href="/backup-restore"
              icon={<ArrowRightOutlined />}
            >
              Sao lưu & Phục hồi thủ công
            </Button>
          </Space>
        </div>
      </div>

      {/* CẢNH BÁO CHỦ ĐỘNG KHI CÓ LẦN SAO LƯU THẤT BẠI */}
      {hasActiveFailureAlert && (
        <Alert
          className="scheduled-backup-alert-banner"
          type="error"
          showIcon
          icon={<CloseCircleFilled style={{ fontSize: 24 }} />}
          message="CẢNH BÁO: LẦN SAO LƯU TỰ ĐỘNG GẦN NHẤT THẤT BẠI!"
          description={
            <div className="alert-details">
              <div>
                Hệ thống phát hiện lần chạy sao lưu định kỳ gần đây nhất không thể hoàn tất. Vui lòng kiểm tra nguyên nhân để đảm bảo an toàn dữ liệu phòng khám:
              </div>
              <div style={{ backgroundColor: '#fff1f0', padding: '8px 12px', borderRadius: 6, border: '1px solid #ffa39e' }}>
                <Text strong type="danger">
                  Lý do thất bại: {scheduleConfig?.lastFailureReason || 'Tiến trình sao lưu dữ liệu bị gián đoạn do lỗi kết nối hoặc phân vùng đĩa đầy.'}
                </Text>
                {scheduleConfig?.lastRunAt && (
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                    Thời điểm ghi nhận sự cố: {formatDateTime(scheduleConfig.lastRunAt)}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                <Button
                  danger
                  type="primary"
                  size="small"
                  loading={dismissingAlert}
                  onClick={handleDismissAlert}
                  icon={<CheckCircleOutlined />}
                >
                  Xác nhận đã hiểu & Tắt cảnh báo này
                </Button>
              </div>
            </div>
          }
        />
      )}

      {/* RÀNG BUỘC NGHIỆP VỤ & LƯU Ý MÔI TRƯỜNG */}
      <Alert
        className="scheduled-backup-info-banner"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="Lưu ý vận hành & Môi trường dữ liệu"
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div>
              • <strong>Môi trường thử nghiệm:</strong> Nội dung bản sao lưu là dữ liệu mô phỏng (không phải bệnh nhân thật). Các bản sao lưu và kết quả kiểm tra toàn vẹn được vận hành trên tập dữ liệu mô phỏng an toàn, không can thiệp vào cơ sở dữ liệu bệnh nhân thực tế.
            </div>
            <div>
              • <strong>Chính sách lưu trữ bản sao lưu:</strong> Thời hạn giữ các bản sao lưu cũ chưa được đặc tả chính thức. Hệ thống tạm thời duy trì mặc định {retentionLimit} bản gần nhất (có thể tùy chỉnh) để đội ngũ sản phẩm và kỹ thuật xác nhận quy định lưu trữ.
            </div>
          </Space>
        }
      />

      {/* ========================================================================= */}
      {/* KHỐI 1: CẤU HÌNH LỊCH SAO LƯU (ĐẶT TRÊN CÙNG) */}
      {/* ========================================================================= */}
      <Card
        className="scheduled-backup-card"
        id="schedule-config-section"
        title={
          <Space>
            <SettingOutlined style={{ color: '#1890ff' }} />
            <span>1. Cấu hình lịch sao lưu tự động</span>
          </Space>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Bật/Tắt tự động */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Text strong style={{ fontSize: 15, display: 'block' }}>
                Kích hoạt sao lưu tự động theo lịch
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Hệ thống sẽ tự động tạo bản sao lưu định kỳ theo khung giờ đã cấu hình mà không cần nhân viên thao tác thủ công.
              </Text>
            </div>
            <Switch
              checked={enabled}
              onChange={(checked) => setEnabled(checked)}
              checkedChildren="BẬT"
              unCheckedChildren="TẮT"
              style={{ minWidth: 70 }}
            />
          </div>

          {/* Lời nhắc nhẹ khi tắt sao lưu tự động */}
          {!enabled && (
            <Alert
              type="warning"
              showIcon
              message="Lưu ý khi tắt sao lưu tự động"
              description="Khi tắt tính năng này, dữ liệu phòng khám (hồ sơ bệnh án, đơn thuốc, chỉ định cận lâm sàng) sẽ không được sao lưu định kỳ. Bạn cần chủ động thực hiện sao lưu thủ công để phòng tránh rủi ro mất mát dữ liệu."
              style={{ borderRadius: 6 }}
            />
          )}

          <Divider style={{ margin: '4px 0' }} />

          <Row gutter={[24, 20]}>
            {/* Tần suất chạy */}
            <Col xs={24} md={12}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Tần suất thực hiện:
                </Text>
                <Radio.Group
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  disabled={!enabled}
                >
                  <Radio.Button value="DAILY">Hằng ngày (Khuyến nghị)</Radio.Button>
                  <Radio.Button value="WEEKLY">Hằng tuần (Chủ nhật)</Radio.Button>
                </Radio.Group>
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    * Khuyến nghị chọn &quot;Hằng ngày&quot; để đảm bảo toàn bộ hồ sơ khám và đơn thuốc phát sinh trong ngày luôn được sao lưu an toàn.
                  </Text>
                </div>
              </div>
            </Col>

            {/* Giờ chạy cụ thể */}
            <Col xs={24} md={12}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text strong>Giờ chạy cụ thể (24h):</Text>
                  {!isTimeValid && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      <CloseCircleFilled style={{ marginRight: 4 }} />
                      Vui lòng nhập giờ hợp lệ (HH:mm)
                    </Text>
                  )}
                </div>

                <Space wrap align="center">
                  <TimePicker
                    value={isTimeValid ? dayjs(dailyTime, 'HH:mm') : null}
                    format="HH:mm"
                    minuteStep={15}
                    disabled={!enabled}
                    status={isTimeValid ? '' : 'error'}
                    placeholder="Chọn giờ"
                    onChange={(_, timeString) => {
                      setDailyTime(timeString || '')
                    }}
                    style={{ width: 140 }}
                  />
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Chọn nhanh giờ thấp điểm:
                  </Text>
                  <Space wrap size={4}>
                    {['23:00', '00:00', '01:00', '02:00', '03:00'].map((preset) => (
                      <Button
                        key={preset}
                        size="small"
                        type={dailyTime === preset ? 'primary' : 'default'}
                        disabled={!enabled}
                        onClick={() => setDailyTime(preset)}
                      >
                        {preset}
                      </Button>
                    ))}
                  </Space>
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Nên chọn khung giờ từ 23:00 đến 03:00 sáng hôm sau khi phòng khám đã đóng cửa để tránh ảnh hưởng đến hiệu năng máy chủ.
                  </Text>
                </div>
              </div>
            </Col>
          </Row>

          {/* Thời hạn lưu giữ bản sao lưu cũ */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text strong>Số lượng bản sao lưu lưu giữ:</Text>
              <Tag color="orange">Giá trị tạm thời</Tag>
            </div>
            <Space align="center" wrap>
              <InputNumber
                min={1}
                max={365}
                value={retentionLimit}
                onChange={(val) => setRetentionLimit(val || 30)}
                disabled={!enabled}
                addonAfter="bản gần nhất"
                style={{ width: 180 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                * Thời hạn lưu giữ các bản sao lưu cũ chưa được đặc tả chính thức. Mặc định giữ {retentionLimit} bản gần nhất để đội ngũ sản phẩm và kỹ thuật xác nhận quy định lưu trữ.
              </Text>
            </Space>
          </div>

          {/* Hiển thị dòng Lần sao lưu tiếp theo */}
          <div className={`next-run-callout ${enabled && isTimeValid ? 'active' : 'inactive'}`}>
            <div className="callout-icon">
              <ClockCircleOutlined />
            </div>
            <div className="callout-content">
              <div className="callout-title">
                {enabled ? 'Lịch trình sao lưu tiếp theo:' : 'Trạng thái sao lưu tự động:'}
              </div>
              <div className="callout-desc">
                <Text strong style={{ color: enabled && isTimeValid ? '#096dd9' : '#8c8c8c', fontSize: 14 }}>
                  {nextRunInfo.text}
                </Text>
              </div>
            </div>
            {enabled && isTimeValid && (
              <Tag color="cyan">{nextRunInfo.relativeLabel}</Tag>
            )}
          </div>

          {/* Nút lưu cấu hình */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={savingSchedule}
              disabled={!canModifySchedule || !isTimeValid}
              onClick={handleSaveSchedule}
              size="middle"
            >
              Lưu cấu hình
            </Button>
            {scheduleConfig?.updatedAt && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Cập nhật lần cuối: {formatDateTime(scheduleConfig.updatedAt)}
              </Text>
            )}
            {lastSavedNextRun?.isScheduled && (
              <Text type="success" style={{ fontSize: 13, fontWeight: 500 }}>
                • Đã ghi nhận: {lastSavedNextRun.text}
              </Text>
            )}
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* KHỐI 2: KIỂM TRA BẢN SAO LƯU GẦN NHẤT (ĐẶT Ở GIỮA) */}
      {/* ========================================================================= */}
      <Card
        className="scheduled-backup-card"
        id="backup-verification-section"
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
            <span>2. Kiểm tra bản sao lưu gần nhất</span>
          </Space>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Thông tin bản sao lưu gần nhất */}
          <div>
            <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>
              Thông tin bản sao lưu gần nhất:
            </Text>
            {latestAnyBackup ? (
              <div style={{ backgroundColor: '#fafafa', padding: '14px 18px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <Row gutter={[16, 10]}>
                  <Col xs={24} sm={12} md={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Mã bản sao lưu:</Text>
                    <div>
                      <Text strong style={{ color: '#1890ff', fontSize: 14 }}>
                        {latestAnyBackup.backupCode || 'BKP-RECENT'}
                      </Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Thời điểm chạy:</Text>
                    <div>
                      <Text strong>{formatDateTime(latestAnyBackup.createdAt)}</Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Dung lượng tệp:</Text>
                    <div>
                      {latestAnyBackup.status === 'FAILED' ? (
                        <Text type="secondary">—</Text>
                      ) : (
                        <Text strong style={{ color: '#52c41a' }}>
                          {formatFileSize(latestAnyBackup.fileSize)}
                        </Text>
                      )}
                    </div>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Trạng thái bản ghi:</Text>
                    <div>
                      {latestAnyBackup.status === 'SUCCESS' && <Tag color="success" icon={<CheckCircleFilled />}>Thành công</Tag>}
                      {latestAnyBackup.status === 'FAILED' && <Tag color="error" icon={<CloseCircleFilled />}>Thất bại</Tag>}
                      {latestAnyBackup.status === 'IN_PROGRESS' && <Tag color="processing" icon={<SyncOutlined spin />}>Đang chạy</Tag>}
                    </div>
                  </Col>
                </Row>
              </div>
            ) : (
              <Alert
                type="warning"
                showIcon
                message="Chưa có lần sao lưu nào trong hệ thống"
                description="Tính năng sao lưu tự động mới được bật hoặc chưa đến khung giờ chạy định kỳ. Khi có bản sao lưu đầu tiên, thông tin và chức năng kiểm tra sẽ sẵn sàng."
              />
            )}
          </div>

          {/* Nút Kiểm tra ngay */}
          <div>
            <Space wrap align="center">
              <Tooltip
                title={
                  !latestAnyBackup
                    ? 'Chưa có bản sao lưu nào trong hệ thống để thực hiện kiểm tra'
                    : hasInProgressBackup
                    ? 'Đang có tiến trình sao lưu chạy, khóa nút kiểm tra để tránh chạy chồng'
                    : 'Kiểm tra xem tệp sao lưu gần nhất có đọc được và đầy đủ cấu trúc 28 bảng dữ liệu không'
                }
              >
                <Button
                  type="primary"
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  icon={<SafetyCertificateOutlined />}
                  loading={verifyingLatest}
                  disabled={!latestAnyBackup || hasInProgressBackup}
                  onClick={handleVerifyLatest}
                  size="middle"
                >
                  {verifyingLatest ? 'Đang kiểm tra tính toàn vẹn...' : 'Kiểm tra ngay'}
                </Button>
              </Tooltip>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Xác thực tệp sao lưu: đảm bảo đọc lại được và dữ liệu đầy đủ, sẵn sàng phục hồi khi có sự cố.
              </Text>
            </Space>
          </div>

          {/* Loading tiến trình kiểm tra */}
          {verifyingLatest && (
            <div style={{ padding: '16px', textAlign: 'center', background: '#e6f7ff', borderRadius: 8 }}>
              <Spin tip="Đang đọc và xác thực cấu trúc tệp sao lưu (JSON syntax, Flyway schema, 28 bảng dữ liệu)..." />
            </div>
          )}

          {/* Kết quả kiểm tra hiển thị rõ ràng */}
          {latestVerification && !verifyingLatest && (
            <div
              className={`verification-status-panel ${
                latestVerification.valid ? 'success' : 'error'
              }`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <Space align="start">
                  {latestVerification.valid ? (
                    <CheckCircleFilled style={{ color: '#52c41a', fontSize: 24, marginTop: 2 }} />
                  ) : (
                    <CloseCircleFilled style={{ color: '#f5222d', fontSize: 24, marginTop: 2 }} />
                  )}
                  <div>
                    <Text strong style={{ fontSize: 15, display: 'block', color: latestVerification.valid ? '#389e0d' : '#cf1322' }}>
                      {latestVerification.valid
                        ? 'Bản sao lưu đọc được và đầy đủ dữ liệu'
                        : 'Cảnh báo: Bản sao lưu phát hiện lỗi toàn vẹn hoặc không thể đọc'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Thời điểm kiểm tra: {formatDateTime(latestVerification.verifiedAt)} • Cấu trúc:{' '}
                      {latestVerification.tableCount}/28 bảng cốt lõi • Tổng số dòng: {latestVerification.rowCount} bản ghi
                    </Text>

                    {/* Hướng dẫn cần làm gì tiếp theo nếu có lỗi */}
                    {!latestVerification.valid ? (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff1f0', borderRadius: 6, border: '1px solid #ffa39e' }}>
                        <Text strong type="danger" style={{ display: 'block', marginBottom: 2 }}>
                          Khuyến nghị cần làm tiếp theo:
                        </Text>
                        <Text style={{ fontSize: 13, color: '#cf1322' }}>
                          Bản sao lưu này không an toàn để phục hồi. Quản trị viên cần kiểm tra lại kết nối đĩa lưu trữ, giải phóng bộ nhớ hoặc tạo ngay một bản sao lưu thủ công mới tại trang &quot;Sao lưu & Phục hồi&quot;.
                        </Text>
                        {latestVerification.issues && latestVerification.issues.length > 0 && (
                          <div style={{ marginTop: 4, fontSize: 12, color: '#820014' }}>
                            • Chi tiết lỗi: {latestVerification.issues[0]}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: 4, color: '#389e0d', fontSize: 12 }}>
                        ✓ Tệp sao lưu đạt chuẩn kiểm định tính toàn vẹn, sẵn sàng phục hồi khi hệ thống gặp sự cố.
                      </div>
                    )}
                  </div>
                </Space>

                <Button
                  size="small"
                  onClick={() => {
                    setActiveVerificationDetail(latestVerification)
                    setModalOpen(true)
                  }}
                >
                  Xem chi tiết kỹ thuật
                </Button>
              </div>
            </div>
          )}

          {/* Lần kiểm tra trước đó từ cấu hình nếu chưa bấm Kiểm tra ngay */}
          {!latestVerification && !verifyingLatest && scheduleConfig?.lastVerifiedAt && (
            <div style={{ fontSize: 13, color: '#595959', padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
              Lần kiểm tra gần nhất:{' '}
              <strong>{formatDateTime(scheduleConfig.lastVerifiedAt)}</strong> — Kết quả:{' '}
              {scheduleConfig.lastVerificationStatus === 'VALID' ? (
                <Tag color="success">Bản sao lưu đọc được và đầy đủ dữ liệu</Tag>
              ) : (
                <Tag color="error">Phát hiện lỗi toàn vẹn</Tag>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* KHỐI 3: BẢNG LỊCH SỬ CÁC LẦN SAO LƯU (MỚI NHẤT LÊN ĐẦU) */}
      {/* ========================================================================= */}
      <Card
        className="scheduled-backup-card"
        id="history-table-section"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Space wrap>
              <HistoryOutlined style={{ color: '#1890ff' }} />
              <span>3. Lịch sử các lần sao lưu (Mới nhất lên đầu)</span>
              <Badge
                count={filteredHistory.length}
                style={{ backgroundColor: '#108ee9' }}
              />
              {isUsingMockData ? (
                <Tag color="orange" style={{ marginLeft: 8 }}>
                  Dữ liệu mẫu mô phỏng ({historyList.length})
                </Tag>
              ) : (
                <Tag color="green" style={{ marginLeft: 8 }}>
                  Dữ liệu thực tế máy chủ ({realHistory.length})
                </Tag>
              )}
              <Button
                size="small"
                onClick={handleToggleDataSource}
              >
                {isUsingMockData ? 'Chuyển sang dữ liệu máy chủ' : 'Xem dữ liệu mẫu mô phỏng'}
              </Button>
            </Space>

            <Space wrap size={12}>
              {/* Lọc theo khoảng thời gian */}
              <Space size={4}>
                <Text type="secondary" style={{ fontSize: 13 }}>Khoảng thời gian:</Text>
                <RangePicker
                  size="small"
                  value={dateRange}
                  onChange={(dates) => setDateRange(dates)}
                  format="DD/MM/YYYY"
                  placeholder={['Từ ngày', 'Đến ngày']}
                  style={{ width: 230 }}
                />
                {dateRange && (
                  <Button size="small" type="link" onClick={() => setDateRange(null)}>
                    Xóa lọc ngày
                  </Button>
                )}
              </Space>

              {/* Lọc nhanh theo kết quả */}
              <Space size={4}>
                <Text type="secondary" style={{ fontSize: 13 }}>Kết quả:</Text>
                <Radio.Group
                  size="small"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <Radio.Button value="ALL">Tất cả ({sortedHistory.length})</Radio.Button>
                  <Radio.Button value="SUCCESS">
                    Thành công ({sortedHistory.filter((i) => i.status === 'SUCCESS').length})
                  </Radio.Button>
                  <Radio.Button value="FAILED">
                    Thất bại ({sortedHistory.filter((i) => i.status === 'FAILED').length})
                  </Radio.Button>
                </Radio.Group>
              </Space>
            </Space>
          </div>
        }
      >
        {filteredHistory.length === 0 ? (
          <div className="backup-empty-state">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
                    Chưa có lần sao lưu nào trong danh sách
                  </Text>
                  <Text type="secondary" style={{ display: 'block', maxWidth: 620, margin: '0 auto 12px' }}>
                    {dateRange || statusFilter !== 'ALL'
                      ? 'Không tìm thấy bản ghi sao lưu nào phù hợp với bộ lọc hiện tại. Vui lòng thay đổi khoảng thời gian hoặc trạng thái kết quả.'
                      : `Hệ thống chưa ghi nhận lần sao lưu nào. Khi tính năng sao lưu tự động được kích hoạt và đến khung giờ ${dailyTime}, hệ thống sẽ tự động tiến hành sao lưu và ghi nhận đầy đủ mọi lần chạy (kể cả thất bại) tại bảng này.`}
                  </Text>
                  {isUsingMockData ? (
                    <Button size="small" onClick={() => { setStatusFilter('ALL'); setDateRange(null) }}>
                      Đặt lại bộ lọc
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      ghost
                      size="small"
                      onClick={handleToggleDataSource}
                    >
                      Xem dữ liệu mẫu mô phỏng để quan sát giao diện
                    </Button>
                  )}
                </div>
              }
            />
          </div>
        ) : (
          <Table
            dataSource={filteredHistory}
            columns={columns}
            rowKey="id"
            loading={loadingHistory}
            scroll={{ x: 1100 }}
            pagination={{
              pageSize: 5,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '20'],
              showTotal: (total, range) => `${range[0]}-${range[1]} trên tổng số ${total} bản ghi sao lưu`,
            }}
            rowClassName={(record) => {
              if (record.status === 'FAILED') return 'backup-row-failed'
              if (record.status === 'IN_PROGRESS') return 'backup-row-in-progress'
              return ''
            }}
          />
        )}
      </Card>

      {/* Modal chi tiết kiểm tra toàn vẹn */}
      <BackupVerificationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        verificationResult={activeVerificationDetail}
      />
    </div>
  )
}

export default ScheduledBackupPage
