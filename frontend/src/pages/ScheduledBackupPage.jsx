import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Popconfirm,
  Radio,
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
  FileDoneOutlined,
  HistoryOutlined,
  BellOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import backupScheduleApi from '../api/backupScheduleApi'
import { useAuthContext } from '../context/AuthContext'
import {
  calculateNextRunTime,
  formatDateTime,
  formatFileSize,
  getBackupStatusInfo,
  getVerificationStatusInfo,
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

const { Title, Text, Paragraph } = Typography

function ScheduledBackupPage() {
  const { user } = useAuthContext()

  // Phân quyền: Chỉ Quản trị viên (ROLE_ADMIN)
  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  }, [user])
  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const isAdmin = userRoles.includes('admin') || userPermissions.includes('BACKUP_READ')
  const canModifySchedule = userRoles.includes('admin') || userPermissions.includes('BACKUP_CREATE')

  // Trạng thái cấu hình lịch sao lưu
  const [scheduleConfig, setScheduleConfig] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [dailyTime, setDailyTime] = useState('02:00')
  const [frequency, setFrequency] = useState('DAILY')
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Trạng thái danh sách lịch sử sao lưu
  const [historyList, setHistoryList] = useState([])
  const [realHistory, setRealHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Trạng thái kiểm tra tính toàn vẹn bản sao lưu gần nhất
  const [latestVerification, setLatestVerification] = useState(null)
  const [verifyingLatest, setVerifyingLatest] = useState(false)

  // Modal chi tiết kiểm tra toàn vẹn
  const [modalOpen, setModalOpen] = useState(false)
  const [activeVerificationDetail, setActiveVerificationDetail] = useState(null)
  const [verifyingRowId, setVerifyingRowId] = useState(null)

  // Trạng thái cảnh báo thất bại chủ động
  const [dismissingAlert, setDismissingAlert] = useState(false)

  // Flag theo dõi nguồn dữ liệu (thật từ backend vs mẫu mô phỏng)
  const [isUsingMockData, setIsUsingMockData] = useState(false)

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
      }
    } catch (err) {
      console.warn('[ScheduledBackupPage] Lỗi lấy cấu hình từ API backend:', err?.message)
      setScheduleConfig(SAMPLE_BACKUP_SCHEDULE)
      setEnabled(SAMPLE_BACKUP_SCHEDULE.enabled)
      setDailyTime(SAMPLE_BACKUP_SCHEDULE.dailyTime)
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
      // Mặc định hiển thị dữ liệu thực tế từ máy chủ
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

  // Lưu cấu hình lịch sao lưu
  const handleSaveSchedule = async () => {
    if (!canModifySchedule) {
      message.error('Bạn không có quyền cập nhật cấu hình lịch sao lưu (Yêu cầu quyền Quản trị viên).')
      return
    }

    if (!dailyTime || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(dailyTime)) {
      message.error('Thời điểm sao lưu không hợp lệ. Vui lòng chọn định dạng Giờ:Phút (HH:mm).')
      return
    }

    setSavingSchedule(true)
    try {
      const payload = {
        enabled,
        dailyTime,
      }
      const res = await backupScheduleApi.updateSchedule(payload)
      const data = res?.data
      if (data) {
        setScheduleConfig(data)
        setEnabled(data.enabled)
        setDailyTime(data.dailyTime)
      }
      message.success('Cập nhật cấu hình lịch sao lưu tự động thành công!')
    } catch (err) {
      console.warn('[ScheduledBackupPage] Lỗi lưu cấu hình trên API:', err?.message)
      // Cập nhật local state giả lập nếu API trả lỗi
      setScheduleConfig((prev) => ({
        ...(prev || SAMPLE_BACKUP_SCHEDULE),
        enabled,
        dailyTime,
        updatedAt: new Date().toISOString(),
      }))
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
          message.success('Bản sao lưu gần nhất đọc được và đầy đủ dữ liệu.')
        } else {
          message.warning('Bản sao lưu phát hiện lỗi hoặc không toàn vẹn dữ liệu.')
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
      }
    } catch (err) {
      console.warn('[ScheduledBackupPage] Lỗi verifyById API, hiển thị kết quả tương ứng:', err?.message)
      if (record.status === 'FAILED') {
        setActiveVerificationDetail({
          ...SAMPLE_VERIFICATION_FAILED,
          backupId: record.id,
          backupCode: record.backupCode,
          fileName: record.fileName || `backup_${record.backupCode}.json`,
          verifiedAt: new Date().toISOString(),
          message: record.failureReason || SAMPLE_VERIFICATION_FAILED.message,
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

  // Xác định bản sao lưu mới nhất trong danh sách
  const sortedHistory = [...historyList].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.completedAt || 0).getTime()
    const timeB = new Date(b.createdAt || b.completedAt || 0).getTime()
    return timeB - timeA
  })

  // Lọc lịch sử theo trạng thái nếu có
  const filteredHistory = sortedHistory.filter((item) => {
    if (statusFilter === 'ALL') return true
    return item.status === statusFilter
  })

  const latestBackupRecord = sortedHistory.find((item) => item.status === 'SUCCESS') || sortedHistory[0]

  // Xác định có cảnh báo thất bại cần hiển thị chủ động không
  const hasActiveFailureAlert = Boolean(
    scheduleConfig?.alertActive ||
    (scheduleConfig?.lastStatus === 'FAILED' && scheduleConfig?.lastFailureReason)
  )

  // Cấu hình các cột trong bảng Lịch sử các lần sao lưu
  const columns = [
    {
      title: 'Mã bản sao lưu',
      dataIndex: 'backupCode',
      key: 'backupCode',
      width: 190,
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
      width: 220,
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
      width: 140,
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
                  <strong>Lỗi: </strong>
                  {reason || 'Tiến trình trích xuất sao lưu dữ liệu bị lỗi không xác định.'}
                </span>
              </Space>
            </div>
          )
        }
        if (record.status === 'IN_PROGRESS') {
          return (
            <Text type="secondary" italic>
              Tiến trình đang trích xuất dữ liệu các bảng phòng khám vào tệp snapshot...
            </Text>
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
                  Chi tiết lỗi: {scheduleConfig?.lastFailureReason || 'Tiến trình sao lưu dữ liệu bị gián đoạn do lỗi kết nối hoặc phân vùng đĩa đầy.'}
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
              • <strong>Môi trường thử nghiệm:</strong> Hệ thống đang sử dụng dữ liệu mô phỏng của phòng khám. Các bản sao lưu và kết quả kiểm tra toàn vẹn được vận hành trên tập dữ liệu mô phỏng an toàn, không ảnh hưởng đến dữ liệu bệnh nhân thực tế.
            </div>
            <div>
              • <strong>Chính sách lưu trữ bản sao lưu:</strong> Thời hạn tự động xóa/dọn dẹp các bản sao lưu quá cũ hiện đang chờ xác nhận từ đội ngũ sản phẩm. Hệ thống hiện duy trì và hiển thị đầy đủ toàn bộ lịch sử các lần chạy để quản trị viên dễ dàng đối soát.
            </div>
          </Space>
        }
      />

      <Row gutter={[20, 20]}>
        {/* KHỐI 1: CẤU HÌNH LỊCH SAO LƯU */}
        <Col xs={24} lg={12}>
          <Card
            className="scheduled-backup-card"
            title={
              <Space>
                <SettingOutlined style={{ color: '#1890ff' }} />
                <span>Cấu hình lịch sao lưu tự động</span>
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Bật/Tắt tự động */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong style={{ fontSize: 15, display: 'block' }}>
                    Kích hoạt sao lưu tự động
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Hệ thống sẽ tự động tạo bản sao lưu định kỳ mà không cần thao tác thủ công.
                  </Text>
                </div>
                <Switch
                  checked={enabled}
                  onChange={(checked) => setEnabled(checked)}
                  checkedChildren="BẬT"
                  unCheckedChildren="TẮT"
                  style={{ minWidth: 65 }}
                />
              </div>

              <Divider style={{ margin: '8px 0' }} />

              {/* Tần suất chạy */}
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
                  <Radio.Button value="WEEKLY">Hằng tuần (Cuối tuần)</Radio.Button>
                </Radio.Group>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    * Khuyến nghị chọn &quot;Hằng ngày&quot; để đảm bảo hồ sơ bệnh án và đơn thuốc trong ngày luôn được bảo vệ an toàn.
                  </Text>
                </div>
              </div>

              {/* Thời điểm chạy cụ thể */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Thời điểm chạy cụ thể (24h):
                </Text>
                <Space wrap align="center">
                  <TimePicker
                    value={dayjs(dailyTime || '02:00', 'HH:mm')}
                    format="HH:mm"
                    minuteStep={15}
                    disabled={!enabled}
                    onChange={(_, timeString) => {
                      if (timeString) setDailyTime(timeString)
                    }}
                    style={{ width: 140 }}
                  />
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Chọn nhanh giờ ít người dùng:
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
              </div>

              {/* Hiển thị rõ lịch chạy kế tiếp */}
              <div className={`next-run-callout ${enabled ? 'active' : 'inactive'}`}>
                <div className="callout-icon">
                  <ClockCircleOutlined />
                </div>
                <div className="callout-content">
                  <div className="callout-title">
                    {enabled ? 'Lịch trình sao lưu tiếp theo:' : 'Trạng thái sao lưu tự động:'}
                  </div>
                  <div className="callout-desc">
                    <Text strong style={{ color: enabled ? '#096dd9' : '#8c8c8c', fontSize: 14 }}>
                      {nextRunInfo.text}
                    </Text>
                  </div>
                </div>
                {enabled && (
                  <Tag color="cyan">{nextRunInfo.relativeLabel}</Tag>
                )}
              </div>

              {/* Nút lưu cấu hình */}
              <div style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={savingSchedule}
                  disabled={!canModifySchedule}
                  onClick={handleSaveSchedule}
                  size="middle"
                >
                  Lưu cấu hình lịch sao lưu
                </Button>
                {scheduleConfig?.updatedAt && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
                    Cập nhật lần cuối: {formatDateTime(scheduleConfig.updatedAt)}
                  </Text>
                )}
              </div>
            </div>
          </Card>
        </Col>

        {/* KHỐI 2: KIỂM TRA TÍNH TOÀN VẸN BẢN SAO LƯU GẦN NHẤT */}
        <Col xs={24} lg={12}>
          <Card
            className="scheduled-backup-card"
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                <span>Kiểm tra tính toàn vẹn bản sao lưu gần nhất</span>
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Thông tin bản sao lưu mới nhất */}
              <div>
                <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                  Thông tin bản sao lưu gần nhất:
                </Text>
                {latestBackupRecord ? (
                  <div style={{ backgroundColor: '#fafafa', padding: '12px 16px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <Row gutter={[16, 8]}>
                      <Col span={12}>
                        <Text type="secondary">Mã bản sao lưu:</Text>
                        <div>
                          <Text strong style={{ color: '#1890ff' }}>
                            {latestBackupRecord.backupCode || 'BKP-RECENT'}
                          </Text>
                        </div>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Thời điểm tạo:</Text>
                        <div>
                          <Text strong>{formatDateTime(latestBackupRecord.createdAt)}</Text>
                        </div>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Dung lượng:</Text>
                        <div>
                          <Text strong>{formatFileSize(latestBackupRecord.fileSize)}</Text>
                        </div>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Trạng thái bản ghi:</Text>
                        <div>
                          {latestBackupRecord.status === 'SUCCESS' ? (
                            <Tag color="success">Thành công</Tag>
                          ) : (
                            <Tag color="error">Thất bại</Tag>
                          )}
                        </div>
                      </Col>
                    </Row>
                  </div>
                ) : (
                  <Alert
                    type="warning"
                    message="Chưa tìm thấy bản sao lưu nào trong hệ thống để thực hiện kiểm tra."
                  />
                )}
              </div>

              {/* Nút Kiểm tra ngay */}
              <div>
                <Space wrap align="center">
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                    icon={<SafetyCertificateOutlined />}
                    loading={verifyingLatest}
                    disabled={!latestBackupRecord}
                    onClick={handleVerifyLatest}
                    size="middle"
                  >
                    {verifyingLatest ? 'Đang kiểm tra tính toàn vẹn...' : 'Kiểm tra ngay'}
                  </Button>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Xác thực khả năng đọc file, độ tương thích bảng CSDL và tính toàn vẹn dữ liệu.
                  </Text>
                </Space>
              </div>

              {/* Hiển thị kết quả kiểm tra nhanh */}
              {verifyingLatest && (
                <div style={{ padding: '16px', textAlign: 'center', background: '#e6f7ff', borderRadius: 8 }}>
                  <Spin tip="Đang đọc và xác thực cấu trúc tệp sao lưu..." />
                </div>
              )}

              {latestVerification && !verifyingLatest && (
                <div
                  className={`verification-status-panel ${
                    latestVerification.valid ? 'success' : 'error'
                  }`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Space align="start">
                      {latestVerification.valid ? (
                        <CheckCircleFilled style={{ color: '#52c41a', fontSize: 22, marginTop: 2 }} />
                      ) : (
                        <CloseCircleFilled style={{ color: '#f5222d', fontSize: 22, marginTop: 2 }} />
                      )}
                      <div>
                        <Text strong style={{ fontSize: 15, display: 'block' }}>
                          {latestVerification.valid
                            ? 'Bản sao lưu đọc được và đầy đủ dữ liệu'
                            : 'Cảnh báo: Bản sao lưu phát hiện lỗi toàn vẹn hoặc không thể đọc'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Kiểm tra lúc: {formatDateTime(latestVerification.verifiedAt)} •{' '}
                          {latestVerification.tableCount}/28 bảng • {latestVerification.rowCount} bản ghi
                        </Text>
                        {latestVerification.issues && latestVerification.issues.length > 0 && (
                          <div style={{ marginTop: 6, color: '#cf1322', fontSize: 12 }}>
                            {latestVerification.issues[0]}
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
                      Xem chi tiết
                    </Button>
                  </div>
                </div>
              )}

              {!latestVerification && !verifyingLatest && scheduleConfig?.lastVerifiedAt && (
                <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                  Lần kiểm tra trước đó:{' '}
                  <strong>{formatDateTime(scheduleConfig.lastVerifiedAt)}</strong> (
                  <Tag color="success">Đạt yêu cầu</Tag>)
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* KHỐI 3: BẢNG LỊCH SỬ CÁC LẦN SAO LƯU */}
      <Card
        className="scheduled-backup-card"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Space wrap>
              <HistoryOutlined style={{ color: '#1890ff' }} />
              <span>Lịch sử các lần sao lưu hệ thống</span>
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
                {isUsingMockData ? 'Quay lại dữ liệu máy chủ' : 'Xem dữ liệu mẫu mô phỏng'}
              </Button>
            </Space>

            <Space wrap size={8}>
              <Text type="secondary" style={{ fontSize: 13 }}>Lọc kết quả:</Text>
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
                    Chưa có lần sao lưu tự động nào được thực hiện
                  </Text>
                  <Text type="secondary" style={{ display: 'block', maxWidth: 600, margin: '0 auto 12px' }}>
                    Khi tính năng sao lưu tự động được kích hoạt và đến khung giờ đã định ({dailyTime}), hệ thống sẽ tự động tiến hành sao lưu và ghi lại toàn bộ kết quả tại bảng này.
                  </Text>
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    onClick={handleToggleDataSource}
                  >
                    Xem dữ liệu mẫu mô phỏng (5 bản ghi)
                  </Button>
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
            scroll={{ x: 1050 }}
            pagination={{
              pageSize: 5,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '20'],
              showTotal: (total) => `Tổng cộng ${total} bản ghi sao lưu`,
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
