import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TagOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Form,
  Input,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import systemApi from '../api/systemApi'
import { useAuthContext } from '../context/AuthContext'
import { showNotice } from '../components/common/notice/index.js'
import {
  categorizePriceHistory,
  extractServiceFormErrors,
  fixMojibake,
  focusFirstErrorField,
  formatDateDisplay,
  formatServiceCurrency,
  isDuplicateServiceName,
  isEffectiveDateConflicted,
  prepareCreateServicePayload,
  prepareUpdateServicePayload,
  translateServiceErrorMessage,
} from '../utils/serviceCatalogValidation'
import ServiceCreateModal from '../components/services/ServiceCreateModal'
import ServiceEditModal from '../components/services/ServiceEditModal'
import ServicePriceHistoryDrawer from '../components/services/ServicePriceHistoryDrawer'
import '../styles/services.css'

dayjs.extend(customParseFormat)

const { Text, Title } = Typography
const { Option } = Select

function ServicesPage() {
  const { user } = useAuthContext()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('DEFAULT')

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [savingService, setSavingService] = useState(false)
  const [createFormError, setCreateFormError] = useState(null)
  const [createFormErrorDescription, setCreateFormErrorDescription] = useState(null)
  const [editFormError, setEditFormError] = useState(null)
  const [editFormErrorDescription, setEditFormErrorDescription] = useState(null)
  const [editPriceHistory, setEditPriceHistory] = useState([])

  // Price History Drawer States
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
  const [historyService, setHistoryService] = useState(null)
  const [priceHistory, setPriceHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Status Toggling State
  const [togglingId, setTogglingId] = useState(null)

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  // User permission check
  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) =>
      String(r || '')
        .toLowerCase()
        .replace(/^role_/, ''),
    )
  }, [user])

  const _canReadService = userPermissions.includes('SERVICE_CATALOG_READ') || userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('clinic_manager')
  const canCreateService = userPermissions.includes('SERVICE_CATALOG_CREATE') || userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('clinic_manager')
  const canUpdateService = userPermissions.includes('SERVICE_CATALOG_UPDATE') || userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('clinic_manager')
  const canManagePrice = userPermissions.includes('SERVICE_PRICE_MANAGE') || userRoles.includes('admin') || userRoles.includes('manager') || userRoles.includes('clinic_manager')
  const canManage = canCreateService || canUpdateService || canManagePrice

  // Fetch Services from backend
  const loadServices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await systemApi.services({ size: 200 })
      const data = res?.data
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
          ? data.content
          : []
      const list = rawList.map((s) => ({
        ...s,
        name: fixMojibake(s.name),
      }))
      setServices(list)
    } catch (err) {
      console.error('[ServicesPage] Lỗi tải danh mục dịch vụ:', err)
      const status = err?.response?.status
      if (status === 403) {
        message.error('Bạn không có quyền truy cập danh mục dịch vụ.')
      } else {
        message.error(translateServiceErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  // Statistics calculation
  const stats = useMemo(() => {
    const total = services.length
    const active = services.filter((s) => s.active !== false).length
    const inactive = total - active
    const priced = services.filter(
      (s) => s.price !== null && s.price !== undefined && s.price > 0,
    ).length
    return { total, active, inactive, priced }
  }, [services])

  // Filter and sort services
  const filteredServices = useMemo(() => {
    let result = [...services]

    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase()
      result = result.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(query)) ||
          (s.serviceCode && s.serviceCode.toLowerCase().includes(query)),
      )
    }

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE') {
        result = result.filter((s) => s.active !== false)
      } else if (statusFilter === 'INACTIVE') {
        result = result.filter((s) => s.active === false)
      }
    }

    if (sortBy === 'PRICE_ASC') {
      result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
    } else if (sortBy === 'PRICE_DESC') {
      result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
    } else if (sortBy === 'NAME_ASC') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
    }

    return result
  }, [services, searchTerm, statusFilter, sortBy])

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setCreateFormError(null)
    setCreateFormErrorDescription(null)
    createForm.resetFields()
    createForm.setFieldsValue({
      effectiveFrom: dayjs(),
    })
    setCreateModalOpen(true)
  }

  // Handle submit create service
  const handleCreateService = async (values) => {
    setSavingService(true)
    setCreateFormError(null)
    setCreateFormErrorDescription(null)

    // 1. Kiểm tra trùng tên dịch vụ phía hệ thống tại thời điểm bấm "Lưu"
    if (isDuplicateServiceName(values?.name, services)) {
      const duplicateMsg = 'Tên dịch vụ này đã tồn tại, vui lòng chọn tên khác.'
      createForm.setFields([
        {
          name: 'name',
          errors: [duplicateMsg],
        },
      ])
      if (createForm.scrollToField) {
        createForm.scrollToField('name', { behavior: 'smooth', block: 'center' })
      }
      setTimeout(() => {
        focusFirstErrorField('name')
      }, 100)
      showNotice.validationSummary({ errorCount: 1 })
      setSavingService(false)
      return
    }

    try {
      const payload = prepareCreateServicePayload(values)
      await systemApi.createService(payload)
      showNotice.success('Thành công', `Đã thêm mới dịch vụ "${values.name}" thành công!`)
      setCreateModalOpen(false)
      setCreateFormError(null)
      setCreateFormErrorDescription(null)
      createForm.resetFields()
      loadServices()
    } catch (err) {
      console.error('[ServicesPage] Lỗi tạo dịch vụ:', err)
      const { errorMessage, description, fieldErrors } = extractServiceFormErrors(err)
      setCreateFormError(errorMessage)
      setCreateFormErrorDescription(description)
      if (fieldErrors && fieldErrors.length > 0) {
        const formattedFieldErrors = fieldErrors.map((fe) => {
          if (fe.name === 'name' && (fe.errors[0]?.includes('tồn tại') || fe.errors[0]?.toLowerCase().includes('exists'))) {
            return { ...fe, errors: ['Tên dịch vụ này đã tồn tại, vui lòng chọn tên khác'] }
          }
          if (fe.name === 'price' && (fe.errors[0]?.toLowerCase().includes('lớn hơn hoặc bằng 0') || fe.errors[0]?.toLowerCase().includes('số âm'))) {
            return { ...fe, errors: ['Giá dịch vụ không được là số âm'] }
          }
          return fe
        })
        createForm.setFields(formattedFieldErrors)
        const firstError = formattedFieldErrors[0]
        if (createForm.scrollToField && firstError?.name) {
          createForm.scrollToField(firstError.name, { behavior: 'smooth', block: 'center' })
        }
        setTimeout(() => {
          focusFirstErrorField(firstError.name)
        }, 100)
        showNotice.validationSummary({ errorCount: formattedFieldErrors.length })
      } else {
        showNotice.apiError(err, 'Lưu dịch vụ thất bại', errorMessage)
      }
    } finally {
      setSavingService(false)
    }
  }

  // Handle open edit modal
  const handleOpenEditModal = (service) => {
    setEditFormError(null)
    setEditFormErrorDescription(null)
    setEditingService(service)
    setEditPriceHistory([])
    editForm.resetFields()
    editForm.setFieldsValue({
      serviceCode: service.serviceCode,
      name: service.name,
      price: service.price !== null && service.price !== undefined ? service.price : null,
      effectiveFrom: service.effectiveFrom ? dayjs(service.effectiveFrom) : dayjs(),
      active: service.active !== false,
    })
    setEditModalOpen(true)

    const serviceId = service?.id || service?.serviceCatalogId
    if (serviceId) {
      systemApi
        .getServicePriceHistory(serviceId)
        .then((res) => {
          setEditPriceHistory(res?.data || [])
        })
        .catch((err) => {
          console.warn('[ServicesPage] Không thể nạp lịch sử giá dịch vụ:', err)
        })
    }
  }

  // Handle submit update service
  const handleUpdateService = async (values) => {
    const serviceId = editingService?.id || editingService?.serviceCatalogId
    if (!serviceId) {
      const notFoundMsg = 'Không tìm thấy thông tin dịch vụ trong hệ thống.'
      showNotice.error('Lỗi dữ liệu', notFoundMsg)
      return
    }

    setSavingService(true)
    setEditFormError(null)
    setEditFormErrorDescription(null)

    // 1. Kiểm tra trùng tên dịch vụ phía hệ thống tại thời điểm bấm "Lưu" (loại trừ dịch vụ đang sửa)
    if (isDuplicateServiceName(values?.name, services, serviceId)) {
      const duplicateMsg = 'Tên dịch vụ này đã tồn tại, vui lòng chọn tên khác.'
      editForm.setFields([
        {
          name: 'name',
          errors: [duplicateMsg],
        },
      ])
      if (editForm.scrollToField) {
        editForm.scrollToField('name', { behavior: 'smooth', block: 'center' })
      }
      setTimeout(() => {
        focusFirstErrorField('name')
      }, 100)
      showNotice.validationSummary({ errorCount: 1 })
      setSavingService(false)
      return
    }

    const conflict = isEffectiveDateConflicted(
      values.effectiveFrom,
      editPriceHistory,
      values.price,
      editingService.price,
    )
    if (conflict.conflicted) {
      setEditFormError(conflict.message)
      setEditFormErrorDescription('Vui lòng chọn ngày bắt đầu áp dụng khác hoặc nhấn nút Gợi ý ngày hợp lệ bên dưới.')
      editForm.setFields([
        {
          name: 'effectiveFrom',
          errors: [conflict.message],
        },
      ])
      if (editForm.scrollToField) {
        editForm.scrollToField('effectiveFrom', { behavior: 'smooth', block: 'center' })
      }
      setTimeout(() => {
        focusFirstErrorField('effectiveFrom')
      }, 100)
      showNotice.validationSummary({ errorCount: 1 })
      setSavingService(false)
      return
    }

    try {
      const payload = prepareUpdateServicePayload(values, editingService)
      await systemApi.updateService(serviceId, payload)
      showNotice.success('Thành công', `Đã cập nhật dịch vụ "${values.name}" thành công!`)
      setEditModalOpen(false)
      setEditFormError(null)
      setEditFormErrorDescription(null)
      setEditingService(null)
      setEditPriceHistory([])
      editForm.resetFields()
      loadServices()
    } catch (err) {
      console.error('[ServicesPage] Lỗi cập nhật dịch vụ:', err)
      const { errorMessage, description, fieldErrors } = extractServiceFormErrors(err)
      setEditFormError(errorMessage)
      setEditFormErrorDescription(description)
      if (fieldErrors && fieldErrors.length > 0) {
        const formattedFieldErrors = fieldErrors.map((fe) => {
          if (fe.name === 'name' && (fe.errors[0]?.includes('tồn tại') || fe.errors[0]?.toLowerCase().includes('exists'))) {
            return { ...fe, errors: ['Tên dịch vụ này đã tồn tại, vui lòng chọn tên khác'] }
          }
          if (fe.name === 'price' && (fe.errors[0]?.toLowerCase().includes('lớn hơn hoặc bằng 0') || fe.errors[0]?.toLowerCase().includes('số âm'))) {
            return { ...fe, errors: ['Giá dịch vụ không được là số âm'] }
          }
          return fe
        })
        editForm.setFields(formattedFieldErrors)
        const firstError = formattedFieldErrors[0]
        if (editForm.scrollToField && firstError?.name) {
          editForm.scrollToField(firstError.name, { behavior: 'smooth', block: 'center' })
        }
        setTimeout(() => {
          focusFirstErrorField(firstError.name)
        }, 100)
        showNotice.validationSummary({ errorCount: formattedFieldErrors.length })
      } else {
        showNotice.apiError(err, 'Cập nhật dịch vụ thất bại', errorMessage)
      }
    } finally {
      setSavingService(false)
    }
  }

  // Handle toggle service active status
  const handleToggleStatus = async (service, checked) => {
    const serviceId = service?.id || service?.serviceCatalogId
    if (!serviceId) return
    setTogglingId(serviceId)
    try {
      try {
        await systemApi.updateServiceStatus(serviceId, checked)
      } catch (patchErr) {
        // Fallback to updateService if PATCH status is not supported
        const payload = {
          name: service.name,
          price: service.price,
          effectiveFrom: service.effectiveFrom
            ? dayjs(service.effectiveFrom).format('YYYY-MM-DD')
            : dayjs().format('YYYY-MM-DD'),
          active: checked,
        }
        await systemApi.updateService(serviceId, payload)
      }
      message.success(`Đã ${checked ? 'kích hoạt' : 'tạm dừng'} dịch vụ "${service.name}".`)
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, active: checked } : s)),
      )
    } catch (err) {
      console.error('[ServicesPage] Lỗi đổi trạng thái dịch vụ:', err)
      message.error(translateServiceErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  // Handle open price history drawer
  const handleOpenPriceHistory = async (service) => {
    setHistoryService(service)
    setHistoryDrawerOpen(true)
    setLoadingHistory(true)
    try {
      const res = await systemApi.getServicePriceHistory(service.id)
      const data = res?.data
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
          ? data.content
          : []
      const categorized = categorizePriceHistory(rawList)
      setPriceHistory(categorized)
    } catch (err) {
      console.error('[ServicesPage] Lỗi tải lịch sử giá:', err)
      const categorized = categorizePriceHistory([
        {
          price: service.price,
          effectiveFrom: service.effectiveFrom,
          createdAt: service.createdAt,
        },
      ])
      setPriceHistory(categorized)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Table Columns Definition
  const columns = [
    {
      title: 'Mã DV',
      dataIndex: 'serviceCode',
      key: 'serviceCode',
      width: 130,
      render: (code) => <span className="service-code-badge">{code || '—'}</span>,
    },
    {
      title: 'Tên dịch vụ kỹ thuật / Gói khám',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="service-name-container">
          <span className="service-name-icon">
            <AppstoreOutlined />
          </span>
          <div>
            <div className="service-name-text">{name || 'Chưa đặt tên'}</div>
            <div className="service-name-sub">
              {record.department ? `Khoa: ${record.department}` : 'Dịch vụ khám chữa bệnh tiêu chuẩn'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Đơn giá niêm yết',
      dataIndex: 'price',
      key: 'price',
      width: 170,
      align: 'right',
      render: (price) => {
        const isSet = price !== null && price !== undefined && Number(price) > 0
        return (
          <div className="service-price-wrapper">
            <span className={`service-price-cell ${isSet ? 'has-price' : 'no-price'}`}>
              {formatServiceCurrency(price)}
            </span>
          </div>
        )
      },
    },
    {
      title: 'Hiệu lực từ',
      dataIndex: 'effectiveFrom',
      key: 'effectiveFrom',
      width: 140,
      render: (date) => (
        <span className="service-date-cell">
          {formatDateDisplay(date)}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      key: 'active',
      width: 130,
      render: (active, record) => {
        const isActive = active !== false
        if (!canManage) {
          return (
            <Tag color={isActive ? 'success' : 'default'}>
              {isActive ? 'Đang hiệu lực' : 'Ngừng áp dụng'}
            </Tag>
          )
        }
        return (
          <Popconfirm
            title={isActive ? 'Tạm dừng áp dụng dịch vụ này?' : 'Kích hoạt lại dịch vụ này?'}
            description={
              isActive
                ? 'Dịch vụ sẽ tạm thời không thể chỉ định trong đơn khám mới.'
                : 'Dịch vụ sẽ sẵn sàng để chỉ định trong lượt khám bệnh.'
            }
            onConfirm={() => handleToggleStatus(record, !isActive)}
            okText="Đồng ý"
            cancelText="Hủy"
            disabled={togglingId === record.id}
          >
            <Switch
              size="small"
              checked={isActive}
              loading={togglingId === record.id}
              checkedChildren="Bật"
              unCheckedChildren="Tắt"
            />
          </Popconfirm>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <Space size="small" className="service-table-actions">
          <Tooltip title="Xem lịch sử điều chỉnh giá">
            <Button
              className="btn-table-action btn-table-history"
              type="default"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleOpenPriceHistory(record)}
            >
              Lịch sử giá
            </Button>
          </Tooltip>
          {canManage && (
            <Tooltip title="Cập nhật thông tin & giá">
              <Button
                className="btn-table-action btn-table-edit"
                type="default"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEditModal(record)}
              >
                Sửa
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="services-page-container">
      {/* Page Header */}
      <div className="services-page-header">
        <div className="services-header-content">
          <div className="services-header-badge">
            <AppstoreOutlined />
            <span>Danh mục Y tế & Viện phí</span>
          </div>
          <Title level={3} className="services-header-title">
            Danh mục Dịch vụ Kỹ thuật & Bảng giá
          </Title>
        </div>
        <div className="services-header-actions">
          <Button
            className="btn-services-refresh"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={loadServices}
          >
            Làm mới
          </Button>
          {canManage && (
            <Button
              className="btn-services-create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateModal}
            >
              Thêm dịch vụ mới
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="services-stats-grid">
        <div className="service-stat-card">
          <div className="service-stat-info">
            <div className="service-stat-label">Tổng số dịch vụ</div>
            <div className="service-stat-value">{stats.total}</div>
            <div className="service-stat-hint">Toàn bộ danh mục</div>
          </div>
          <div className="service-stat-icon is-blue">
            <AppstoreOutlined />
          </div>
        </div>

        <div className="service-stat-card">
          <div className="service-stat-info">
            <div className="service-stat-label">Đang áp dụng</div>
            <div className="service-stat-value is-active">{stats.active}</div>
            <div className="service-stat-hint is-active">Sẵn sàng chỉ định</div>
          </div>
          <div className="service-stat-icon is-green">
            <CheckCircleOutlined />
          </div>
        </div>

        <div className="service-stat-card">
          <div className="service-stat-info">
            <div className="service-stat-label">Đã cấu hình giá</div>
            <div className="service-stat-value is-priced">{stats.priced}</div>
            <div className="service-stat-hint">Có mức giá niêm yết</div>
          </div>
          <div className="service-stat-icon is-cyan">
            <DollarOutlined />
          </div>
        </div>

        <div className="service-stat-card">
          <div className="service-stat-info">
            <div className="service-stat-label">Tạm ngừng</div>
            <div className="service-stat-value is-inactive">{stats.inactive}</div>
            <div className="service-stat-hint is-inactive">Chưa kích hoạt</div>
          </div>
          <div className="service-stat-icon is-red">
            <StopOutlined />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="services-toolbar">
        <div className="services-search-box">
          <Input
            prefix={<SearchOutlined className="services-search-icon" />}
            placeholder="Tìm theo tên dịch vụ hoặc mã dịch vụ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            size="large"
          />
        </div>

        <div className="services-filter-group">
          <Radio.Group
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            buttonStyle="solid"
            size="middle"
            className="services-filter-radio"
          >
            <Radio.Button value="ALL">Tất cả ({services.length})</Radio.Button>
            <Radio.Button value="ACTIVE">Đang áp dụng ({stats.active})</Radio.Button>
            <Radio.Button value="INACTIVE">Tạm dừng ({stats.inactive})</Radio.Button>
          </Radio.Group>

          <Select
            value={sortBy}
            onChange={setSortBy}
            className="services-sort-select"
            size="middle"
            placeholder="Sắp xếp"
          >
            <Option value="DEFAULT">Sắp xếp mặc định</Option>
            <Option value="PRICE_ASC">Giá tăng dần</Option>
            <Option value="PRICE_DESC">Giá giảm dần</Option>
            <Option value="NAME_ASC">Tên A-Z</Option>
          </Select>
        </div>
      </div>

      {/* Services Table */}
      <div className="services-table-wrapper">
        <Table
          columns={columns}
          dataSource={filteredServices}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) =>
              `Hiển thị ${range[0]} - ${range[1]} trên tổng số ${total} dịch vụ`,
          }}
          locale={{
            emptyText: (
              <div className="service-empty-state">
                <AppstoreOutlined style={{ fontSize: 36, color: '#cbd5e1' }} />
                <div style={{ marginTop: 8, color: '#64748b', fontWeight: 500 }}>
                  Không tìm thấy dịch vụ kỹ thuật nào phù hợp
                </div>
              </div>
            ),
          }}
        />
      </div>

      {/* Modal: Thêm dịch vụ mới */}
      <ServiceCreateModal
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          setCreateFormError(null)
          setCreateFormErrorDescription(null)
        }}
        onFinish={handleCreateService}
        form={createForm}
        loading={savingService}
        formError={createFormError}
        formErrorDescription={createFormErrorDescription}
        onClearError={() => {
          setCreateFormError(null)
          setCreateFormErrorDescription(null)
        }}
        canSubmit={canCreateService}
      />

      {/* Modal: Sửa thông tin & Điều chỉnh bảng giá */}
      <ServiceEditModal
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditFormError(null)
          setEditFormErrorDescription(null)
          setEditingService(null)
          setEditPriceHistory([])
        }}
        onFinish={handleUpdateService}
        form={editForm}
        loading={savingService}
        formError={editFormError}
        formErrorDescription={editFormErrorDescription}
        onClearError={() => {
          setEditFormError(null)
          setEditFormErrorDescription(null)
        }}
        editingService={editingService}
        priceHistory={editPriceHistory}
        canSubmit={canUpdateService}
      />

      {/* Drawer: Lịch sử giá dịch vụ */}
      <ServicePriceHistoryDrawer
        open={historyDrawerOpen}
        onClose={() => {
          setHistoryDrawerOpen(false)
          setHistoryService(null)
          setPriceHistory([])
        }}
        service={historyService}
        priceHistory={priceHistory}
        loading={loadingHistory}
      />
    </div>
  )
}

export default ServicesPage
