import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Select,
  Checkbox,
  DatePicker,
  Space,
  Tag,
  Tooltip,
  Typography,
  Row,
  Col,
  Alert,
  Badge,
  Spin,
  message,
  Empty,
  Result,
  Dropdown,
  Pagination,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import personalDataRequestApi from '../api/personalDataRequestApi.js'
import patientApi from '../api/patientApi.js'
import userApi from '../api/userApi.js'
import { useAuthContext } from '../context/AuthContext.jsx'
import CreatePersonalDataRequestModal from '../components/personaldata/CreatePersonalDataRequestModal.jsx'
import CompletePersonalDataRequestModal from '../components/personaldata/CompletePersonalDataRequestModal.jsx'
import PersonalDataRequestDetailDrawer from '../components/personaldata/PersonalDataRequestDetailDrawer.jsx'
import {
  REQUEST_TYPE_OPTIONS,
  getRequestTypeLabel,
  getStatusTag,
  getOverdueFlag,
  isUpcomingDue,
  canComplete,
  mapPersonalDataRequestError,
} from '../utils/personalDataRequestHelpers.js'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

/**
 * Trang Tiếp nhận và xử lý yêu cầu về dữ liệu cá nhân (NCL-15-CN-006 / QTN-24, QTN-19)
 * Dành riêng cho Quản trị viên (ADMIN).
 */
