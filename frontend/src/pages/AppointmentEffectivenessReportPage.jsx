import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CompassOutlined,
  FileTextOutlined,
  FilterOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PieChartOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import appointmentEffectivenessReportApi from '../api/appointmentEffectivenessReportApi.js'
import userApi from '../api/userApi.js'
import { useAuthContext } from '../context/AuthContext.jsx'
import {
  ALL_BOOKING_CHANNELS,
  extractAppointmentKpis,
  formatBookingChannel,
  formatPercentage,
  formatStatus,
  getAppointmentEffectivenessErrorMessage,
  getChannelColor,
  getStatusColor,
  groupItemsByChannel,
  groupItemsByStatus,
  validateDateRange,
} from '../utils/appointmentEffectivenessReportHelpers.js'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

/**
 * Biểu đồ Donut SVG tương tác cho phân bố Trạng thái lịch hẹn
 */
function StatusDonutChart({ items = [], total = 0, hoveredStatus, setHoveredStatus }) {
  const slices = useMemo(() => {
    if (!items.length || total <= 0) return []

    const size = 240
    const center = size / 2
    const radius = 95
    const innerRadius = 60

    let cumulativeAngle = -Math.PI / 2 // Bắt đầu từ 12h

    return items.map((item) => {
      const fraction = Number(item.count || 0) / total
      const angle = fraction * 2 * Math.PI

      const startAngle = cumulativeAngle
      const endAngle = cumulativeAngle + angle
      cumulativeAngle = endAngle

      const isLargeArc = angle > Math.PI ? 1 : 0

      const x1 = center + radius * Math.cos(startAngle)
      const y1 = center + radius * Math.sin(startAngle)
      const x2 = center + radius * Math.cos(endAngle)
      const y2 = center + radius * Math.sin(endAngle)

      const ix1 = center + innerRadius * Math.cos(endAngle)
      const iy1 = center + innerRadius * Math.sin(endAngle)
      const ix2 = center + innerRadius * Math.cos(startAngle)
      const iy2 = center + innerRadius * Math.sin(startAngle)

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${isLargeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerRadius} ${innerRadius} 0 ${isLargeArc} 0 ${ix2} ${iy2}`,
        'Z',
      ].join(' ')

      return {
        ...item,
        pathData,
      }
    })
  }, [items, total])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 240, height: 240 }}>
        <svg
          viewBox="0 0 240 240"
          style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
        >
          {slices.length === 0 ? (
            <circle cx="120" cy="120" r="77" fill="none" stroke="#e2e8f0" strokeWidth="35" />
          ) : (
            slices.map((slice) => {
              const isHovered = hoveredStatus === slice.status
              return (
                <path
                  key={slice.status}
                  d={slice.pathData}
                  fill={slice.color}
                  opacity={hoveredStatus && !isHovered ? 0.45 : 1}
                  style={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, opacity 0.2s ease',
                    transformOrigin: '120px 120px',
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                  }}
                  onMouseEnter={() => setHoveredStatus(slice.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                />
              )
            })
          )}
        </svg>

        {/* Thông tin ở giữa tâm Donut */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: 8,
          }}
        >
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>
            Tổng số lịch
          </Text>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
            {total.toLocaleString('vi-VN')}
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>lượt hẹn</span>
        </div>
      </div>
    </div>
  )
}

export default function AppointmentEffectivenessReportPage() {
  const { user } = useAuthContext()

  // Phân quyền bảo mật: CHỈ dành riêng cho vai trò Quản lý phòng khám (MANAGER / clinic_manager), chặn Admin
  const userRoles = useMemo(() => {
    return (user?.roles || [user?.role || '']).map((r) =>
      String(r || '').toLowerCase().replace(/^role_/, '')
    )
  }, [user])

  const isAdmin = userRoles.includes('admin')
  const isManager = userRoles.includes('manager') || userRoles.includes('clinic_manager')
  const isAuthorized = isManager && !isAdmin

  // State bộ lọc
  const [dateRange, setDateRange] = useState(() => [
    dayjs().subtract(29, 'day').startOf('day'),
    dayjs().endOf('day'),
  ])
  const [selectedDoctorId, setSelectedDoctorId] = useState(undefined)
  const [selectedChannel, setSelectedChannel] = useState(undefined)

  // Danh sách bác sĩ
  const [doctors, setDoctors] = useState([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)

  // State chế độ hiển thị: 'status' (theo trạng thái) | 'channel' (theo kênh đặt lịch)
  const [viewMode, setViewMode] = useState('status')
  const [hoveredStatus, setHoveredStatus] = useState(null)

  // State dữ liệu báo cáo
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Tải danh sách bác sĩ cho bộ lọc
  useEffect(() => {
    let isMounted = true
    const fetchDoctors = async () => {
      try {
        setDoctorsLoading(true)
        const res = await userApi.getDoctors()
        if (!isMounted) return
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        setDoctors(list)
      } catch {
        // Fallback im lặng nếu API danh sách bác sĩ gặp sự cố
      } finally {
        if (isMounted) setDoctorsLoading(false)
      }
    }
    fetchDoctors()
    return () => {
      isMounted = false
    }
  }, [])

  // Tùy chọn Bác sĩ
  const doctorOptions = useMemo(() => {
    const list = doctors.map((doc) => ({
      value: doc.id,
      label: doc.fullName || doc.name || doc.username || `Bác sĩ (${doc.id?.substring(0, 6)})`,
    }))
    return [{ value: undefined, label: 'Tất cả bác sĩ' }, ...list]
  }, [doctors])

  // Hàm gọi API báo cáo
  const handleFetchReport = useCallback(
    async (rangeToUse = dateRange, docIdToUse = selectedDoctorId, channelToUse = selectedChannel) => {
      if (!rangeToUse || !rangeToUse[0] || !rangeToUse[1]) {
        message.warning('Vui lòng chọn khoảng thời gian báo cáo.')
        return
      }

      const fromStr = rangeToUse[0].format('YYYY-MM-DD')
      const toStr = rangeToUse[1].format('YYYY-MM-DD')

      const validation = validateDateRange(fromStr, toStr)
      if (!validation.valid) {
        message.error(validation.error)
        return
      }

      const params = {
        from: fromStr,
        to: toStr,
      }
      if (docIdToUse) {
        params.doctorId = docIdToUse
      }
      if (channelToUse) {
        params.bookingChannel = channelToUse
      }

      try {
        setLoading(true)
        const res = await appointmentEffectivenessReportApi.getReport(params)
        setReportData(res?.data || { from: fromStr, to: toStr, total: 0, items: [] })
        setHasSearched(true)
      } catch (err) {
        const errorMsg = getAppointmentEffectivenessErrorMessage(err)
        message.error(errorMsg)
      } finally {
        setLoading(false)
      }
    },
    [dateRange, selectedDoctorId, selectedChannel]
  )

  // Tự động tải báo cáo lần đầu khi vào trang
  useEffect(() => {
    if (isAuthorized) {
      handleFetchReport()
    }
  }, [isAuthorized])

  // Xử lý chọn nhanh khoảng thời gian
  const handleQuickPreset = (preset) => {
    let newRange
    const now = dayjs()

    switch (preset) {
      case 'TODAY':
        newRange = [now.startOf('day'), now.endOf('day')]
        break
      case '7DAYS':
        newRange = [now.subtract(6, 'day').startOf('day'), now.endOf('day')]
        break
      case '30DAYS':
        newRange = [now.subtract(29, 'day').startOf('day'), now.endOf('day')]
        break
      case 'THIS_MONTH':
        newRange = [now.startOf('month'), now.endOf('day')]
        break
      case 'LAST_MONTH':
        newRange = [
          now.subtract(1, 'month').startOf('month'),
          now.subtract(1, 'month').endOf('month'),
        ]
        break
      default:
        newRange = [now.subtract(29, 'day').startOf('day'), now.endOf('day')]
    }

    setDateRange(newRange)
    handleFetchReport(newRange, selectedDoctorId, selectedChannel)
  }

  // Dữ liệu KPI then chốt
  const kpis = useMemo(() => {
    return extractAppointmentKpis(reportData?.items || [], reportData?.total || 0)
  }, [reportData])

  // Dữ liệu nhóm theo Trạng thái (cho view 'status')
  const statusGroupedData = useMemo(() => {
    return groupItemsByStatus(reportData?.items || [], reportData?.total || 0)
  }, [reportData])

  // Dữ liệu nhóm theo Kênh đặt lịch (cho view 'channel')
  const channelGroupedData = useMemo(() => {
    return groupItemsByChannel(reportData?.items || [], reportData?.total || 0)
  }, [reportData])

  // Kiểm tra trạng thái có dữ liệu
  const isDataAvailable = reportData && reportData.total > 0

  // Bảng phân rã theo Trạng thái
  const statusColumns = [
    {
      title: 'Trạng thái lịch hẹn',
      dataIndex: 'statusLabel',
      key: 'statusLabel',
      render: (label, record) => (
        <Space size={8}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: record.color,
            }}
          />
          <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
            {label}
          </Text>
          {record.status === 'NO_SHOW' && (
            <Tag color="volcano" style={{ fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
              Chỉ số trọng tâm
            </Tag>
          )}
          {record.status === 'COMPLETED' && (
            <Tag color="green" style={{ fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
              Khám thành công
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Số lượng lịch hẹn',
      dataIndex: 'count',
      key: 'count',
      align: 'right',
      width: 160,
      render: (count) => (
        <Text strong style={{ fontSize: 14.5, color: '#1e293b' }}>
          {Number(count).toLocaleString('vi-VN')} lượt
        </Text>
      ),
    },
    {
      title: 'Tỷ lệ cơ cấu',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 240,
      render: (pct, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Progress
            percent={pct}
            strokeColor={record.color}
            showInfo={false}
            size="small"
            style={{ flex: 1, margin: 0 }}
          />
          <Tag
            style={{
              minWidth: 62,
              textAlign: 'center',
              fontWeight: 700,
              fontSize: 12.5,
              borderRadius: 6,
              color: record.color,
              borderColor: record.color,
              background: '#ffffff',
            }}
          >
            {formatPercentage(pct)}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Phân bổ theo kênh',
      key: 'channelSummary',
      width: 280,
      render: (_, record) => (
        <Space size={6} wrap>
          {record.channels.map((ch) => (
            <Tooltip
              key={ch.bookingChannel}
              title={`${ch.channelLabel}: ${ch.count} lượt (${formatPercentage(ch.percentage)})`}
            >
              <Tag
                color={ch.bookingChannel === 'ONLINE_PORTAL' ? 'blue' : 'cyan'}
                style={{ borderRadius: 6, fontSize: 12 }}
              >
                {ch.bookingChannel === 'ONLINE_PORTAL' ? 'Trực tuyến' : 'Tại quầy'}: {ch.count}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
  ]

  // Bảng phân rã theo Kênh đặt lịch
  const channelColumns = [
    {
      title: 'Kênh đặt lịch',
      dataIndex: 'channelLabel',
      key: 'channelLabel',
      render: (label, record) => (
        <Space size={10}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              background: record.bookingChannel === 'ONLINE_PORTAL' ? '#eff6ff' : '#ecfdf5',
              color: record.bookingChannel === 'ONLINE_PORTAL' ? '#2563eb' : '#059669',
              fontSize: 16,
            }}
          >
            {record.bookingChannel === 'ONLINE_PORTAL' ? <GlobalOutlined /> : <ShopOutlined />}
          </span>
          <div>
            <Text strong style={{ fontSize: 14, color: '#0f172a', display: 'block' }}>
              {label}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.bookingChannel === 'ONLINE_PORTAL'
                ? 'Lịch đặt qua cổng thông tin bệnh nhân'
                : 'Lịch đăng ký trực tiếp tại phòng khám'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Tổng số lịch',
      dataIndex: 'count',
      key: 'count',
      align: 'right',
      width: 160,
      render: (count) => (
        <Text strong style={{ fontSize: 14.5, color: '#1e293b' }}>
          {Number(count).toLocaleString('vi-VN')} lượt
        </Text>
      ),
    },
    {
      title: 'Tỷ trọng kênh',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 240,
      render: (pct, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Progress
            percent={pct}
            strokeColor={record.color}
            showInfo={false}
            size="small"
            style={{ flex: 1, margin: 0 }}
          />
          <Tag
            style={{
              minWidth: 62,
              textAlign: 'center',
              fontWeight: 700,
              fontSize: 12.5,
              borderRadius: 6,
              color: record.color,
              borderColor: record.color,
              background: '#ffffff',
            }}
          >
            {formatPercentage(pct)}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Tỷ lệ không đến (NO_SHOW)',
      key: 'noShowInChannel',
      width: 220,
      render: (_, record) => {
        const noShowItem = record.statuses.find((s) => s.status === 'NO_SHOW')
        const noShowCount = noShowItem?.count || 0
        const noShowInChannelPct = record.count > 0 ? (noShowCount * 100) / record.count : 0
        const isHigh = noShowInChannelPct > 15
        return (
          <Space size={6}>
            <Text
              strong
              style={{
                color: isHigh ? '#ea580c' : '#475569',
                fontSize: 13,
              }}
            >
              {noShowCount} lượt ({formatPercentage(noShowInChannelPct)})
            </Text>
            {isHigh && (
              <Tag color="volcano" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                Cần tối ưu
              </Tag>
            )}
          </Space>
        )
      },
    },
  ]

  // Nếu người dùng không có vai trò Quản lý phòng khám
  if (!isAuthorized) {
    return (
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        <Alert
          type="error"
          showIcon
          message="Truy cập bị từ chối"
          description="Báo cáo hiệu quả lịch hẹn chỉ dành riêng cho vai trò Quản lý phòng khám (MANAGER). Vui lòng liên hệ quản trị viên nếu bạn cần cấp quyền."
          style={{ borderRadius: 10 }}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1300, margin: '0 auto' }}>
      {/* Tiêu đề trang (Tuân thủ Rule: Không thêm dòng mô tả phụ dài dòng dưới tiêu đề) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <Space size={10} align="center">
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            <CalendarOutlined />
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 22 }}>
            Báo cáo hiệu quả lịch hẹn
          </Title>
        </Space>

        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={() => handleFetchReport()}
          loading={loading}
          style={{ height: 40, borderRadius: 8, fontWeight: 600, padding: '0 16px' }}
        >
          Làm mới
        </Button>
      </div>

      {/* Thanh bộ lọc (Filter Bar) */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          border: '1px solid #f1f5f9',
          marginBottom: 18,
        }}
        styles={{ body: { padding: '18px 20px' } }}
      >
        <Row gutter={[16, 16]} align="bottom">
          {/* Chọn kỳ báo cáo */}
          <Col xs={24} sm={24} md={10} lg={9}>
            <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#334155' }}>
              <CalendarOutlined style={{ marginRight: 6, color: '#2563eb' }} />
              Kỳ báo cáo (Tối đa 366 ngày):
            </Text>
            <RangePicker
              value={dateRange}
              onChange={(val) => {
                setDateRange(val)
              }}
              format="DD/MM/YYYY"
              allowClear={false}
              disabledDate={(current) => current && current > dayjs().endOf('day')}
              style={{ width: '100%', height: 40, borderRadius: 8 }}
            />
          </Col>

          {/* Chọn Bác sĩ (Tùy chọn) */}
          <Col xs={24} sm={12} md={7} lg={6}>
            <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#334155' }}>
              <UserOutlined style={{ marginRight: 6, color: '#2563eb' }} />
              Bác sĩ phụ trách:
            </Text>
            <Select
              value={selectedDoctorId}
              onChange={setSelectedDoctorId}
              options={doctorOptions}
              loading={doctorsLoading}
              placeholder="Tất cả bác sĩ"
              style={{ width: '100%', height: 40 }}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            />
          </Col>

          {/* Chọn Kênh đặt lịch (Tùy chọn) */}
          <Col xs={24} sm={12} md={7} lg={5}>
            <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#334155' }}>
              <CompassOutlined style={{ marginRight: 6, color: '#2563eb' }} />
              Kênh đặt lịch:
            </Text>
            <Select
              value={selectedChannel}
              onChange={setSelectedChannel}
              options={[
                { value: undefined, label: 'Tất cả kênh đặt lịch' },
                { value: 'ONLINE_PORTAL', label: 'Cổng trực tuyến' },
                { value: 'RECEPTION_COUNTER', label: 'Đăng ký tại quầy' },
              ]}
              placeholder="Tất cả kênh đặt lịch"
              style={{ width: '100%', height: 40 }}
              allowClear
            />
          </Col>

          {/* Nút Xem báo cáo */}
          <Col xs={24} sm={24} md={24} lg={4}>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => handleFetchReport()}
              loading={loading}
              style={{
                width: '100%',
                height: 40,
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14.5,
              }}
            >
              Xem báo cáo
            </Button>
          </Col>
        </Row>

        {/* Dòng chọn nhanh khoảng thời gian (Quick Presets) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px dashed #e2e8f0',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <FilterOutlined style={{ color: '#2563eb' }} /> Chọn nhanh:
          </span>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('TODAY')}>
            Hôm nay
          </Button>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('7DAYS')}>
            7 ngày qua
          </Button>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('30DAYS')}>
            30 ngày qua
          </Button>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('THIS_MONTH')}>
            Tháng này
          </Button>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('LAST_MONTH')}>
            Tháng trước
          </Button>
        </div>
      </Card>

      {/* Nội dung kết quả */}
      {loading ? (
        <Card
          bordered={false}
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Spin size="large" tip="Đang tổng hợp dữ liệu báo cáo hiệu quả lịch hẹn..." />
        </Card>
      ) : isDataAvailable ? (
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          {/* Thẻ KPI Tổng quan (Highlight NO_SHOW ở vị trí nổi bật) */}
          <Row gutter={[16, 16]}>
            {/* KPI 1: Tổng số lịch hẹn */}
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered={false}
                style={{
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  border: '1px solid #f1f5f9',
                  background: '#ffffff',
                }}
                styles={{ body: { padding: '16px 18px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12.5, fontWeight: 500, display: 'block' }}>
                      Tổng số lịch hẹn
                    </Text>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                      {kpis.total.toLocaleString('vi-VN')}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11.5 }}>
                      lượt hẹn trong kỳ
                    </Text>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                    }}
                  >
                    <CalendarOutlined />
                  </div>
                </div>
              </Card>
            </Col>

            {/* KPI 2: TỶ LỆ KHÔNG ĐẾN KHÁM (NO_SHOW) - CHỈ SỐ QUAN TRỌNG NHẤT */}
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered={false}
                style={{
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  border: kpis.isNoShowWarning ? '1.5px solid #fed7aa' : '1px solid #f1f5f9',
                  background: kpis.isNoShowWarning ? '#fff7ed' : '#ffffff',
                }}
                styles={{ body: { padding: '16px 18px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text strong style={{ fontSize: 12.5, color: '#ea580c' }}>
                        Tỷ lệ không đến khám
                      </Text>
                      <Tag color="volcano" style={{ fontSize: 10.5, borderRadius: 4, padding: '0 4px', margin: 0 }}>
                        Trọng tâm
                      </Tag>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#ea580c', marginTop: 4 }}>
                      {formatPercentage(kpis.noShowPercentage)}
                    </div>
                    <Text style={{ fontSize: 11.5, color: '#9a3412' }}>
                      {kpis.noShowCount} lượt bỏ hẹn
                    </Text>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: '#ffedd5',
                      color: '#ea580c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                    }}
                  >
                    <WarningOutlined />
                  </div>
                </div>
              </Card>
            </Col>

            {/* KPI 3: Tỷ lệ đã khám xong (COMPLETED) */}
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered={false}
                style={{
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  border: '1px solid #f1f5f9',
                  background: '#ffffff',
                }}
                styles={{ body: { padding: '16px 18px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12.5, fontWeight: 500, display: 'block' }}>
                      Tỷ lệ khám thành công
                    </Text>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                      {formatPercentage(kpis.completedPercentage)}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11.5 }}>
                      {kpis.completedCount} lượt hoàn thành
                    </Text>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: '#ecfdf5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                    }}
                  >
                    <CheckCircleOutlined />
                  </div>
                </div>
              </Card>
            </Col>

            {/* KPI 4: Tỷ lệ đã hủy hẹn (CANCELLED) */}
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered={false}
                style={{
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  border: '1px solid #f1f5f9',
                  background: '#ffffff',
                }}
                styles={{ body: { padding: '16px 18px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12.5, fontWeight: 500, display: 'block' }}>
                      Tỷ lệ hủy lịch hẹn
                    </Text>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                      {formatPercentage(kpis.cancelledPercentage)}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11.5 }}>
                      {kpis.cancelledCount} lượt đã hủy
                    </Text>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: '#fef2f2',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                    }}
                  >
                    <CloseCircleOutlined />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Thanh chuyển đổi chế độ xem (View Toggle) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Radio.Group
              size="large"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="status" style={{ height: 40, lineHeight: '38px', fontWeight: 600 }}>
                <PieChartOutlined style={{ marginRight: 6 }} /> Xem theo trạng thái
              </Radio.Button>
              <Radio.Button value="channel" style={{ height: 40, lineHeight: '38px', fontWeight: 600 }}>
                <BarChartOutlined style={{ marginRight: 6 }} /> Xem theo kênh đặt lịch
              </Radio.Button>
            </Radio.Group>

            <Text type="secondary" style={{ fontSize: 12.5 }}>
              Thời điểm kết xuất: {reportData.generatedAt ? dayjs(reportData.generatedAt).format('DD/MM/YYYY HH:mm:ss') : '-'}
            </Text>
          </div>

          {/* Khu vực Biểu đồ & Phân tích trực quan */}
          {viewMode === 'status' ? (
            /* VIEW THEO TRẠNG THÁI: Donut chart phân bổ & danh sách thẻ */
            <Card
              title={
                <Space size={8}>
                  <PieChartOutlined style={{ color: '#2563eb', fontSize: 18 }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    Cơ cấu phân bổ lịch hẹn theo trạng thái
                  </span>
                </Space>
              }
              bordered={false}
              style={{
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                border: '1px solid #f1f5f9',
              }}
              styles={{ body: { padding: '20px 24px' } }}
            >
              <Row gutter={[32, 24]} align="middle">
                {/* Donut Chart SVG */}
                <Col xs={24} md={10} style={{ display: 'flex', justifyContent: 'center' }}>
                  <StatusDonutChart
                    items={statusGroupedData}
                    total={reportData.total}
                    hoveredStatus={hoveredStatus}
                    setHoveredStatus={setHoveredStatus}
                  />
                </Col>

                {/* Danh sách phân tích tỷ trọng trạng thái */}
                <Col xs={24} md={14}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {statusGroupedData.map((item) => {
                      const isHovered = hoveredStatus === item.status
                      return (
                        <div
                          key={item.status}
                          onMouseEnter={() => setHoveredStatus(item.status)}
                          onMouseLeave={() => setHoveredStatus(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: isHovered ? `1.5px solid ${item.color}` : '1px solid #f1f5f9',
                            background: isHovered ? '#f8fafc' : '#ffffff',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: item.color,
                              }}
                            />
                            <Text strong style={{ fontSize: 13.5, color: '#1e293b' }}>
                              {item.statusLabel}
                            </Text>
                          </div>

                          <div style={{ flex: 1, margin: '0 16px', minWidth: 100 }}>
                            <Progress
                              percent={item.percentage}
                              strokeColor={item.color}
                              showInfo={false}
                              size="small"
                              style={{ margin: 0 }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'right' }}>
                            <Text strong style={{ fontSize: 13.5, color: '#0f172a' }}>
                              {item.count} lượt
                            </Text>
                            <Tag
                              style={{
                                minWidth: 60,
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: 12,
                                borderRadius: 6,
                                color: item.color,
                                borderColor: item.color,
                                background: '#ffffff',
                                margin: 0,
                              }}
                            >
                              {formatPercentage(item.percentage)}
                            </Tag>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Col>
              </Row>
            </Card>
          ) : (
            /* VIEW THEO KÊNH ĐẶT LỊCH: Biểu đồ đối chiếu so sánh trực quan giữa 2 kênh */
            <Card
              title={
                <Space size={8}>
                  <BarChartOutlined style={{ color: '#2563eb', fontSize: 18 }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    So sánh hiệu quả giữa Cổng trực tuyến và Đăng ký tại quầy
                  </span>
                </Space>
              }
              bordered={false}
              style={{
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                border: '1px solid #f1f5f9',
              }}
              styles={{ body: { padding: '20px 24px' } }}
            >
              <Row gutter={[24, 24]}>
                {channelGroupedData.map((channel) => {
                  const isOnline = channel.bookingChannel === 'ONLINE_PORTAL'
                  return (
                    <Col xs={24} md={12} key={channel.bookingChannel}>
                      <div
                        style={{
                          padding: '18px 20px',
                          borderRadius: 10,
                          border: isOnline ? '1.5px solid #bfdbfe' : '1.5px solid #bbf7d0',
                          background: isOnline ? '#f8faff' : '#f8fdf9',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Space size={8}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  background: isOnline ? '#dbeafe' : '#dcfce7',
                                  color: isOnline ? '#1d4ed8' : '#15803d',
                                  fontSize: 16,
                                }}
                              >
                                {isOnline ? <GlobalOutlined /> : <ShopOutlined />}
                              </span>
                              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                                {channel.channelLabel}
                              </Text>
                            </Space>

                            <Tag
                              color={isOnline ? 'blue' : 'green'}
                              style={{ fontWeight: 700, fontSize: 13, borderRadius: 6, padding: '2px 8px' }}
                            >
                              {formatPercentage(channel.percentage)}
                            </Tag>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
                            <span style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>
                              {channel.count.toLocaleString('vi-VN')}
                            </span>
                            <span style={{ color: '#64748b', fontSize: 13 }}>lượt đặt hẹn</span>
                          </div>

                          <Divider style={{ margin: '12px 0' }} />

                          {/* Chi tiết từng trạng thái trong kênh */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {channel.statuses.map((st) => (
                              <div
                                key={st.status}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 13,
                                }}
                              >
                                <Space size={6}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      backgroundColor: st.color,
                                    }}
                                  />
                                  <span style={{ color: '#334155' }}>{st.statusLabel}</span>
                                </Space>

                                <Space size={8}>
                                  <Text strong style={{ color: '#0f172a' }}>
                                    {st.count} lượt
                                  </Text>
                                  <Tag
                                    style={{
                                      minWidth: 54,
                                      textAlign: 'center',
                                      fontSize: 11.5,
                                      borderRadius: 4,
                                      padding: '0 4px',
                                      margin: 0,
                                    }}
                                  >
                                    {formatPercentage(st.percentage)}
                                  </Tag>
                                </Space>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Col>
                  )
                })}
              </Row>
            </Card>
          )}

          {/* Bảng Dữ liệu Chi tiết */}
          <Card
            title={
              <Space size={8}>
                <FileTextOutlined style={{ color: '#2563eb', fontSize: 18 }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  {viewMode === 'status'
                    ? 'Bảng chi tiết số lượng và tỷ lệ theo trạng thái'
                    : 'Bảng chi tiết số lượng và tỷ lệ theo kênh đặt lịch'}
                </span>
              </Space>
            }
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              border: '1px solid #f1f5f9',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Table
              dataSource={viewMode === 'status' ? statusGroupedData : channelGroupedData}
              columns={viewMode === 'status' ? statusColumns : channelColumns}
              rowKey={(r) => r.status || r.bookingChannel}
              pagination={false}
              bordered
            />
          </Card>
        </Space>
      ) : hasSearched ? (
        /* Empty State */
        <Card
          bordered={false}
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text style={{ fontSize: 14.5, color: '#64748b' }}>
                  Không có lịch hẹn nào trong khoảng thời gian đã chọn.
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Button
                    type="link"
                    onClick={() => handleQuickPreset('30DAYS')}
                    style={{ fontSize: 13, color: '#2563eb' }}
                  >
                    Xem dữ liệu 30 ngày qua
                  </Button>
                </div>
              </div>
            }
          />
        </Card>
      ) : null}
    </div>
  )
}
