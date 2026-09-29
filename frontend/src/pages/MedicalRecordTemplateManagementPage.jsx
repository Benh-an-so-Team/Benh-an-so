import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  TagOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import medicalRecordTemplateApi from '../api/medicalRecordTemplateApi'
import TemplateFormModal from '../components/medicalRecordTemplate/TemplateFormModal'
import StatusToggleModal from '../components/medicalRecordTemplate/StatusToggleModal'
import { formatTemplateName, formatSpecialtyName, formatTemplateShortId } from '../constants/medicalRecordTemplateConstants'
import { useAuthContext } from '../context/AuthContext'
import './styles/medicalRecordTemplateManagement.css'

const { Title, Text } = Typography

function MedicalRecordTemplateManagementPage() {
  const { user } = useAuthContext()
  const userPermissions = (user?.permissions || []).map((p) =>
    String(p || '').toUpperCase().replace(/^PERMISSION_/, '')
  )
  const userRoles = (user?.roles || []).map((r) =>
    String(r || '').toLowerCase().replace(/^role_/, '')
  )
  const isAdmin = userRoles.includes('admin')
  const canManage = userPermissions.includes('MEDICAL_RECORD_TEMPLATE_MANAGE') || isAdmin

  const [specialties, setSpecialties] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [specialtyLoading, setSpecialtyLoading] = useState(false)

  const [selectedSpecialty, setSelectedSpecialty] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusTargetTemplate, setStatusTargetTemplate] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  const fetchSpecialties = useCallback(async () => {
    setSpecialtyLoading(true)
    try {
      const res = await medicalRecordTemplateApi.getSpecialties()
      const list = res.data || []
      setSpecialties(list)
    } catch (err) {
      message.error('Không thể tải danh mục chuyên khoa.')
    } finally {
      setSpecialtyLoading(false)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (selectedSpecialty !== 'ALL') {
        params.specialtyId = selectedSpecialty
      }
      if (selectedStatus === 'ACTIVE') {
        params.active = true
      } else if (selectedStatus === 'INACTIVE') {
        params.active = false
      }

      const res = await medicalRecordTemplateApi.searchTemplates(params)
      setTemplates(res.data || [])
    } catch (err) {
      message.error('Không thể tải danh sách mẫu bệnh án.')
    } finally {
      setLoading(false)
    }
  }, [selectedSpecialty, selectedStatus])

  useEffect(() => {
    if (canManage) {
      fetchSpecialties()
    }
  }, [canManage, fetchSpecialties])

  useEffect(() => {
    if (canManage) {
      fetchTemplates()
    }
  }, [canManage, fetchTemplates])

  const filteredTemplates = useMemo(() => {
    let result = templates || []
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.specialty?.name?.toLowerCase().includes(q) ||
          t.specialty?.code?.toLowerCase().includes(q)
      )
    }
    return result
  }, [templates, searchQuery])

  const handleOpenCreateModal = () => {
    setEditingTemplate(null)
    setFormModalOpen(true)
  }

  const handleOpenEditModal = async (record) => {
    setLoading(true)
    try {
      const res = await medicalRecordTemplateApi.getTemplateById(record.id)
      setEditingTemplate(res.data)
      setFormModalOpen(true)
    } catch (err) {
      message.error('Không thể tải chi tiết cấu hình mẫu bệnh án.')
    } finally {
      setLoading(false)
    }
  }

  const handleFormSubmit = async (payload) => {
    setModalLoading(true)
    try {
      if (editingTemplate) {
        await medicalRecordTemplateApi.updateTemplate(editingTemplate.id, payload)
        message.success(`Đã cập nhật mẫu "${formatTemplateName(payload.name)}" và nâng lên phiên bản mới!`)
      } else {
        await medicalRecordTemplateApi.createTemplate(payload)
        message.success(`Đã tạo mẫu bệnh án "${formatTemplateName(payload.name)}" thành công!`)
      }
      setFormModalOpen(false)
      setEditingTemplate(null)
      fetchTemplates()
    } finally {
      setModalLoading(false)
    }
  }

  const handleSetDefault = async (record) => {
    try {
      await medicalRecordTemplateApi.setDefaultTemplate(record.id)
      message.success(`Đã đặt "${formatTemplateName(record.name)}" làm mẫu mặc định cho chuyên khoa ${record.specialty?.name || ''}!`)
      fetchTemplates()
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể thiết lập mẫu mặc định.'
      message.error(msg)
    }
  }

  const handleOpenStatusModal = (record) => {
    setStatusTargetTemplate(record)
    setStatusModalOpen(true)
  }

  const handleStatusSubmit = async (payload) => {
    if (!statusTargetTemplate) return
    setModalLoading(true)
    try {
      await medicalRecordTemplateApi.updateTemplateStatus(statusTargetTemplate.id, payload)
      message.success(
        payload.active
          ? `Đã kích hoạt mẫu "${statusTargetTemplate.name}"!`
          : `Đã ngừng áp dụng mẫu "${statusTargetTemplate.name}"!`
      )
      setStatusModalOpen(false)
      setStatusTargetTemplate(null)
      fetchTemplates()
    } finally {
      setModalLoading(false)
    }
  }

  const columns = [
    {
      title: 'Tên mẫu bệnh án',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="template-name-cell">
          <div className="template-name-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
              {formatTemplateName(text)}
            </span>
            {record.defaultTemplate && (
              <Tag
                color="success"
                icon={<StarFilled style={{ color: '#059669' }} />}
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 12,
                  padding: '1px 8px',
                  backgroundColor: '#ecfdf5',
                  borderColor: '#a7f3d0',
                  color: '#059669',
                }}
              >
                Mặc định
              </Tag>
            )}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Tooltip title={`ID hệ thống: ${record.id} (Nhấn để sao chép)`}>
              <Tag
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  letterSpacing: '0.3px',
                  borderRadius: 4,
                  padding: '0 6px',
                  backgroundColor: '#f1f5f9',
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(record.id)
                  message.success(`Đã sao chép ID mẫu: ${record.id}`)
                }}
              >
                <TagOutlined style={{ fontSize: 10, color: '#64748b' }} />
                {formatTemplateShortId(record.id)}
              </Tag>
            </Tooltip>
            <Tooltip title="Sao chép toàn bộ mã ID">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 12, color: '#94a3b8' }} />}
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(record.id)
                  message.success(`Đã sao chép ID mẫu: ${record.id}`)
                }}
                style={{ width: 20, height: 20, padding: 0, minWidth: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              />
            </Tooltip>
          </div>
        </div>
      ),
    },
    {
      title: 'Chuyên khoa',
      dataIndex: 'specialty',
      key: 'specialty',
      width: 180,
      render: (specialty) => (
        <Tag color="blue" style={{ fontWeight: 500, fontSize: 12 }}>
          {formatSpecialtyName(specialty?.name || specialty?.code || '—')}
        </Tag>
      ),
    },
    {
      title: 'Phiên bản',
      dataIndex: 'currentVersionNo',
      key: 'currentVersionNo',
      width: 110,
      align: 'center',
      render: (versionNo) => (
        <Tag color="purple" style={{ fontWeight: 600 }}>
          v{versionNo || 1}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      key: 'active',
      width: 140,
      align: 'center',
      render: (active) => (
        <Tag color={active ? 'success' : 'default'} style={{ fontWeight: 500 }}>
          {active ? (
            <span><CheckCircleOutlined /> Đang áp dụng</span>
          ) : (
            <span><CloseCircleOutlined /> Ngừng áp dụng</span>
          )}
        </Tag>
      ),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (val, record) => {
        const time = val || record.createdAt
        return time ? dayjs(time).format('DD/MM/YYYY HH:mm') : '—'
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'edit',
            icon: <EditOutlined style={{ color: '#2563eb' }} />,
            label: 'Chỉnh sửa mẫu',
            disabled: !canManage,
            onClick: () => handleOpenEditModal(record),
          },
          !record.defaultTemplate && record.active
            ? {
                key: 'set-default',
                icon: <StarOutlined style={{ color: '#d97706' }} />,
                label: 'Đặt làm mặc định',
                disabled: !canManage,
                onClick: () => handleSetDefault(record),
              }
            : null,
          { type: 'divider' },
          {
            key: 'toggle-status',
            icon: record.active ? <CloseCircleOutlined style={{ color: '#dc2626' }} /> : <CheckCircleOutlined style={{ color: '#16a34a' }} />,
            label: record.active ? 'Ngừng áp dụng' : 'Kích hoạt mẫu',
            danger: record.active,
            disabled: !canManage,
            onClick: () => handleOpenStatusModal(record),
          },
        ].filter(Boolean)

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined style={{ fontSize: 18, color: '#64748b' }} />}
              aria-label="Thao tác"
              title="Thao tác"
              style={{ width: 32, height: 32, borderRadius: 6 }}
            />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div className="template-management-page">
      <div
        className="template-management-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Title level={3} style={{ margin: 0, fontSize: 18, color: '#0f172a', display: 'flex', alignItems: 'center' }}>
          <FileTextOutlined style={{ color: '#2563eb', marginRight: 8 }} />
          Quản lý Mẫu bệnh án theo chuyên khoa
        </Title>
        <Space size={10}>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchSpecialties()
              fetchTemplates()
            }}
            style={{ borderRadius: 6 }}
          >
            Làm mới
          </Button>
          {canManage && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateModal}
              style={{ background: '#2563eb', borderColor: '#2563eb', borderRadius: 6, fontWeight: 500 }}
            >
              Tạo mẫu bệnh án mới
            </Button>
          )}
        </Space>
      </div>

      <Card
        className="template-filter-card"
        style={{ marginBottom: 20, borderRadius: 10 }}
        styles={{ body: { padding: '18px 20px' } }}
        bodyStyle={{ padding: '18px 20px' }}
      >
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Lọc theo chuyên khoa:
            </div>
            <Select
              style={{ width: '100%' }}
              value={selectedSpecialty}
              onChange={setSelectedSpecialty}
              loading={specialtyLoading}
              options={[
                { value: 'ALL', label: 'Tất cả chuyên khoa' },
                ...specialties.map((s) => ({
                  value: s.id,
                  label: formatSpecialtyName(s.name),
                })),
              ]}
            />
          </Col>

          <Col xs={24} sm={8} md={6}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Trạng thái áp dụng:
            </div>
            <Select
              style={{ width: '100%' }}
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Đang áp dụng' },
                { value: 'INACTIVE', label: 'Ngừng áp dụng' },
              ]}
            />
          </Col>

          <Col xs={24} sm={8} md={8}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Tìm kiếm tên mẫu:
            </div>
            <Input
              placeholder="Nhập tên mẫu bệnh án..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} md={4} style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 20 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Tổng số: <b style={{ color: '#0f172a' }}>{filteredTemplates.length}</b> mẫu
            </Text>
          </Col>
        </Row>
      </Card>

      <Card className="template-table-card" styles={{ body: { padding: 0 } }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredTemplates}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `Tổng cộng ${total} mẫu bệnh án`,
          }}
          locale={{
            emptyText: (
              <Empty
                description="Không tìm thấy mẫu bệnh án nào phù hợp với bộ lọc."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                {canManage && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleOpenCreateModal}
                  >
                    Tạo mẫu bệnh án mới
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </Card>

      <TemplateFormModal
        open={formModalOpen}
        onClose={() => {
          setFormModalOpen(false)
          setEditingTemplate(null)
        }}
        onSubmit={handleFormSubmit}
        initialData={editingTemplate}
        specialties={specialties}
        loading={modalLoading}
      />

      <StatusToggleModal
        open={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false)
          setStatusTargetTemplate(null)
        }}
        template={statusTargetTemplate}
        otherTemplatesInSpecialty={templates.filter(
          (t) => t.specialty?.id === statusTargetTemplate?.specialty?.id
        )}
        onSubmit={handleStatusSubmit}
        loading={modalLoading}
      />
    </div>
  )
}

export default MedicalRecordTemplateManagementPage
