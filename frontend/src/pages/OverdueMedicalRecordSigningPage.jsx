import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  BellOutlined,
  ClockCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  HistoryOutlined,
  MailOutlined,
  MessageOutlined,
  MoreOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import medicalRecordApi from '../api/medicalRecordApi.js'
import userApi from '../api/userApi.js'
import { useAuthContext } from '../context/AuthContext'
import { getApiErrorMessage } from '../utils/apiError'
import { formatDateTime } from '../utils/helpers'
import {
  calculateOverdueKpis,
  canSendSigningReminder,
  canViewOverdueSigning,
  filterOverdueRecords,
  formatMedicalRecordStatus,
  formatOverdueHours,
  formatReminderChannel,
  formatReminderStatus,
  getDoctorDisplayName,
  getOverdueSeverity,
  SYSTEM_DOCTORS,
  validateSendReminderForm,
} from '../utils/overdueMedicalRecordHelpers.js'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

/**
 * NCL-11-CN-006: Theo dõi và nhắc ký bệnh án quá hạn
 * QTN-29: Ký số hồ sơ bệnh án quá hạn
 */
export default function OverdueMedicalRecordSigningPage() {
  const navigate = useNavigate()
  const { user } = useAuthContext()

  // User roles and permissions
  const userRoles = useMemo(
    () => (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, '')),
    [user]
  )
  const userPerms = useMemo(
    () => (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, '')),
    [user]
  )

  const canView = canViewOverdueSigning(userRoles, userPerms)
  const canSend = canSendSigningReminder(userRoles, userPerms)
  const isDoctor = userRoles.includes('doctor') && !userRoles.includes('admin') && !userRoles.includes('manager') && !userRoles.includes('clinic_manager')

  // State
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [doctors, setDoctors] = useState([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState('ALL')

  // Reminder Modal State
  const [reminderModalVisible, setReminderModalVisible] = useState(false)
  const [selectedRecordForReminder, setSelectedRecordForReminder] = useState(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderForm] = Form.useForm()

  // History Drawer State
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false)
  const [selectedRecordForHistory, setSelectedRecordForHistory] = useState(null)
  const [historyLogs, setHistoryLogs] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Load doctors for filter
  const fetchDoctors = useCallback(async () => {
    if (isDoctor && !canSend) {
      setDoctors(SYSTEM_DOCTORS)
      return
    }

    setDoctorsLoading(true)
    try {
      const res = await userApi.getDoctors()
      const data = res?.data?.data || res?.data || []
      const list = Array.isArray(data) && data.length > 0 ? data : SYSTEM_DOCTORS
      setDoctors(list)
    } catch (err) {
      console.warn('Could not load doctors from userApi, using fallback system doctors', err)
      setDoctors(SYSTEM_DOCTORS)
    } finally {
      setDoctorsLoading(false)
    }
  }, [isDoctor, canSend])

  // Load overdue records (fetches all pages up to 1000 items so KPIs and filters never truncate at 100)
  const fetchOverdueRecords = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    try {
      const params = { page: 0, size: 100 }
      if (selectedDoctorId) {
        params.doctorId = selectedDoctorId
      } else if (isDoctor && user?.id) {
        params.doctorId = user.id
      }
      const res = await medicalRecordApi.getOverdueSigning(params)
      const firstPageData = res?.data?.content || res?.data?.data || (Array.isArray(res?.data) ? res.data : [])
      const serverTotal = res?.data?.totalElements != null ? Number(res?.data?.totalElements) : null
      const totalPages = res?.data?.totalPages ? Number(res?.data?.totalPages) : 1

      let allData = [...firstPageData]
      if (totalPages > 1) {
        const remainingPromises = []
        for (let p = 1; p < Math.min(totalPages, 10); p++) {
          remainingPromises.push(medicalRecordApi.getOverdueSigning({ ...params, page: p, size: 100 }))
        }
        const responses = await Promise.all(remainingPromises)
        responses.forEach((pageRes) => {
          const pageItems = pageRes?.data?.content || pageRes?.data?.data || (Array.isArray(pageRes?.data) ? pageRes.data : [])
          allData = allData.concat(pageItems)
        })
      }

      setRecords(allData)
      setTotalElements(serverTotal != null ? serverTotal : allData.length)
    } catch (err) {
      const errMsg = getApiErrorMessage(err, 'Không thể tải danh sách bệnh án quá hạn ký.')
      message.error(errMsg)
    } finally {
      setLoading(false)
    }
  }, [canView, selectedDoctorId, isDoctor, user?.id])

  useEffect(() => {
    if (canView) {
      fetchDoctors()
      fetchOverdueRecords()
    }
  }, [canView, fetchDoctors, fetchOverdueRecords])

  // Merge doctors from all sources: SYSTEM_DOCTORS, userApi.getDoctors(), records, and current user
  const doctorOptions = useMemo(() => {
    const map = new Map()

    // 1. Predefined system doctors
    SYSTEM_DOCTORS.forEach((d) => {
      map.set(String(d.id).toLowerCase(), d)
    })

    // 2. Doctors from userApi.getDoctors()
    doctors.forEach((d) => {
      if (d?.id) {
        const idKey = String(d.id).toLowerCase()
        const existing = map.get(idKey)
        map.set(idKey, {
          ...existing,
          ...d,
          fullName: d.fullName || d.name || existing?.fullName || d.username,
        })
      }
    })

    // 3. Current logged-in user if doctor
    if (user?.id && isDoctor) {
      const idKey = String(user.id).toLowerCase()
      const existing = map.get(idKey)
      const resolvedName =
        existing?.fullName ||
        (user.fullName && user.fullName !== user.username
          ? (user.fullName.startsWith('BS') ? user.fullName : `BS. ${user.fullName}`)
          : `BS. ${user.username || 'phụ trách'}`)
      map.set(idKey, {
        ...existing,
        id: user.id,
        fullName: resolvedName,
        username: user.username,
        email: user.email,
      })
    }

    // 4. Any doctor found in overdue records
    records.forEach((r) => {
      if (r?.doctorId) {
        const idKey = String(r.doctorId).toLowerCase()
        const existing = map.get(idKey)
        map.set(idKey, {
          ...existing,
          id: r.doctorId,
          fullName: r.doctorFullName || existing?.fullName || `Bác sĩ ${r.doctorId.slice(0, 8)}...`,
          email: r.doctorEmail || existing?.email,
          phone: r.doctorPhone || existing?.phone,
        })
      }
    })

    return Array.from(map.values())
  }, [doctors, records, user, isDoctor])

  const currentDoctorName = useMemo(() => {
    return getDoctorDisplayName(selectedDoctorId, doctorOptions, user)
  }, [selectedDoctorId, doctorOptions, user])

  // Filtered list
  const filteredRecords = useMemo(() => {
    return filterOverdueRecords(records, {
      searchQuery,
      doctorId: selectedDoctorId,
      severityLevel: selectedSeverity,
    })
  }, [records, searchQuery, selectedDoctorId, selectedSeverity])

  // KPI calculations (aggregates from all records & server total)
  const kpiData = useMemo(() => {
    return calculateOverdueKpis(records, totalElements)
  }, [records, totalElements])

  // Open Send Reminder Modal
  const handleOpenReminderModal = (record) => {
    setSelectedRecordForReminder(record)
    reminderForm.resetFields()
    reminderForm.setFieldsValue({
      channel: 'SYSTEM',
      notes: `Kính gửi Bác sĩ ${record.doctorFullName || ''}, hồ sơ bệnh án mã khám ${record.visitCode || ''} (Bệnh nhân: ${record.patientFullName || ''}) đã trễ hạn ký ${formatOverdueHours(record.overdueHours)}. Kính đề nghị Bác sĩ kiểm tra và ký số hoàn thiện hồ sơ.`,
    })
    setReminderModalVisible(true)
  }

  // Submit Reminder
  const handleSubmitReminder = async (values) => {
    if (!selectedRecordForReminder?.medicalRecordId) return

    const validation = validateSendReminderForm(values)
    if (!validation.isValid) {
      message.error(validation.errors[0])
      return
    }

    setSendingReminder(true)
    try {
      await medicalRecordApi.sendSigningReminder(
        selectedRecordForReminder.medicalRecordId,
        {
          channel: values.channel || 'SYSTEM',
          notes: values.notes?.trim() || null,
        }
      )
      message.success('Đã gửi thông báo nhắc ký thành công!')
      setReminderModalVisible(false)
      // Refresh list to update reminderCount and lastRemindedAt
      fetchOverdueRecords()
    } catch (err) {
      const errMsg = getApiErrorMessage(err, 'Gửi nhắc ký thất bại. Vui lòng thử lại.')
      message.error(errMsg)
    } finally {
      setSendingReminder(false)
    }
  }

  // Open History Drawer
  const handleOpenHistoryDrawer = async (record) => {
    setSelectedRecordForHistory(record)
    setHistoryDrawerVisible(true)
    setHistoryLoading(true)
    try {
      const res = await medicalRecordApi.getSigningReminders(record.medicalRecordId)
      const list = res?.data?.data || (Array.isArray(res?.data) ? res.data : [])
      setHistoryLogs(list)
    } catch (err) {
      const errMsg = getApiErrorMessage(err, 'Không thể tải lịch sử nhắc ký của bệnh án.')
      message.error(errMsg)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedDoctorId(isDoctor && user?.id ? user.id : '')
    setSelectedSeverity('ALL')
  }

  // Access denied guard (TC-04)
  if (!canView) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '40px auto' }}>
        <Alert
          type="error"
          showIcon
          message="Từ chối truy cập (403 Forbidden)"
          description="Bạn không có quyền truy cập vào chức năng Theo dõi và nhắc ký bệnh án quá hạn (NCL-11-CN-006). Vui lòng liên hệ Quản trị viên nếu bạn cần hỗ trợ."
          action={
            <Button type="primary" onClick={() => navigate('/')}>
              Về trang chủ
            </Button>
          }
        />
      </div>
    )
  }

  // Table columns definition
  const columns = [
    {
      title: 'Mã khám & Bệnh án',
      key: 'visitInfo',
      width: 170,
      render: (_, record) => {
        const statusInfo = formatMedicalRecordStatus(record.status)
        return (
          <div>
            <div style={{ fontWeight: 600, color: '#1677ff', fontSize: 13 }}>
              {record.visitCode || 'N/A'}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              ID: {record.medicalRecordId?.slice(0, 8)}...
            </div>
            <Tag color={statusInfo.color} style={{ marginTop: 4, fontSize: 11 }}>
              {statusInfo.label}
            </Tag>
          </div>
        )
      },
    },
    {
      title: 'Bệnh nhân',
      key: 'patientInfo',
      width: 190,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{record.patientFullName || 'Chưa rõ'}</div>
          <div style={{ fontSize: 12, color: '#595959' }}>Mã BN: {record.patientCode || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Bác sĩ phụ trách',
      key: 'doctorInfo',
      width: 200,
      render: (_, record) => {
        const docName =
          record.doctorFullName ||
          getDoctorDisplayName(record.doctorId, doctorOptions, user) ||
          'Bác sĩ phụ trách'
        return (
          <div>
            <div style={{ fontWeight: 600, color: '#262626' }}>
              <UserOutlined style={{ marginRight: 6, color: '#1890ff' }} />
              {docName}
            </div>
            {record.doctorEmail && (
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.doctorEmail}</div>
            )}
            {record.doctorPhone && (
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>SĐT: {record.doctorPhone}</div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Khám xong & Hạn ký',
      key: 'timingInfo',
      width: 190,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: '#8c8c8c' }}>Khám xong: </span>
            {record.visitCompletedAt ? formatDateTime(record.visitCompletedAt) : 'N/A'}
          </div>
          <div style={{ fontSize: 12, marginTop: 2 }}>
            <span style={{ color: '#8c8c8c' }}>Hạn ký: </span>
            <Text type="danger" style={{ fontWeight: 500 }}>
              {record.deadlineAt ? formatDateTime(record.deadlineAt) : `+${record.signingDeadlineHours || 24}h`}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Thời gian trễ hạn',
      key: 'overdueHours',
      width: 170,
      sorter: (a, b) => (Number(a.overdueHours) || 0) - (Number(b.overdueHours) || 0),
      render: (_, record) => {
        const severity = getOverdueSeverity(record.overdueHours)
        return (
          <div>
            <Tag
              color={severity.tagColor}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              Quá {formatOverdueHours(record.overdueHours)}
            </Tag>
            <div style={{ fontSize: 11, color: severity.color, marginTop: 3 }}>
              {severity.text}
            </div>
          </div>
        )
      },
    },
    {
      title: 'Tình trạng nhắc',
      key: 'reminderStats',
      width: 170,
      render: (_, record) => {
        const count = Number(record.reminderCount) || 0
        if (count === 0) {
          return <Badge status="default" text="Chưa gửi nhắc" />
        }
        return (
          <div>
            <Tag color="blue" style={{ fontWeight: 500 }}>
              <BellOutlined style={{ marginRight: 4 }} />
              Đã nhắc {count} lần
            </Tag>
            {record.lastRemindedAt && (
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                Gần nhất: {formatDateTime(record.lastRemindedAt)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 75,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const menuItems = []

        if (isDoctor) {
          menuItems.push({
            key: 'sign',
            icon: <EditOutlined style={{ color: '#16a34a' }} />,
            label: (
              <span id={`btn-sign-${record.medicalRecordId}`} style={{ fontWeight: 600, color: '#16a34a' }}>
                Ký ngay
              </span>
            ),
            onClick: () => navigate(`/medical-records/visits/${record.visitId}`),
          })
        }

        if (canSend) {
          menuItems.push({
            key: 'remind',
            icon: <BellOutlined style={{ color: '#0284c7' }} />,
            label: (
              <span id={`btn-remind-${record.medicalRecordId}`} style={{ fontWeight: 600, color: '#0284c7' }}>
                Nhắc ký
              </span>
            ),
            onClick: () => handleOpenReminderModal(record),
          })
        }

        if (menuItems.length > 0) {
          menuItems.push({ type: 'divider' })
        }

        menuItems.push({
          key: 'history',
          icon: <HistoryOutlined style={{ color: '#64748b' }} />,
          label: (
            <span id={`btn-history-${record.medicalRecordId}`}>
              Lịch sử nhắc ký
            </span>
          ),
          onClick: () => handleOpenHistoryDrawer(record),
        })

        menuItems.push({
          key: 'view',
          icon: <EyeOutlined style={{ color: '#64748b' }} />,
          label: (
            <span id={`btn-view-${record.medicalRecordId}`}>
              Xem bệnh án
            </span>
          ),
          onClick: () => navigate(`/medical-records/visits/${record.visitId}`),
        })

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined style={{ fontSize: 18, color: '#475569' }} />}
              id={`btn-action-${record.medicalRecordId}`}
              aria-label="Thao tác"
              title="Thao tác"
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
              }}
            />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {isDoctor ? 'Bệnh án quá hạn ký cần hoàn thiện' : 'Theo dõi và nhắc ký bệnh án quá hạn'}
        </Title>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchOverdueRecords}
            loading={loading}
            style={{ height: 38, borderRadius: 6 }}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      {/* KPI Stats Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              borderLeft: '4px solid #fa8c16',
            }}
          >
            <Statistic
              title="Tổng bệnh án quá hạn"
              value={kpiData.totalRecords}
              valueStyle={{ color: '#d46b08', fontWeight: 700 }}
              prefix={<ClockCircleOutlined style={{ marginRight: 6 }} />}
              suffix="hồ sơ"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              borderLeft: '4px solid #f5222d',
            }}
          >
            <Statistic
              title="Quá hạn cao (>24h)"
              value={kpiData.criticalRecords}
              valueStyle={{ color: '#cf1322', fontWeight: 700 }}
              prefix={<ExclamationCircleOutlined style={{ marginRight: 6 }} />}
              suffix="hồ sơ"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              borderLeft: '4px solid #1890ff',
            }}
          >
            <Statistic
              title="Bác sĩ có hồ sơ tồn"
              value={kpiData.uniqueDoctors}
              valueStyle={{ color: '#096dd9', fontWeight: 700 }}
              prefix={<TeamOutlined style={{ marginRight: 6 }} />}
              suffix="bác sĩ"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              borderLeft: '4px solid #52c41a',
            }}
          >
            <Statistic
              title="Tổng lượt nhắc đã gửi"
              value={kpiData.totalRemindersSent}
              valueStyle={{ color: '#389e0d', fontWeight: 700 }}
              prefix={<BellOutlined style={{ marginRight: 6 }} />}
              suffix="lượt"
            />
          </Card>
        </Col>
      </Row>

      {/* Filter and Search Bar */}
      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Tìm mã khám, mã BN, tên bệnh nhân, tên bác sĩ..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ height: 38, borderRadius: 6 }}
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%', height: 38 }}
              placeholder="Lọc theo bác sĩ phụ trách"
              value={isDoctor ? (user?.id || selectedDoctorId || undefined) : (selectedDoctorId || undefined)}
              onChange={(val) => setSelectedDoctorId(val || '')}
              allowClear={!isDoctor}
              disabled={isDoctor && !canSend}
              loading={doctorsLoading}
              showSearch
              optionFilterProp="label"
              options={[
                ...(!isDoctor ? [{ value: '', label: 'Tất cả bác sĩ' }] : []),
                ...doctorOptions.map((doc) => ({
                  value: doc.id,
                  label: doc.fullName || doc.name || doc.username,
                })),
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%', height: 38 }}
              value={selectedSeverity}
              onChange={(val) => setSelectedSeverity(val)}
            >
              <Select.Option value="ALL">Tất cả mức độ trễ hạn</Select.Option>
              <Select.Option value="MODERATE">Quá hạn (&lt; 24h)</Select.Option>
              <Select.Option value="HIGH">Trễ hạn cao (24h - 72h)</Select.Option>
              <Select.Option value="CRITICAL">Trễ hạn nghiêm trọng (&gt; 72h)</Select.Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={4} style={{ textAlign: 'right' }}>
            <Button
              onClick={handleResetFilters}
              style={{ height: 38, borderRadius: 6, width: '100%' }}
            >
              Xóa lọc
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Table Card */}
      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={filteredRecords}
          columns={columns}
          rowKey={(r) => r.medicalRecordId || r.visitId}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} hồ sơ quá hạn`,
          }}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có bệnh án nào quá hạn ký theo điều kiện lọc"
              />
            ),
          }}
        />
      </Card>

      {/* Modal Send Signing Reminder (TC-02) */}
      <Modal
        title={
          <Space>
            <BellOutlined style={{ color: '#1677ff' }} />
            <span>Gửi thông báo nhắc ký bệnh án</span>
          </Space>
        }
        open={reminderModalVisible}
        onCancel={() => setReminderModalVisible(false)}
        footer={null}
        destroyOnClose
        width={560}
      >
        {selectedRecordForReminder && (
          <div>
            <Descriptions
              size="small"
              bordered
              column={1}
              style={{ marginBottom: 16, marginTop: 12 }}
            >
              <Descriptions.Item label="Mã lượt khám">
                <Text strong style={{ color: '#1677ff' }}>
                  {selectedRecordForReminder.visitCode || 'N/A'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Bệnh nhân">
                {selectedRecordForReminder.patientFullName} (Mã: {selectedRecordForReminder.patientCode})
              </Descriptions.Item>
              <Descriptions.Item label="Bác sĩ phụ trách">
                <Text strong>{selectedRecordForReminder.doctorFullName}</Text>
                {selectedRecordForReminder.doctorEmail && (
                  <span style={{ color: '#8c8c8c', marginLeft: 8 }}>
                    ({selectedRecordForReminder.doctorEmail})
                  </span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian trễ hạn">
                <Tag color={getOverdueSeverity(selectedRecordForReminder.overdueHours).tagColor}>
                  Quá {formatOverdueHours(selectedRecordForReminder.overdueHours)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Số lần đã nhắc">
                <Text>{selectedRecordForReminder.reminderCount || 0} lần</Text>
              </Descriptions.Item>
            </Descriptions>

            <Form
              form={reminderForm}
              layout="vertical"
              onFinish={handleSubmitReminder}
              initialValues={{ channel: 'SYSTEM' }}
            >
              <Form.Item
                name="channel"
                label="Kênh thông báo nhắc nhở"
                rules={[{ required: true, message: 'Vui lòng chọn kênh gửi nhắc' }]}
              >
                <Radio.Group>
                  <Radio.Button value="SYSTEM">
                    <BellOutlined style={{ marginRight: 4 }} />
                    Hệ thống
                  </Radio.Button>
                  <Radio.Button value="EMAIL">
                    <MailOutlined style={{ marginRight: 4 }} />
                    Email
                  </Radio.Button>
                  <Radio.Button value="SMS">
                    <MessageOutlined style={{ marginRight: 4 }} />
                    SMS
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="notes"
                label="Nội dung lời dặn / Ghi chú gửi Bác sĩ"
                rules={[
                  { max: 500, message: 'Ghi chú không được vượt quá 500 ký tự' },
                ]}
              >
                <TextArea
                  rows={4}
                  maxLength={500}
                  showCount
                  placeholder="Nhập nội dung nhắc nhở Bác sĩ phụ trách hoàn tất ký số hồ sơ bệnh án..."
                />
              </Form.Item>

              <div style={{ textAlign: 'right', marginTop: 24 }}>
                <Space>
                  <Button
                    onClick={() => setReminderModalVisible(false)}
                    style={{ height: 38, minWidth: 96, borderRadius: 6 }}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={sendingReminder}
                    icon={<SendOutlined />}
                    style={{ height: 38, minWidth: 96, borderRadius: 6 }}
                  >
                    Gửi nhắc ký
                  </Button>
                </Space>
              </div>
            </Form>
          </div>
        )}
      </Modal>

      {/* Drawer Reminder History Logs (TC-02) */}
      <Drawer
        title={
          <Space>
            <HistoryOutlined style={{ color: '#1677ff' }} />
            <span>Lịch sử gửi nhắc ký bệnh án</span>
          </Space>
        }
        open={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
        width={500}
      >
        {selectedRecordForHistory && (
          <div style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Mã khám">
                <Text strong style={{ color: '#1677ff' }}>
                  {selectedRecordForHistory.visitCode}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Bệnh nhân">
                {selectedRecordForHistory.patientFullName}
              </Descriptions.Item>
              <Descriptions.Item label="Bác sĩ">
                {selectedRecordForHistory.doctorFullName}
              </Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '16px 0' }} />
          </div>
        )}

        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="Đang tải lịch sử nhắc..." />
          </div>
        ) : historyLogs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có lượt nhắc ký nào được gửi cho bệnh án này"
          />
        ) : (
          <Timeline mode="left">
            {historyLogs.map((log) => {
              const ch = formatReminderChannel(log.channel)
              const st = formatReminderStatus(log.status)
              return (
                <Timeline.Item
                  key={log.id}
                  color={log.status === 'SENT' ? 'blue' : 'red'}
                  label={
                    <div style={{ fontSize: 11, color: '#8c8c8c', width: 90 }}>
                      {log.remindedAt ? dayjs(log.remindedAt).format('DD/MM HH:mm') : ''}
                    </div>
                  }
                >
                  <div style={{ background: '#fafafa', padding: 10, borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Tag color={ch.color}>{ch.text}</Tag>
                      <Tag color={st.color}>{st.text}</Tag>
                    </div>
                    <div style={{ fontSize: 12, color: '#262626' }}>
                      <span style={{ color: '#8c8c8c' }}>Người gửi: </span>
                      {log.remindedByName || 'Hệ thống'}
                    </div>
                    <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
                      <span style={{ color: '#8c8c8c' }}>Quá hạn lúc gửi: </span>
                      {formatOverdueHours(log.overdueHours)}
                    </div>
                    {log.notes && (
                      <div
                        style={{
                          fontSize: 12,
                          background: '#fff',
                          padding: '6px 8px',
                          borderRadius: 4,
                          marginTop: 6,
                          border: '1px solid #f0f0f0',
                        }}
                      >
                        {log.notes}
                      </div>
                    )}
                  </div>
                </Timeline.Item>
              )
            })}
          </Timeline>
        )}
      </Drawer>
    </div>
  )
}
