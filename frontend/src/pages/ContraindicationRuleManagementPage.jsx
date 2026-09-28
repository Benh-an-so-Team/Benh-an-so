import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  UploadOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import contraindicationRuleManagementApi from '../api/contraindicationRuleManagementApi'
import diagnosisCatalogApi from '../api/diagnosisCatalogApi'
import DiagnosisCatalogAutocomplete from '../components/diagnosis-catalog/DiagnosisCatalogAutocomplete'
import { useAuthContext } from '../context/AuthContext'
import {
  CONTRAINDICATION_SEVERITY_META,
  CONTRAINDICATION_TYPE_META,
  DIAGNOSIS_CATALOG_FALLBACK,
  getDiagnosisInfo,
} from '../utils/contraindicationValidation'

const { Title, Text, Paragraph } = Typography

export default function ContraindicationRuleManagementPage() {
  const { user } = useAuthContext()
  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) =>
      String(p || '').toUpperCase().replace(/^PERMISSION_/, ''),
    )
  }, [user])
  const canManage =
    userPermissions.includes('CONTRAINDICATION_RULE_MANAGE') ||
    user?.role === 'admin' ||
    user?.roles?.includes('admin')

  // State danh sách và lọc
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [searchIngredient, setSearchIngredient] = useState('')
  const [searchType, setSearchType] = useState(undefined)
  const [searchSeverity, setSearchSeverity] = useState(undefined)
  const [searchActive, setSearchActive] = useState(undefined)

  // State bộ map mã bệnh (ICD-10) để hiển thị chuẩn mã và tên bệnh
  const [diagnosisMap, setDiagnosisMap] = useState(DIAGNOSIS_CATALOG_FALLBACK)

  // State modal thêm / sửa
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // State modal import file
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [fileList, setFileList] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        activeIngredient: searchIngredient.trim() || undefined,
        contraindicationType: searchType || undefined,
        severity: searchSeverity || undefined,
        active: searchActive,
        page: page - 1,
        size: pageSize,
      }
      const response = await contraindicationRuleManagementApi.searchRules(params)
      const data = response?.data || {}
      setRules(data.content || [])
      setTotal(data.totalElements || 0)
    } catch (err) {
      console.error('Lỗi tải danh mục quy tắc chống chỉ định:', err)
      message.error('Không thể tải danh mục quy tắc chống chỉ định từ máy chủ.')
    } finally {
      setLoading(false)
    }
  }, [searchIngredient, searchType, searchSeverity, searchActive, page, pageSize])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  // Tự động nạp thông tin mã bệnh nếu có quy tắc bệnh nền chứa mã mới
  useEffect(() => {
    const missingIds = rules
      .filter(
        (r) =>
          r.type === 'DISEASE' &&
          r.diagnosisCatalogId &&
          !diagnosisMap[r.diagnosisCatalogId]
      )
      .map((r) => r.diagnosisCatalogId)

    if (missingIds.length === 0) return

    let isMounted = true
    const fetchDiagnoses = async () => {
      const updates = {}
      await Promise.all(
        missingIds.map(async (id) => {
          try {
            const res = await diagnosisCatalogApi.getById(id)
            const item = res?.data || res
            if (item && (item.code || item.name)) {
              updates[id] = {
                code: item.code,
                name: item.name || item.diseaseName,
              }
            }
          } catch {
            if (DIAGNOSIS_CATALOG_FALLBACK[id]) {
              updates[id] = DIAGNOSIS_CATALOG_FALLBACK[id]
            }
          }
        })
      )
      if (isMounted && Object.keys(updates).length > 0) {
        setDiagnosisMap((prev) => ({ ...prev, ...updates }))
      }
    }
    fetchDiagnoses()
    return () => {
      isMounted = false
    }
  }, [rules, diagnosisMap])

  const handleIngredientChange = (e) => {
    setSearchIngredient(e.target.value)
    setPage(1)
  }

  const handleTypeChange = (val) => {
    setSearchType(val)
    setPage(1)
  }

  const handleSeverityChange = (val) => {
    setSearchSeverity(val)
    setPage(1)
  }

  const handleActiveChange = (val) => {
    setSearchActive(val)
    setPage(1)
  }

  const handleOpenCreateModal = () => {
    setEditingRule(null)
    setSelectedDiagnosis(null)
    form.resetFields()
    form.setFieldsValue({
      type: 'PREGNANCY',
      severity: 'CONTRAINDICATED',
      active: true,
    })
    setModalOpen(true)
  }

  const handleOpenEditModal = (record) => {
    setEditingRule(record)
    if (record.diagnosisCatalogId) {
      const diagInfo = getDiagnosisInfo(record, diagnosisMap)
      setSelectedDiagnosis({
        id: record.diagnosisCatalogId,
        diseaseName: diagInfo.name || 'Bệnh nền ICD',
        code: diagInfo.code || 'ICD-10',
      })
    } else {
      setSelectedDiagnosis(null)
    }
    form.resetFields()
    form.setFieldsValue({
      activeIngredient: record.activeIngredient,
      type: record.type,
      minAgeYears: record.minAgeYears,
      maxAgeYears: record.maxAgeYears,
      diagnosisCatalogId: record.diagnosisCatalogId,
      severity: record.severity,
      message: record.message,
      recommendation: record.recommendation,
      active: record.active,
    })
    setModalOpen(true)
  }

  const handleSubmitForm = async (values) => {
    // Validate nghiệp vụ trước khi submit (tránh lỗi 400 Bad Request từ Backend)
    const activeIngredient = (values.activeIngredient || '').trim()
    if (!activeIngredient) {
      message.error('Vui lòng nhập tên hoạt chất thuốc.')
      return
    }

    const payload = {
      ...values,
      activeIngredient,
      message: (values.message || '').trim(),
      recommendation: (values.recommendation || '').trim() || null,
    }

    if (payload.type === 'AGE') {
      payload.diagnosisCatalogId = null
      if (payload.minAgeYears == null && payload.maxAgeYears == null) {
        message.error('Quy tắc theo độ tuổi yêu cầu ít nhất một giới hạn tuổi (tối thiểu hoặc tối đa).')
        return
      }
      if (
        payload.minAgeYears != null &&
        payload.maxAgeYears != null &&
        payload.minAgeYears > payload.maxAgeYears
      ) {
        message.error('Độ tuổi tối thiểu không được lớn hơn độ tuổi tối đa.')
        return
      }
    } else if (payload.type === 'PREGNANCY' || payload.type === 'BREASTFEEDING') {
      payload.minAgeYears = null
      payload.maxAgeYears = null
      payload.diagnosisCatalogId = null
    } else if (payload.type === 'DISEASE') {
      payload.minAgeYears = null
      payload.maxAgeYears = null
      if (!payload.diagnosisCatalogId) {
        message.error('Quy tắc chống chỉ định bệnh nền bắt buộc phải chọn mã bệnh ICD-10.')
        return
      }
    }

    setSubmitting(true)
    try {
      if (editingRule) {
        await contraindicationRuleManagementApi.updateRule(editingRule.id, payload)
        message.success('Cập nhật quy tắc chống chỉ định thành công.')
      } else {
        await contraindicationRuleManagementApi.createRule(payload)
        message.success('Thêm mới quy tắc chống chỉ định thành công.')
      }
      setModalOpen(false)
      loadRules()
    } catch (err) {
      console.error('Lỗi lưu quy tắc chống chỉ định:', err)
      message.error(err?.response?.data?.message || 'Lỗi lưu quy tắc. Vui lòng kiểm tra lại thông tin.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (record) => {
    try {
      if (record.active) {
        await contraindicationRuleManagementApi.deactivateRule(record.id)
        message.success(`Đã tạm dừng quy tắc cho hoạt chất "${record.activeIngredient}".`)
      } else {
        await contraindicationRuleManagementApi.activateRule(record.id)
        message.success(`Đã kích hoạt lại quy tắc cho hoạt chất "${record.activeIngredient}".`)
      }
      loadRules()
    } catch (err) {
      console.error('Lỗi đổi trạng thái quy tắc:', err)
      message.error('Không thể thay đổi trạng thái quy tắc.')
    }
  }

  const handleImportFile = async () => {
    if (fileList.length === 0) {
      message.warning('Vui lòng chọn file CSV hoặc Excel cần tải lên.')
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const response = await contraindicationRuleManagementApi.importRules(fileList[0])
      const data = response?.data || {}
      setImportResult(data)
      message.success(data.message || 'Tiếp nhận file thành công.')
      setFileList([])
      loadRules()
    } catch (err) {
      console.error('Lỗi nhập file:', err)
      message.error(err?.response?.data?.message || 'Nhập file thất bại. Vui lòng thử lại.')
    } finally {
      setImporting(false)
    }
  }

  const columns = [
    {
      title: 'Hoạt chất / Thuốc',
      key: 'target',
      width: 220,
      render: (_, record) => (
        <div>
          <Text strong style={{ color: '#1e293b', fontSize: 14 }}>
            {record.activeIngredient || record.medicineName || 'Toàn danh mục'}
          </Text>
          {record.medicineName && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Biệt dược: {record.medicineName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Loại chống chỉ định',
      dataIndex: 'type',
      key: 'type',
      width: 170,
      render: (type) => {
        const meta = CONTRAINDICATION_TYPE_META[type] || { label: type, tagColor: 'default' }
        return <Tag color={meta.tagColor} style={{ fontWeight: 600 }}>{meta.label}</Tag>
      },
    },
    {
      title: 'Điều kiện lâm sàng',
      key: 'condition',
      width: 200,
      render: (_, record) => {
        if (record.type === 'AGE') {
          if (record.minAgeYears != null && record.maxAgeYears != null) {
            return `Từ ${record.minAgeYears} đến ${record.maxAgeYears} tuổi`
          }
          if (record.minAgeYears != null) return `Dưới ${record.minAgeYears} tuổi`
          if (record.maxAgeYears != null) return `Trên ${record.maxAgeYears} tuổi`
        }
        if (record.type === 'PREGNANCY') {
          return <Tag color="pink">Phụ nữ có thai</Tag>
        }
        if (record.type === 'BREASTFEEDING') {
          return <Tag color="purple">Phụ nữ cho con bú</Tag>
        }
        if (record.type === 'DISEASE') {
          const diagInfo = getDiagnosisInfo(record, diagnosisMap)
          if (diagInfo.code && diagInfo.name) {
            return (
              <Tag color="cyan" style={{ fontSize: 13, padding: '2px 8px' }}>
                <strong style={{ color: '#0369a1' }}>{diagInfo.code}</strong> - {diagInfo.name}
              </Tag>
            )
          }
          if (diagInfo.displayText && diagInfo.displayText !== '—') {
            return (
              <Tag color="cyan" style={{ fontSize: 13, padding: '2px 8px' }}>
                {diagInfo.displayText}
              </Tag>
            )
          }
          return <Tag color="cyan">Bệnh nền mạn tính</Tag>
        }
        return '—'
      },
    },
    {
      title: 'Mức độ',
      dataIndex: 'severity',
      key: 'severity',
      width: 170,
      render: (sev) => {
        const meta = CONTRAINDICATION_SEVERITY_META[sev] || { label: sev, tagColor: 'red' }
        return <Tag color={meta.tagColor} style={{ fontWeight: 700 }}>{meta.label}</Tag>
      },
    },
    {
      title: 'Thông điệp cảnh báo & Khuyến cáo',
      key: 'message',
      render: (_, record) => (
        <div>
          <div style={{ color: '#0f172a', fontWeight: 500 }}>{record.message}</div>
          {record.recommendation && (
            <div style={{ fontSize: 12, color: '#0369a1', marginTop: 4 }}>
              <strong>Khuyến cáo:</strong> {record.recommendation}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      key: 'active',
      width: 140,
      render: (active, record) => (
        <Popconfirm
          title={active ? 'Xác nhận vô hiệu hóa quy tắc?' : 'Xác nhận kích hoạt lại quy tắc?'}
          description={
            active
              ? `Tạm dừng quy tắc này sẽ không còn cảnh báo cho hoạt chất "${record.activeIngredient}".`
              : `Kích hoạt lại quy tắc cảnh báo cho hoạt chất "${record.activeIngredient}".`
          }
          onConfirm={() => handleToggleActive(record)}
          okText="Đồng ý"
          cancelText="Hủy"
          disabled={!canManage}
        >
          <Switch
            checked={active}
            checkedChildren="Áp dụng"
            unCheckedChildren="Tạm dừng"
            disabled={!canManage}
          />
        </Popconfirm>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa quy tắc">
            <Button
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: '#fef3c7',
                borderColor: '#fde68a',
                color: '#d97706',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              icon={<EditOutlined style={{ fontSize: 16 }} />}
              onClick={() => handleOpenEditModal(record)}
              disabled={!canManage}
            />
          </Tooltip>
          <Popconfirm
            title={record.active ? 'Vô hiệu hóa quy tắc?' : 'Kích hoạt lại quy tắc?'}
            description={
              record.active
                ? `Tạm dừng quy tắc này sẽ không còn cảnh báo cho hoạt chất "${record.activeIngredient}".`
                : `Kích hoạt lại quy tắc cảnh báo cho hoạt chất "${record.activeIngredient}".`
            }
            onConfirm={() => handleToggleActive(record)}
            okText="Đồng ý"
            cancelText="Hủy"
            disabled={!canManage}
          >
            <Tooltip title={record.active ? 'Tạm dừng quy tắc' : 'Kích hoạt lại'}>
              <Button
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: record.active ? '#fee2e2' : '#dcfce7',
                  borderColor: record.active ? '#fecaca' : '#bbf7d0',
                  color: record.active ? '#dc2626' : '#16a34a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                icon={
                  record.active ? (
                    <StopOutlined style={{ fontSize: 16 }} />
                  ) : (
                    <CheckCircleOutlined style={{ fontSize: 16 }} />
                  )
                }
                disabled={!canManage}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const selectedTypeWatch = Form.useWatch('type', form)

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <Card style={{ marginBottom: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col flex="auto">
            <Title level={3} style={{ margin: 0, color: '#0f172a', whiteSpace: 'nowrap' }}>
              <MedicineBoxOutlined style={{ color: '#0284c7', marginRight: 10 }} />
              Quản lý danh mục quy tắc chống chỉ định
            </Title>
          </Col>
          <Col style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Space wrap={false} size="middle" style={{ flexWrap: 'nowrap' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadRules}
                loading={loading}
              >
                Làm mới
              </Button>
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => {
                  setImportResult(null)
                  setImportModalOpen(true)
                }}
                disabled={!canManage}
              >
                Nhập file Excel/CSV
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateModal}
                disabled={!canManage}
                style={{ background: '#0284c7' }}
              >
                Thêm quy tắc mới
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Filter bar */}
      <Card style={{ marginBottom: 20, borderRadius: 8 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo hoạt chất (VD: Ibuprofen)"
              value={searchIngredient}
              onChange={handleIngredientChange}
              onPressEnter={loadRules}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="Loại chống chỉ định"
              value={searchType}
              onChange={handleTypeChange}
              allowClear
            >
              <Select.Option value="AGE">Theo độ tuổi</Select.Option>
              <Select.Option value="PREGNANCY">Thai kỳ</Select.Option>
              <Select.Option value="BREASTFEEDING">Cho con bú</Select.Option>
              <Select.Option value="DISEASE">Bệnh nền mạn tính</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="Mức độ nghiêm trọng"
              value={searchSeverity}
              onChange={handleSeverityChange}
              allowClear
            >
              <Select.Option value="CONTRAINDICATED">Chống chỉ định tuyệt đối</Select.Option>
              <Select.Option value="SEVERE">Nguy cơ nặng</Select.Option>
              <Select.Option value="MODERATE">Nguy cơ trung bình</Select.Option>
              <Select.Option value="LOW">Thấp / Nhẹ</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="Trạng thái áp dụng"
              value={searchActive}
              onChange={handleActiveChange}
              allowClear
            >
              <Select.Option value={true}>Đang áp dụng</Select.Option>
              <Select.Option value={false}>Tạm dừng</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Bảng danh sách */}
      <Card style={{ borderRadius: 8 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rules}
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showTotal: (totalCount) => `Tổng cộng ${totalCount} quy tắc`,
            onChange: (p, s) => {
              setPage(p)
              setPageSize(s)
            },
          }}
        />
      </Card>

      {/* Modal Thêm mới / Chỉnh sửa */}
      <Modal
        title={editingRule ? 'Chỉnh sửa quy tắc chống chỉ định' : 'Thêm mới quy tắc chống chỉ định'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitForm}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Hoạt chất thuốc (Active Ingredient)"
            name="activeIngredient"
            rules={[{ required: true, message: 'Vui lòng nhập tên hoạt chất' }]}
          >
            <Input placeholder="VD: Ibuprofen, Warfarin, Ciprofloxacin..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Phân loại chống chỉ định"
                name="type"
                rules={[{ required: true, message: 'Vui lòng chọn loại quy tắc' }]}
              >
                <Select
                  onChange={(val) => {
                    if (val !== 'DISEASE') {
                      setSelectedDiagnosis(null)
                      form.setFieldsValue({ diagnosisCatalogId: undefined })
                    }
                    if (val !== 'AGE') {
                      form.setFieldsValue({ minAgeYears: undefined, maxAgeYears: undefined })
                    }
                  }}
                >
                  <Select.Option value="AGE">Theo độ tuổi</Select.Option>
                  <Select.Option value="PREGNANCY">Thai kỳ</Select.Option>
                  <Select.Option value="BREASTFEEDING">Cho con bú</Select.Option>
                  <Select.Option value="DISEASE">Bệnh nền mạn tính</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Mức độ nghiêm trọng"
                name="severity"
                rules={[{ required: true, message: 'Vui lòng chọn mức độ' }]}
              >
                <Select>
                  <Select.Option value="CONTRAINDICATED">Chống chỉ định tuyệt đối (Khóa đơn)</Select.Option>
                  <Select.Option value="SEVERE">Nguy cơ nặng (Yêu cầu lý do bỏ qua)</Select.Option>
                  <Select.Option value="MODERATE">Nguy cơ trung bình (Cảnh báo)</Select.Option>
                  <Select.Option value="LOW">Nguy cơ nhẹ / Thận trọng</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Type = AGE: Chỉ hiện minAge, maxAge */}
          {selectedTypeWatch === 'AGE' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Độ tuổi tối thiểu (tuổi)"
                  name="minAgeYears"
                  tooltip="Thuốc chống chỉ định cho người dưới độ tuổi này"
                >
                  <InputNumber min={0} max={120} style={{ width: '100%' }} placeholder="VD: 16 (dưới 16 tuổi)" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Độ tuổi tối đa (tuổi)"
                  name="maxAgeYears"
                  tooltip="Thuốc chống chỉ định cho người trên độ tuổi này"
                >
                  <InputNumber min={0} max={120} style={{ width: '100%' }} placeholder="VD: 65 (trên 65 tuổi)" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Type = DISEASE: Bắt buộc chọn mã bệnh qua DiagnosisCatalogAutocomplete */}
          {selectedTypeWatch === 'DISEASE' && (
            <div>
              <Form.Item
                label="Bệnh nền mạn tính (ICD-10)"
                name="diagnosisCatalogId"
                rules={[{ required: true, message: 'Vui lòng chọn mã bệnh ICD-10' }]}
                tooltip="Tìm kiếm và chọn mã bệnh theo mã ICD-10 hoặc tên bệnh tiếng Việt"
              >
                <DiagnosisCatalogAutocomplete
                  placeholder="🔍 Nhập mã ICD (I10, J45...) hoặc tên bệnh (Hen, Tăng huyết áp...)"
                  onSelect={(item) => {
                    setSelectedDiagnosis(item)
                    form.setFieldsValue({ diagnosisCatalogId: item?.id })
                    if (item?.id) {
                      setDiagnosisMap((prev) => ({
                        ...prev,
                        [item.id]: {
                          code: item.code,
                          name: item.name || item.diseaseName,
                        },
                      }))
                    }
                  }}
                  onChange={(code, item) => {
                    if (!code) {
                      setSelectedDiagnosis(null)
                      form.setFieldsValue({ diagnosisCatalogId: undefined })
                    }
                  }}
                />
              </Form.Item>
              {selectedDiagnosis && (
                <div style={{ marginTop: -12, marginBottom: 16, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <Text strong style={{ color: '#0369a1', marginRight: 8 }}>Bệnh đã chọn:</Text>
                  <Tag color="blue">{selectedDiagnosis.code}</Tag>
                  <Text>{selectedDiagnosis.name || selectedDiagnosis.diseaseName}</Text>
                </div>
              )}
            </div>
          )}

          <Form.Item
            label="Nội dung cảnh báo chi tiết"
            name="message"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung cảnh báo' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Chống chỉ định tuyệt đối cho phụ nữ có thai (nguy cơ đóng sớm ống động mạch thai nhi)..."
            />
          </Form.Item>

          <Form.Item
            label="Khuyến cáo xử trí lâm sàng"
            name="recommendation"
          >
            <Input.TextArea
              rows={2}
              placeholder="VD: Thay thế bằng Paracetamol với liều thấp nhất có hiệu quả lâm sàng..."
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <Button
              style={{ height: 42, minWidth: 100, borderRadius: 6 }}
              onClick={() => setModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ height: 42, minWidth: 120, borderRadius: 6, fontWeight: 600, fontSize: 15 }}
            >
              {editingRule ? 'Lưu thay đổi' : 'Tạo quy tắc'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Import file */}
      <Modal
        title="Nhập danh mục quy tắc chống chỉ định từ file"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false)
          setFileList([])
          setImportResult(null)
        }}
        footer={[
          <Button key="cancel" onClick={() => setImportModalOpen(false)}>Đóng</Button>,
          <Button
            key="upload"
            type="primary"
            icon={<UploadOutlined />}
            loading={importing}
            onClick={handleImportFile}
            disabled={fileList.length === 0}
          >
            Bắt đầu tải lên
          </Button>,
        ]}
      >
        <Paragraph style={{ color: '#475569' }}>
          Chọn file định dạng <strong>.CSV</strong> hoặc <strong>.XLSX</strong> chứa các cột:
          <code>active_ingredient, contraindication_type, min_age, max_age, severity, message, recommendation</code>.
        </Paragraph>
        <Upload
          fileList={fileList}
          beforeUpload={(file) => {
            setFileList([file])
            return false
          }}
          onRemove={() => setFileList([])}
          maxCount={1}
          accept=".csv,.xlsx,.xls"
        >
          <Button icon={<UploadOutlined />}>Chọn file từ máy tính</Button>
        </Upload>

        {importResult && (
          <Alert
            style={{ marginTop: 16 }}
            type="success"
            showIcon
            message="Kết quả tiếp nhận file từ Backend"
            description={
              <div>
                <div><strong>File:</strong> {importResult.fileName}</div>
                <div><strong>Số dòng xử lý sơ bộ:</strong> {importResult.totalProcessed} dòng</div>
                <div style={{ marginTop: 4, color: '#0369a1' }}>{importResult.message}</div>
              </div>
            }
          />
        )}
      </Modal>
    </div>
  )
}