const PersonalDataRequestManagementPage = () => {
  const { user } = useAuthContext()
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId')

  // Phân quyền: chỉ ADMIN có quyền
  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  }, [user])
  const isAdmin = userRoles.includes('admin')

  // Trạng thái bộ lọc
  const [selectedPatientId, setSelectedPatientId] = useState(urlPatientId || undefined)
  const [selectedStatus, setSelectedStatus] = useState(undefined)
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [dateRange, setDateRange] = useState(null)

  // Phân trang server-side
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalElements, setTotalElements] = useState(0)

  // Danh sách dữ liệu chính
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)

  // Cảnh báo thời hạn (getDeadlineAlerts)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)

  // Caches tra cứu bệnh nhân & người xử lý
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [users, setUsers] = useState([])

  // Quản lý Modal & Drawer
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [selectedRequestForComplete, setSelectedRequestForComplete] = useState(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [detailRequestId, setDetailRequestId] = useState(null)

  // Tải danh sách bệnh nhân
  const loadPatients = useCallback(async () => {
    setPatientsLoading(true)
    try {
      const res = await patientApi.getAll({ page: 0, size: 500 })
      const list = Array.isArray(res.data?.content)
        ? res.data.content
        : Array.isArray(res.data)
        ? res.data
        : []
      setPatients(list)
    } catch {
      // Bỏ qua lỗi ngầm
    } finally {
      setPatientsLoading(false)
    }
  }, [])

  // Tải danh sách người dùng để hiển thị tên người xử lý
  const loadUsers = useCallback(async () => {
    try {
      const res = await (userApi.list ? userApi.list() : userApi.getAll())
      const list = Array.isArray(res.data?.content)
        ? res.data.content
        : Array.isArray(res.data)
        ? res.data
        : []
      setUsers(list)
    } catch {
      // Bỏ qua lỗi ngầm
    }
  }, [])

  // Tải các cảnh báo hạn xử lý (UPCOMING, OVERDUE)
  const loadDeadlineAlerts = useCallback(async () => {
    if (!isAdmin) return
    setAlertsLoading(true)
    try {
      const res = await personalDataRequestApi.getDeadlineAlerts()
      const content = Array.isArray(res.data?.content)
        ? res.data.content
        : Array.isArray(res.data)
        ? res.data
        : []
      setAlerts(content)
    } catch {
      // Bỏ qua lỗi cảnh báo ngầm
    } finally {
      setAlertsLoading(false)
    }
  }, [isAdmin])

  // Tải danh sách yêu cầu với bộ lọc và phân trang SERVER-SIDE
  const loadRequests = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const params = {
        page: currentPage - 1, // Spring Pageable 0-indexed
        size: pageSize,
        sort: 'dueAt,asc', // Giữ nguyên sort do backend quy định
      }

      if (selectedPatientId) {
        params.patientId = selectedPatientId
      }
      if (selectedStatus) {
        params.status = selectedStatus
      }
      if (onlyOverdue) {
        params.overdue = true
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.dueFrom = dateRange[0].startOf('day').toISOString()
        params.dueTo = dateRange[1].endOf('day').toISOString()
      }

      const res = await personalDataRequestApi.search(params)
      const data = res.data

      if (data && typeof data === 'object') {
        const content = Array.isArray(data.content)
          ? data.content
          : Array.isArray(data)
          ? data
          : []
        setRequests(content)
        // DÙNG ĐÚNG totalElements TỪ SERVER, KHÔNG TỰ ĐẾM CLIENT
        setTotalElements(typeof data.totalElements === 'number' ? data.totalElements : content.length)
      } else {
        setRequests([])
        setTotalElements(0)
      }
    } catch (err) {
      const errMsg = mapPersonalDataRequestError(err, 'Không thể tải danh sách yêu cầu dữ liệu cá nhân.')
      message.error(errMsg)
      setRequests([])
      setTotalElements(0)
    } finally {
      setLoading(false)
    }
  }, [
    isAdmin,
    currentPage,
    pageSize,
    selectedPatientId,
    selectedStatus,
    onlyOverdue,
    dateRange,
  ])

  // Khởi tạo dữ liệu
  useEffect(() => {
    if (isAdmin) {
      loadPatients()
      loadUsers()
      loadDeadlineAlerts()
    }
  }, [isAdmin, loadPatients, loadUsers, loadDeadlineAlerts])

  useEffect(() => {
    if (isAdmin) {
      loadRequests()
    }
  }, [isAdmin, loadRequests])

  // Xây dựng map bệnh nhân và người dùng để tra cứu nhanh
  const patientMap = useMemo(() => {
    const map = new Map()
    patients.forEach((p) => {
      if (p?.id) map.set(String(p.id), p)
    })
    return map
  }, [patients])

  const userMap = useMemo(() => {
    const map = new Map()
    users.forEach((u) => {
      if (u?.id) map.set(String(u.id), u)
    })
    return map
  }, [users])

  // Phân nhóm cảnh báo
  const upcomingAlerts = useMemo(() => {
    return alerts.filter((a) => a.alertType === 'UPCOMING')
  }, [alerts])

  const overdueAlerts = useMemo(() => {
    return alerts.filter((a) => a.alertType === 'OVERDUE')
  }, [alerts])

  // Xử lý đổi bộ lọc -> reset về trang 1
  const handlePatientFilterChange = (val) => {
    setSelectedPatientId(val)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (val) => {
    setSelectedStatus(val)
    setCurrentPage(1)
  }

  const handleOverdueFilterChange = (e) => {
    setOnlyOverdue(e.target.checked)
    setCurrentPage(1)
  }

  const handleDateRangeChange = (dates) => {
    setDateRange(dates)
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    setSelectedPatientId(undefined)
    setSelectedStatus(undefined)
    setOnlyOverdue(false)
    setDateRange(null)
    setCurrentPage(1)
  }

  const handleOpenDetail = (id) => {
    setDetailRequestId(id)
    setDetailDrawerOpen(true)
  }

  const handleOpenCompleteModal = (req) => {
    setSelectedRequestForComplete(req)
    setCompleteModalOpen(true)
  }

  const handleActionSuccess = () => {
    loadRequests()
    loadDeadlineAlerts()
  }

  // Nếu không phải ADMIN -> chặn hoàn toàn
  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="403 - Quyền truy cập bị từ chối"
        subTitle="Chức năng tiếp nhận và xử lý yêu cầu về dữ liệu cá nhân chỉ dành riêng cho Quản trị viên (ADMIN)."
      />
    )
  }

  // Định nghĩa các cột cho Table
  const columns = [
    {
      title: 'Bệnh nhân',
      key: 'patient',
      width: 170,
      render: (_, record) => {
        const patient = patientMap.get(String(record.patientId))
        const name = patient?.fullName || record.patientId
        const code = patient?.patientCode ? `[${patient.patientCode}] ` : ''
        return (
          <div>
            <Text strong style={{ color: '#1e293b' }}>{name}</Text>
            {code && (
              <div style={{ fontSize: 12, color: '#64748b' }}>{code}</div>
            )}
            {patient?.phone && (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{patient.phone}</div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Loại yêu cầu',
      dataIndex: 'requestType',
      key: 'requestType',
      width: 150,
      render: (type) => (
        <span style={{ fontWeight: 600, color: '#1e293b' }}>
          {getRequestTypeLabel(type)}
        </span>
      ),
    },
    {
      title: 'Lý do yêu cầu',
      dataIndex: 'reason',
      key: 'reason',
      width: 180,
      render: (reason) => {
        if (!reason) return <span style={{ color: '#9ca3af' }}>---</span>
        return (
          <Tooltip title={reason} placement="topLeft">
            <div
              style={{
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.5,
                maxHeight: 48,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                color: '#334155',
              }}
            >
              {reason}
            </div>
          </Tooltip>
        )
      },
    },
    {
      title: 'Ngày tiếp nhận',
      dataIndex: 'receivedAt',
      key: 'receivedAt',
      width: 140,
      render: (receivedAt) =>
        receivedAt ? (
          <span style={{ color: '#334155', whiteSpace: 'nowrap' }}>
            {dayjs(receivedAt).format('DD/MM/YYYY HH:mm')}
          </span>
        ) : (
          '---'
        ),
    },
    {
      title: 'Hạn xử lý',
      dataIndex: 'dueAt',
      key: 'dueAt',
      width: 150,
      render: (dueAt, record) => {
        if (!dueAt) return '---'
        const isOverdue = getOverdueFlag(record)
        const isUpcoming = isUpcomingDue(record)

        let color = '#334155'
        let fontWeight = 500
        let badgeTag = null

        if (isOverdue) {
          color = '#dc2626'
          fontWeight = 600
          badgeTag = (
            <Tag color="error" style={{ margin: '4px 0 0 0', fontSize: 11 }}>
              Quá hạn
            </Tag>
          )
        } else if (isUpcoming) {
          color = '#d97706'
          fontWeight = 600
          badgeTag = (
            <Tag color="warning" style={{ margin: '4px 0 0 0', fontSize: 11 }}>
              &lt;24h
            </Tag>
          )
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ color, fontWeight, whiteSpace: 'nowrap' }}>
              {dayjs(dueAt).format('DD/MM/YYYY HH:mm')}
            </span>
            {badgeTag}
          </div>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const tag = getStatusTag(status)
        return (
          <Tag color={tag.color} style={{ fontWeight: 600, padding: '2px 8px' }}>
            {tag.label}
          </Tag>
        )
      },
    },
    {
      title: 'Kết quả xử lý',
      dataIndex: 'result',
      key: 'result',
      width: 180,
      render: (result) => {
        if (!result) return <span style={{ color: '#9ca3af' }}>—</span>
        return (
          <Tooltip title={result} placement="topLeft">
            <div
              style={{
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.5,
                maxHeight: 48,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                color: '#15803d',
                fontWeight: 500,
              }}
            >
              {result}
            </div>
          </Tooltip>
        )
      },
    },
    {
      title: 'Người xử lý',
      dataIndex: 'processedBy',
      key: 'processedBy',
      width: 150,
      render: (processedBy) => {
        if (!processedBy) return <span style={{ color: '#9ca3af' }}>—</span>
        const processor = userMap.get(String(processedBy))
        return processor?.fullName ? (
          <span style={{ fontWeight: 500, color: '#334155' }}>{processor.fullName}</span>
        ) : (
          <Tooltip title={processedBy}>
            <Text code style={{ fontSize: 12 }}>
              {String(processedBy).slice(0, 10)}...
            </Text>
          </Tooltip>
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
        const isActionable = canComplete(record)
        const menuItems = [
          {
            key: 'detail',
            label: 'Xem chi tiết',
            icon: <EyeOutlined style={{ color: '#2563eb' }} />,
            onClick: () => handleOpenDetail(record.id),
          },
        ]

        if (isActionable) {
          menuItems.push({
            key: 'complete',
            label: 'Hoàn tất xử lý',
            icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
            onClick: () => handleOpenCompleteModal(record),
          })
        }

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

  const hasAlerts = upcomingAlerts.length > 0 || overdueAlerts.length > 0

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Tiêu đề trang & Nút hành động */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Tiếp nhận và xử lý yêu cầu về dữ liệu cá nhân
          </Title>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadRequests()
              loadDeadlineAlerts()
            }}
            loading={loading || alertsLoading}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Tiếp nhận yêu cầu mới
          </Button>
        </Space>
      </div>

      {/* KHỐI CẢNH BÁO ĐẦU TRANG (Ẩn nếu cả 2 mảng đều rỗng) */}
      {hasAlerts && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderColor: overdueAlerts.length > 0 ? '#fca5a5' : '#fcd34d',
            background: overdueAlerts.length > 0 ? '#fff1f2' : '#fefce8',
          }}
        >
          <Row gutter={[16, 12]} align="middle">
            {overdueAlerts.length > 0 && (
              <Col xs={24} md={upcomingAlerts.length > 0 ? 12 : 24}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <WarningOutlined style={{ color: '#dc2626', fontSize: 20 }} />
                  <div>
                    <Text strong style={{ color: '#b91c1c' }}>
                      Cảnh báo: Có {overdueAlerts.length} yêu cầu đã quá hạn xử lý!
                    </Text>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {overdueAlerts.slice(0, 5).map((alert) => (
                        <Button
                          key={alert.id}
                          size="small"
                          danger
                          type="dashed"
                          onClick={() => handleOpenDetail(alert.personalDataRequestId)}
                        >
                          Mở yêu cầu {String(alert.personalDataRequestId).slice(0, 8)}...
                        </Button>
                      ))}
                      {overdueAlerts.length > 5 && (
                        <Tag color="red">+{overdueAlerts.length - 5} yêu cầu khác</Tag>
                      )}
                    </div>
                  </div>
                </div>
              </Col>
            )}

            {upcomingAlerts.length > 0 && (
              <Col xs={24} md={overdueAlerts.length > 0 ? 12 : 24}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ClockCircleOutlined style={{ color: '#d97706', fontSize: 20 }} />
                  <div>
                    <Text strong style={{ color: '#b45309' }}>
                      Cảnh báo: Có {upcomingAlerts.length} yêu cầu sắp tới hạn trong 24 giờ tới!
                    </Text>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {upcomingAlerts.slice(0, 5).map((alert) => (
                        <Button
                          key={alert.id}
                          size="small"
                          type="dashed"
                          style={{ color: '#d97706', borderColor: '#f59e0b' }}
                          onClick={() => handleOpenDetail(alert.personalDataRequestId)}
                        >
                          Mở yêu cầu {String(alert.personalDataRequestId).slice(0, 8)}...
                        </Button>
                      ))}
                      {upcomingAlerts.length > 5 && (
                        <Tag color="warning">+{upcomingAlerts.length - 5} yêu cầu khác</Tag>
                      )}
                    </div>
                  </div>
                </div>
              </Col>
            )}
          </Row>
        </Card>
      )}

      {/* BỘ LỌC TÌM KIẾM */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Người bệnh
            </Text>
            <Select
              allowClear
              showSearch
              placeholder="Tất cả bệnh nhân"
              value={selectedPatientId}
              onChange={handlePatientFilterChange}
              loading={patientsLoading}
              filterOption={(input, option) =>
                String(option?.children || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
            >
              {patients.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.patientCode ? `[${p.patientCode}] ` : ''}
                  {p.fullName} {p.phone ? `(${p.phone})` : ''}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={5}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Trạng thái
            </Text>
            <Select
              allowClear
              placeholder="Tất cả trạng thái"
              value={selectedStatus}
              onChange={handleStatusFilterChange}
              style={{ width: '100%' }}
            >
              <Option value="RECEIVED">Chờ xử lý</Option>
              <Option value="COMPLETED">Đã hoàn tất</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={7}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Khoảng hạn xử lý
            </Text>
            <RangePicker
              format="DD/MM/YYYY"
              value={dateRange}
              onChange={handleDateRangeChange}
              style={{ width: '100%' }}
            />
          </Col>

          <Col xs={24} sm={12} md={6}>
            <div style={{ paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Checkbox checked={onlyOverdue} onChange={handleOverdueFilterChange}>
                <span style={{ fontWeight: onlyOverdue ? 600 : 400, color: onlyOverdue ? '#dc2626' : 'inherit' }}>
                  Chỉ hiện quá hạn
                </span>
              </Checkbox>

              <Button onClick={handleResetFilters} size="small">
                Đặt lại
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      {/* BẢNG DANH SÁCH YÊU CẦU (Phân trang SERVER-SIDE) */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1320 }}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không tìm thấy yêu cầu dữ liệu cá nhân nào phù hợp."
              />
            ),
          }}
        />

        {/* PHÂN TRANG: Luôn hiển thị ngay cả khi danh sách rỗng (theo yêu cầu) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: '1px solid #f0f0f0',
          }}
        >
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalElements}
            showSizeChanger
            pageSizeOptions={['10', '20', '50']}
            showTotal={(total, range) =>
              total > 0
                ? `${range[0]}-${range[1]} của ${total} yêu cầu`
                : '0 của 0 yêu cầu'
            }
            onChange={(page, size) => {
              setCurrentPage(page)
              setPageSize(size)
            }}
          />
        </div>
      </Card>

      {/* MODAL TIẾP NHẬN MỚI */}
      <CreatePersonalDataRequestModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleActionSuccess}
        initialPatientId={selectedPatientId}
      />

      {/* MODAL HOÀN TẤT XỬ LÝ */}
      <CompletePersonalDataRequestModal
        open={completeModalOpen}
        onClose={() => {
          setCompleteModalOpen(false)
          setSelectedRequestForComplete(null)
        }}
        onSuccess={handleActionSuccess}
        request={selectedRequestForComplete}
        patientName={
          selectedRequestForComplete
            ? patientMap.get(String(selectedRequestForComplete.patientId))?.fullName
            : ''
        }
      />

      {/* DRAWER CHI TIẾT */}
      <PersonalDataRequestDetailDrawer
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false)
          setDetailRequestId(null)
        }}
        requestId={detailRequestId}
        onOpenCompleteModal={(req) => {
          setDetailDrawerOpen(false)
          handleOpenCompleteModal(req)
        }}
        patientMap={patientMap}
        userMap={userMap}
      />
    </div>
  )
}

export default PersonalDataRequestManagementPage
