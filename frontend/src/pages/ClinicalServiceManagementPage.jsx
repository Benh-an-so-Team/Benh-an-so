import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
} from '@ant-design/icons'
import clinicalServiceApi from '../api/clinicalServiceApi'
import ClinicalServiceCreateModal from '../components/clinical-services/ClinicalServiceCreateModal'
import ClinicalServiceEditModal from '../components/clinical-services/ClinicalServiceEditModal'
import ClinicalReferenceRangeDrawer from '../components/clinical-services/ClinicalReferenceRangeDrawer'
import { useAuthContext } from '../context/AuthContext'
import {
  CLINICAL_RESULT_DATA_TYPES,
  CLINICAL_SERVICE_TYPES,
  translateClinicalErrorMessage,
} from '../utils/clinicalServiceValidation'
import '../styles/clinicalServices.css'

const { Title, Text, Paragraph } = Typography

export default function ClinicalServiceManagementPage() {
  const { user } = useAuthContext()

  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  }, [user])

  const isAdmin = userRoles.includes('admin')
  const canManage = userPermissions.includes('CLINICAL_SERVICE_MANAGE') || isAdmin

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [dataTypeFilter, setDataTypeFilter] = useState('ALL')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [rangeDrawerOpen, setRangeDrawerOpen] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [stats, setStats] = useState({
    total: 0,
    activeCount: 0,
    inactiveCount: 0,
    labCount: 0,
    imgCount: 0,
    otherCount: 0,
  })

  // TODO: size=1000 là giải pháp tạm tính stats trên tối đa 1000 bản ghi.
  // Khi danh mục CLS vượt 1000 kỹ thuật (theo TT 43/2013 và TT 21/2020/TT-BYT,
  // bệnh viện tuyến tỉnh/trung ương có thể có 1200-2000 kỹ thuật), số liệu
  // inactiveCount/otherCount sẽ bị sai lệch. Cần bổ sung endpoint backend
  // GET /system/clinical-services/stats dùng COUNT(*) query để tính chính xác
  // trên toàn bộ dữ liệu, không giới hạn bởi size.
  const loadStats = useCallback(async () => {
    try {
      const res = await clinicalServiceApi.search({ page: 0, size: 1000 })
      const allItems = Array.isArray(res.data?.content)
        ? res.data.content
        : Array.isArray(res.data)
          ? res.data
          : []
      const total = res.data?.totalElements ?? allItems.length
      const activeCount = allItems.filter((d) => d.active).length
      const inactiveCount = total - activeCount
      const labCount = allItems.filter((d) => d.serviceType === 'LAB_TEST').length
      const imgCount = allItems.filter((d) => d.serviceType === 'IMAGING').length
      const otherCount = total - labCount - imgCount
      setStats({ total, activeCount, inactiveCount, labCount, imgCount, otherCount })
    } catch (err) {
      console.error('Không thể tải dữ liệu thống kê cận lâm sàng:', err)
    }
  }, [])

  const loadData = useCallback(
    async (page = 1, size = 20, customFilters = {}) => {
      setLoading(true)
      try {
        const kw = customFilters.keyword !== undefined ? customFilters.keyword : keyword
        const st = customFilters.status !== undefined ? customFilters.status : statusFilter

        const params = {
          page: page - 1,
          size,
        }
        if (kw.trim()) params.keyword = kw.trim()
        if (st === 'ACTIVE') params.active = true
        if (st === 'INACTIVE') params.active = false

        const res = await clinicalServiceApi.search(params)
        const content = Array.isArray(res.data?.content)
          ? res.data.content
          : Array.isArray(res.data)
            ? res.data
            : []

        setData(content)
        setPagination((prev) => ({
          ...prev,
          current: page,
          pageSize: size,
          total: res.data?.totalElements != null ? res.data.totalElements : content.length,
        }))
      } catch (err) {
        console.error('Không thể tải danh sách kỹ thuật cận lâm sàng:', err)
        const msg = translateClinicalErrorMessage(err, 'Lỗi khi tải danh sách kỹ thuật cận lâm sàng từ máy chủ.')
        message.error(msg)
        setData([])
      } finally {
        setLoading(false)
      }
    },
    [keyword, statusFilter]
  )

  useEffect(() => {
    loadData(1, 20)
    loadStats()
  }, [])

  const isClientFilterActive = typeFilter !== 'ALL' || dataTypeFilter !== 'ALL'

  // TODO: Đề nghị Backend bổ sung @RequestParam serviceType, resultDataType 
  // vào GET /system/clinical-services để lọc đồng bộ từ server, tránh lệch 
  // pha giữa filter client-side và pagination server-side.
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (typeFilter !== 'ALL' && item.serviceType !== typeFilter) {
        return false
      }
      if (dataTypeFilter !== 'ALL' && item.resultDataType !== dataTypeFilter) {
        return false
      }
      return true
    })
  }, [data, typeFilter, dataTypeFilter])

  const handleToggleStatus = async (record, nextActive) => {
    if (!canManage || actionLoadingId) return

    setActionLoadingId(record.id)
    try {
      await clinicalServiceApi.updateStatus(record.id, nextActive)
      message.success(
        nextActive
          ? `Đã kích hoạt dịch vụ "${record.serviceName}"!`
          : `Đã tạm ngưng dịch vụ "${record.serviceName}"!`
      )
      loadData(pagination.current, pagination.pageSize)
      loadStats()
    } catch (err) {
      console.error('Lỗi đổi trạng thái dịch vụ CLS:', err)
      const msg = translateClinicalErrorMessage(err, 'Không thể thay đổi trạng thái dịch vụ.')
      message.error(msg)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleOpenRangeDrawer = (record) => {
    setSelectedService(record)
    setRangeDrawerOpen(true)
  }

  const handleOpenEditModal = (record) => {
    setSelectedService(record)
    setEditModalOpen(true)
  }

  const getServiceTypeBadge = (type) => {
    switch (type) {
      case 'LAB_TEST':
        return { label: 'Xét nghiệm', color: 'blue' }
      case 'IMAGING':
        return { label: 'CĐ hình ảnh', color: 'cyan' }
      case 'OTHER':
        return { label: 'Khác', color: 'purple' }
      default:
        return { label: type || '—', color: 'default' }
    }
  }

  const getResultDataTypeBadge = (type) => {
    switch (type) {
      case 'NUMBER':
        return { label: 'Số trị', color: 'green' }
      case 'TEXT':
        return { label: 'Văn bản', color: 'orange' }
      case 'FILE':
        return { label: 'Tệp tin', color: 'geekblue' }
      case 'MIXED':
        return { label: 'Hỗn hợp', color: 'magenta' }
      default:
        return { label: type || '—', color: 'default' }
    }
  }

  const renderReferenceRange = (range) => {
    if (!range || !range.trim()) {
      return <Text type="secondary">—</Text>
    }

    const trimmed = range.trim()

    if (trimmed.toLowerCase() === 'âm tính') {
      return <Tag color="green" style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>Âm tính</Tag>
    }
    if (trimmed.toLowerCase() === 'dương tính') {
      return <Tag color="red" style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>Dương tính</Tag>
    }

    if (trimmed.includes(';')) {
      const parts = trimmed.split(';').map((p) => p.trim()).filter(Boolean)
      return (
        <div className="clinical-ref-multiline">
          {parts.map((part, idx) => {
            const colonIdx = part.indexOf(':')
            if (colonIdx !== -1) {
              const label = part.substring(0, colonIdx + 1)
              const val = part.substring(colonIdx + 1).trim()
              return (
                <div key={idx} className="clinical-ref-row">
                  <span className="clinical-ref-gender-label">{label}</span>
                  <span className="clinical-ref-val">{val}</span>
                </div>
              )
            }
            return (
              <div key={idx} className="clinical-ref-row">
                <span className="clinical-ref-val">{part}</span>
              </div>
            )
          })}
        </div>
      )
    }

    return <span className="clinical-ref-single-val">{trimmed}</span>
  }

  const columns = [
    {
      title: 'Mã kỹ thuật',
      dataIndex: 'serviceCode',
      key: 'serviceCode',
      width: 110,
      fixed: 'left',
      render: (code) => <span className="clinical-service-code-badge">{code}</span>,
    },
    {
      title: 'Tên kỹ thuật cận lâm sàng',
      dataIndex: 'serviceName',
      key: 'serviceName',
      minWidth: 220,
      width: 250,
      render: (name) => <span className="clinical-service-name-title">{name}</span>,
    },
    {
      title: 'Phân loại',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 110,
      align: 'center',
      render: (type) => {
        const item = getServiceTypeBadge(type)
        return <Tag color={item.color} className="clinical-uniform-tag">{item.label}</Tag>
      },
    },
    {
      title: 'Kiểu kết quả',
      dataIndex: 'resultDataType',
      key: 'resultDataType',
      width: 110,
      align: 'center',
      render: (type) => {
        const item = getResultDataTypeBadge(type)
        return <Tag color={item.color} className="clinical-uniform-tag">{item.label}</Tag>
      },
    },
    {
      title: 'Đơn vị đo',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      align: 'center',
      render: (unit) => (unit ? <Tag color="blue" className="clinical-uniform-tag">{unit}</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: 'Khoảng tham chiếu',
      dataIndex: 'referenceRange',
      key: 'referenceRange',
      width: 175,
      render: (range) => renderReferenceRange(range),
    },
    {
      title: 'Ngưỡng chi tiết (Tuổi/Giới)',
      key: 'rangesCount',
      width: 145,
      align: 'center',
      render: (_, r) => {
        const count = Array.isArray(r.referenceRanges) ? r.referenceRanges.length : 0
        return (
          <Tooltip title="Nhấp để xem và cấu hình chi tiết các ngưỡng theo tuổi và giới tính">
            <span
              className="clinical-ranges-badge"
              onClick={() => handleOpenRangeDrawer(r)}
            >
              <SettingOutlined style={{ color: count > 0 ? '#2563eb' : '#94a3b8' }} />
              <span>
                {count > 0 ? (
                  <strong>{count} ngưỡng</strong>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Chưa đặt</span>
                )}
              </span>
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      key: 'active',
      width: 105,
      align: 'center',
      render: (active, record) => (
        <Popconfirm
          title="Xác nhận tạm ngưng kỹ thuật"
          description={`Bạn có chắc muốn tạm ngưng kỹ thuật "${record.serviceName}"? Bác sĩ sẽ không thể chỉ định kỹ thuật này cho đến khi được bật lại.`}
          onConfirm={() => handleToggleStatus(record, false)}
          okText="Tạm ngưng"
          okButtonProps={{ danger: true }}
          cancelText="Hủy"
          disabled={!record.active || !canManage}
        >
          <Switch
            checked={active}
            checkedChildren="Áp dụng"
            unCheckedChildren="Tạm ngưng"
            disabled={!canManage}
            loading={actionLoadingId === record.id}
            onChange={(val) => {
              if (val) {
                handleToggleStatus(record, true)
              }
            }}
          />
        </Popconfirm>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 90,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <div className="clinical-action-btns">
          <Tooltip title="Cấu hình ngưỡng tham chiếu chi tiết">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined style={{ color: '#2563eb' }} />}
              onClick={() => handleOpenRangeDrawer(record)}
            />
          </Tooltip>
          {canManage && (
            <Tooltip title="Chỉnh sửa thông tin kỹ thuật">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: '#059669' }} />}
                onClick={() => handleOpenEditModal(record)}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="clinical-services-page">
      <div className="clinical-services-header">
        <div className="clinical-services-header-content">
          <div className="clinical-services-header-titles">
            <h2>
              <ExperimentOutlined style={{ color: '#2563eb' }} />
              <span>Danh mục Cận lâm sàng & Ngưỡng tham chiếu</span>
            </h2>
          </div>

          <div className="clinical-services-header-actions">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadData(pagination.current, pagination.pageSize)
                loadStats()
              }}
              loading={loading}
            >
              Làm mới
            </Button>
            {canManage && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
                Thêm kỹ thuật CLS
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="clinical-kpi-grid">
        <div className="clinical-kpi-card">
          <div className="clinical-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <ExperimentOutlined />
          </div>
          <div className="clinical-kpi-info">
            <span className="clinical-kpi-value">{stats.total}</span>
            <span className="clinical-kpi-label">Tổng số kỹ thuật CLS</span>
          </div>
        </div>

        <div className="clinical-kpi-card">
          <div className="clinical-kpi-icon" style={{ background: '#ecfdf5', color: '#16a34a' }}>
            <CheckCircleOutlined />
          </div>
          <div className="clinical-kpi-info">
            <span className="clinical-kpi-value">{stats.activeCount}</span>
            <span className="clinical-kpi-label">Đang áp dụng</span>
          </div>
        </div>

        <div className="clinical-kpi-card">
          <div className="clinical-kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <StopOutlined />
          </div>
          <div className="clinical-kpi-info">
            <span className="clinical-kpi-value">{stats.inactiveCount}</span>
            <span className="clinical-kpi-label">Tạm ngừng sử dụng</span>
          </div>
        </div>

        <div className="clinical-kpi-card">
          <div className="clinical-kpi-icon" style={{ background: '#f0fdf4', color: '#059669' }}>
            <FileDoneOutlined />
          </div>
          <div className="clinical-kpi-info">
            <span className="clinical-kpi-value">{stats.labCount}</span>
            <span className="clinical-kpi-label">Xét nghiệm (LAB)</span>
          </div>
        </div>

        <div className="clinical-kpi-card">
          <div className="clinical-kpi-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <FileTextOutlined />
          </div>
          <div className="clinical-kpi-info">
            <span className="clinical-kpi-value">{stats.imgCount + stats.otherCount}</span>
            <span className="clinical-kpi-label">CĐHA & Kỹ thuật khác</span>
          </div>
        </div>
      </div>

      <div className="clinical-filter-card">
        <div className="clinical-filter-row">
          <div className="clinical-filter-left">
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo mã hoặc tên kỹ thuật..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => loadData(1, pagination.pageSize)}
              allowClear
              style={{ width: 280 }}
            />

            <Radio.Group
              value={statusFilter}
              onChange={(e) => {
                const val = e.target.value
                setStatusFilter(val)
                loadData(1, pagination.pageSize, { status: val })
              }}
              buttonStyle="solid"
            >
              <Radio.Button value="ALL">Tất cả</Radio.Button>
              <Radio.Button value="ACTIVE">Đang áp dụng</Radio.Button>
              <Radio.Button value="INACTIVE">Tạm ngưng</Radio.Button>
            </Radio.Group>

            <Select
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val)
                setPagination((prev) => ({ ...prev, current: 1 }))
                loadData(1, pagination.pageSize)
              }}
              style={{ width: 195 }}
              popupMatchSelectWidth={false}
              dropdownMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 220 }}
              options={[
                { value: 'ALL', label: 'Tất cả loại kỹ thuật' },
                ...CLINICAL_SERVICE_TYPES.map((t) => ({
                  value: t.value,
                  label: t.shortLabel || t.label,
                })),
              ]}
            />

            <Select
              value={dataTypeFilter}
              onChange={(val) => {
                setDataTypeFilter(val)
                setPagination((prev) => ({ ...prev, current: 1 }))
                loadData(1, pagination.pageSize)
              }}
              style={{ width: 220 }}
              popupMatchSelectWidth={false}
              dropdownMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 260 }}
              options={[
                { value: 'ALL', label: 'Tất cả kiểu kết quả' },
                ...CLINICAL_RESULT_DATA_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                })),
              ]}
            />
          </div>

          <Button
            icon={<SearchOutlined />}
            type="primary"
            onClick={() => loadData(1, pagination.pageSize)}
          >
            Tìm kiếm
          </Button>
        </div>
      </div>

      <div className="clinical-table-card">
        {isClientFilterActive && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 12px',
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: 6,
              color: '#b45309',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <InfoCircleOutlined />
            <span>
              Bộ lọc chỉ áp dụng trên trang hiện tại, kết quả có thể chưa đầy đủ.
            </span>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1150 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: isClientFilterActive ? filteredData.length : pagination.total,
            showSizeChanger: !isClientFilterActive,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) =>
              isClientFilterActive
                ? `Hiển thị ${filteredData.length} kỹ thuật sau lọc trên trang hiện tại`
                : `Tổng cộng ${total} kỹ thuật`,
            onChange: (page, pageSize) => loadData(page, pageSize),
          }}
          locale={{
            emptyText: (
              <Empty
                description="Không tìm thấy kỹ thuật cận lâm sàng nào phù hợp với bộ lọc."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </div>

      <ClinicalServiceCreateModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false)
          loadData(1, pagination.pageSize)
          loadStats()
        }}
      />

      <ClinicalServiceEditModal
        open={editModalOpen}
        service={selectedService}
        onCancel={() => {
          setEditModalOpen(false)
          setSelectedService(null)
        }}
        onSuccess={() => {
          setEditModalOpen(false)
          setSelectedService(null)
          loadData(pagination.current, pagination.pageSize)
          loadStats()
        }}
      />

      <ClinicalReferenceRangeDrawer
        open={rangeDrawerOpen}
        service={selectedService}
        canManage={canManage}
        onClose={() => {
          setRangeDrawerOpen(false)
          setSelectedService(null)
        }}
        onUpdated={() => {
          loadData(pagination.current, pagination.pageSize)
          loadStats()
        }}
      />
    </div>
  )
}
