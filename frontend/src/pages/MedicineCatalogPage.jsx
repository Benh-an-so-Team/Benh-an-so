import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Divider,
  Switch,
  message,
} from 'antd'
import {
  AlertOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  ControlOutlined,
  DashboardOutlined,
  EditOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import medicineApi from '../api/medicineApi'
import pharmacyApi from '../api/pharmacyApi'
import { useAuthContext } from '../context/AuthContext'
import StockThresholdModal from '../components/pharmacy/StockThresholdModal'
import LowStockAlertTable from '../components/pharmacy/LowStockAlertTable'
import SpecialControlBadge from '../components/pharmacy/SpecialControlBadge.jsx'
import specialControlledDrugApi, {
  mergeSpecialControlData,
} from '../api/specialControlledDrugApi.js'
import {
  SPECIAL_CONTROL_GROUPS,
  validateSpecialControlMedicineForm,
} from '../utils/specialControlHelpers.js'
import {
  validateMedicineDoseConfig,
  buildMedicineDosePayload,
} from '../utils/maxDailyDoseHelpers.js'

const { Title, Text, Paragraph } = Typography

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .replace(/\s+/g, ' ')

const DOSAGE_FORM_LABELS = {
  TABLET: 'Viên nén',
  CAPSULE: 'Viên nang',
  SYRUP: 'Siro',
  SUSPENSION: 'Hỗn dịch',
  SOLUTION: 'Dung dịch',
  INJECTION: 'Dạng tiêm',
  INFUSION: 'Dạng truyền',
  CREAM: 'Kem bôi',
  OINTMENT: 'Thuốc mỡ',
  GEL: 'Gel',
  DROPS: 'Thuốc nhỏ',
  INHALER: 'Dạng hít/xịt',
  POWDER: 'Thuốc bột',
  SUPPOSITORY: 'Thuốc đặt',
  OTHER: 'Khác',
}

const ROUTE_LABELS = {
  ORAL: 'Uống',
  SUBLINGUAL: 'Ngậm dưới lưỡi',
  BUCCAL: 'Ngậm má',
  INTRAVENOUS: 'Tiêm tĩnh mạch (IV)',
  INTRAMUSCULAR: 'Tiêm bắp (IM)',
  SUBCUTANEOUS: 'Tiêm dưới da (SC)',
  TOPICAL: 'Bôi ngoài da',
  OPHTHALMIC: 'Nhỏ mắt',
  OTIC: 'Nhỏ tai',
  NASAL: 'Nhỏ/Xịt mũi',
  INHALATION: 'Dạng hít qua hô hấp',
  RECTAL: 'Đặt trực tràng',
  VAGINAL: 'Đặt âm đạo',
  TRANSDERMAL: 'Dán qua da',
  OTHER: 'Khác',
}

function MedicineCatalogPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: currentUser } = useAuthContext()

  const userRoles = Array.isArray(currentUser?.roles)
    ? currentUser.roles
    : currentUser?.role
    ? [currentUser.role]
    : []

  const normalizedRoles = userRoles.map((role) =>
    String(role || '').toUpperCase().replace(/^ROLE_/, '')
  )
  const canManageMedicineCatalog =
    normalizedRoles.includes('PHARMACIST') || normalizedRoles.includes('ADMIN')

  const [activeTab, setActiveTab] = useState(
    location.state?.tab || 'catalog'
  )

  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const [lowStockList, setLowStockList] = useState([])
  const [lowStockLoading, setLowStockLoading] = useState(false)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalElements, setTotalElements] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState(null)
  const [deactivatingMedicine, setDeactivatingMedicine] = useState(null)

  const [thresholdModalOpen, setThresholdModalOpen] = useState(false)
  const [thresholdMedicine, setThresholdMedicine] = useState(null)

  const [inlineEditingId, setInlineEditingId] = useState(null)
  const [inlineValue, setInlineValue] = useState(0)
  const [inlineSaving, setInlineSaving] = useState(false)

  const [isSpecialControlChecked, setIsSpecialControlChecked] = useState(false)
  const [specialControlFilter, setSpecialControlFilter] = useState('ALL')

  const [form] = Form.useForm()

  const loadLowStockAlerts = useCallback(async () => {
    if (!canManageMedicineCatalog) return
    setLowStockLoading(true)
    try {
      const res = await pharmacyApi.lowStock()
      const list = Array.isArray(res?.data) ? res.data : []
      setLowStockList(list)
    } catch {
      setLowStockList([])
    } finally {
      setLowStockLoading(false)
    }
  }, [canManageMedicineCatalog])

  const loadMedicines = useCallback(async () => {
    if (!canManageMedicineCatalog) return

    setLoading(true)
    setErrorMessage(null)
    try {
      const activeParam =
        statusFilter === 'ALL'
          ? undefined
          : statusFilter === 'ACTIVE'
          ? true
          : false

      const res = await medicineApi.search({
        keyword: searchKeyword.trim() || undefined,
        active: activeParam,
        page: page - 1,
        size: pageSize,
      })

      const responseData = res?.data
      const content = responseData?.content
        ? responseData.content
        : Array.isArray(responseData)
        ? responseData
        : []

      const rawList = Array.isArray(content) ? content : []
      const mergedContent = mergeSpecialControlData(rawList)
      setMedicines(mergedContent)
      setTotalElements(responseData?.totalElements ?? mergedContent.length)
    } catch (err) {
      const status = err.response?.status
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Không thể tải danh mục thuốc từ máy chủ.'

      if (status === 403) {
        setErrorMessage('Bạn không có quyền quản lý danh mục thuốc.')
      } else if (status === 401) {
        setErrorMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      } else {
        setErrorMessage(`Lỗi máy chủ (${status || 500}): ${msg}`)
      }
      setMedicines([])
    } finally {
      setLoading(false)
    }
  }, [canManageMedicineCatalog, searchKeyword, statusFilter, page, pageSize])

  const refreshAll = useCallback(() => {
    loadMedicines()
    loadLowStockAlerts()
  }, [loadMedicines, loadLowStockAlerts])

  useEffect(() => {
    loadMedicines()
  }, [loadMedicines])

  useEffect(() => {
    loadLowStockAlerts()
  }, [loadLowStockAlerts])

  const openAddModal = () => {
    if (!canManageMedicineCatalog) {
      message.error('Bạn không có quyền quản lý danh mục thuốc.')
      return
    }
    setEditingMedicine(null)
    setIsSpecialControlChecked(false)
    form.resetFields()
    form.setFieldsValue({
      medicineCode: `MED-${Date.now().toString().slice(-6)}`,
      dosageForm: 'TABLET',
      defaultRoute: 'ORAL',
      unit: 'Viên',
      minStockThreshold: 10,
      strengthValueMg: undefined,
      maxDailyDoseMg: undefined,
      isSpecialControl: false,
    })
    setModalOpen(true)
  }

  const openEditModal = (record) => {
    if (!canManageMedicineCatalog) {
      message.error('Bạn không có quyền quản lý danh mục thuốc.')
      return
    }
    const isSpecial = Boolean(record.isSpecialControl)
    setEditingMedicine(record)
    setIsSpecialControlChecked(isSpecial)
    form.resetFields()
    form.setFieldsValue({
      medicineCode: record.medicineCode || '',
      medicineName: record.medicineName || '',
      activeIngredient: record.activeIngredient || '',
      strength: record.strength || '',
      dosageForm: record.dosageForm || 'TABLET',
      unit: record.unit || '',
      defaultRoute: record.defaultRoute || 'ORAL',
      minStockThreshold: record.minStockThreshold ?? 0,
      strengthValueMg: record.strengthValueMg != null ? Number(record.strengthValueMg) : undefined,
      maxDailyDoseMg: record.maxDailyDoseMg != null ? Number(record.maxDailyDoseMg) : undefined,
      isSpecialControl: isSpecial,
      specialControlGroup: record.specialControlGroup || undefined,
      specialControlNote: record.specialControlNote || '',
    })
    setModalOpen(true)
  }

  const openThresholdModal = (record) => {
    setThresholdMedicine(record)
    setThresholdModalOpen(true)
  }

  const handleSaveMedicine = async (values) => {
    if (!canManageMedicineCatalog) {
      message.error('Bạn không có quyền quản lý danh mục thuốc.')
      return
    }

    const trimmedCode = String(values.medicineCode ?? '').trim()
    const trimmedName = String(values.medicineName ?? '').trim()
    const trimmedActive = String(values.activeIngredient ?? '').trim()
    const trimmedStrength = String(values.strength ?? '').trim()
    const trimmedUnit = String(values.unit ?? '').trim()
    const dosageFormVal = values.dosageForm
    const defaultRouteVal = values.defaultRoute
    const thresholdVal = Number(values.minStockThreshold ?? 0)

    if (!trimmedName) {
      message.error('Vui lòng nhập tên thuốc.')
      return
    }
    if (!trimmedUnit) {
      message.error('Vui lòng nhập đơn vị tính.')
      return
    }
    if (!trimmedActive) {
      message.error('Vui lòng nhập hoạt chất.')
      return
    }
    if (!trimmedStrength) {
      message.error('Vui lòng nhập hàm lượng.')
      return
    }
    if (!editingMedicine && !trimmedCode) {
      message.error('Vui lòng nhập mã thuốc.')
      return
    }

    const targetKey =
      normalizeText(trimmedName) + '_' + normalizeText(trimmedActive)

    const isDuplicate = medicines.some((m) => {
      if (editingMedicine && String(m.id) === String(editingMedicine.id)) {
        return false
      }
      const existingKey =
        normalizeText(m.medicineName) + '_' + normalizeText(m.activeIngredient)
      return existingKey === targetKey
    })

    if (isDuplicate) {
      message.warning('Thuốc đã tồn tại trong danh mục.')
      return
    }

    const specialValidation = validateSpecialControlMedicineForm(values)
    if (!specialValidation.valid) {
      message.error(specialValidation.error)
      return
    }

    const doseValidation = validateMedicineDoseConfig(values.strengthValueMg, values.maxDailyDoseMg)
    if (!doseValidation.valid) {
      message.error(doseValidation.error)
      return
    }
    if (doseValidation.warning) {
      message.warning(doseValidation.warning)
    }

    const dosePayload = buildMedicineDosePayload(values)

    const isSpecial = Boolean(values.isSpecialControl)
    const specialPayload = {
      isSpecialControl: isSpecial,
      specialControlGroup: isSpecial ? values.specialControlGroup : null,
      specialControlNote: isSpecial ? (values.specialControlNote || '').trim() : null,
    }

    setSubmitting(true)
    try {
      if (editingMedicine) {
        const updatePayload = {
          medicineName: trimmedName,
          activeIngredient: trimmedActive,
          strength: trimmedStrength,
          dosageForm: dosageFormVal,
          unit: trimmedUnit,
          defaultRoute: defaultRouteVal,
          minStockThreshold: thresholdVal,
          strengthValueMg: dosePayload.strengthValueMg,
          maxDailyDoseMg: dosePayload.maxDailyDoseMg,
        }
        await medicineApi.update(editingMedicine.id, updatePayload)
        try {
          await specialControlledDrugApi.patchSpecialControl(editingMedicine.id, specialPayload)
        } catch {
          // backend update fallback
        }
        // Cập nhật ngay state trước khi fetch lại từ backend
        setMedicines((prev) =>
          prev.map((m) =>
            String(m.id) === String(editingMedicine.id)
              ? { ...m, ...updatePayload, ...specialPayload }
              : m
          )
        )
        message.success(`Đã cập nhật thuốc ${trimmedName}`)
      } else {
        const createPayload = {
          medicineCode: trimmedCode,
          medicineName: trimmedName,
          activeIngredient: trimmedActive,
          strength: trimmedStrength,
          dosageForm: dosageFormVal,
          unit: trimmedUnit,
          defaultRoute: defaultRouteVal,
          minStockThreshold: thresholdVal,
          strengthValueMg: dosePayload.strengthValueMg,
          maxDailyDoseMg: dosePayload.maxDailyDoseMg,
        }
        const createdRes = await medicineApi.create(createPayload)
        const createdId = createdRes?.data?.id || createdRes?.id
        if (createdId) {
          try {
            await specialControlledDrugApi.patchSpecialControl(createdId, specialPayload)
          } catch {
            // fallback
          }
        }
        message.success(`Đã thêm thuốc mới ${trimmedName} vào danh mục thành công`)
      }

      setModalOpen(false)
      setEditingMedicine(null)
      setIsSpecialControlChecked(false)
      form.resetFields()
      refreshAll()
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message || err.message

      if (status === 409) {
        message.error(msg || 'Thuốc đã tồn tại trong danh mục.')
      } else if (status === 400) {
        if (
          typeof msg === 'string' &&
          (msg.includes('Strength value') ||
            msg.includes('Max daily dose') ||
            msg.includes('greater than 0') ||
            msg.includes('strengthValueMg') ||
            msg.includes('maxDailyDoseMg'))
        ) {
          message.error('Hàm lượng hoạt chất (mg) và liều tối đa theo ngày phải lớn hơn 0.')
        } else {
          message.error(msg || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.')
        }
      } else {
        message.error(msg || 'Không thể lưu dữ liệu thuốc lên máy chủ.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startInlineEdit = (record) => {
    setInlineEditingId(record.id)
    setInlineValue(Number(record.minStockThreshold ?? 0))
  }

  const cancelInlineEdit = () => {
    setInlineEditingId(null)
    setInlineValue(0)
  }

  const saveInlineEdit = async (record) => {
    const nextThreshold = Number(inlineValue ?? 0)
    if (nextThreshold < 0) {
      message.error('Ngưỡng tồn không được âm.')
      return
    }

    setInlineSaving(true)
    try {
      const payload = {
        medicineName: record.medicineName,
        activeIngredient: record.activeIngredient,
        strength: record.strength,
        dosageForm: record.dosageForm,
        unit: record.unit,
        defaultRoute: record.defaultRoute,
        minStockThreshold: nextThreshold,
      }
      await medicineApi.update(record.id, payload)
      message.success(`Đã đổi ngưỡng tồn của ${record.medicineName} thành ${nextThreshold} ${record.unit || ''}`)
      setInlineEditingId(null)
      refreshAll()
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'Không thể lưu ngưỡng tồn.')
    } finally {
      setInlineSaving(false)
    }
  }

  const handleToggleStatus = async (record, targetActiveState) => {
    if (!canManageMedicineCatalog) {
      message.error('Bạn không có quyền quản lý danh mục thuốc.')
      return
    }

    try {
      await medicineApi.updateStatus(record.id, targetActiveState)
      message.success(
        `Đã ${targetActiveState ? 'kích hoạt lại' : 'ngừng sử dụng'} thuốc ${
          record.medicineName
        }`
      )
      setDeactivatingMedicine(null)
      refreshAll()
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Không thể thay đổi trạng thái thuốc.'
      message.error(msg)
    }
  }

  const filteredMedicines = useMemo(() => {
    let list = Array.isArray(medicines) ? medicines : []

    if (stockStatusFilter === 'LOW_STOCK') {
      list = list.filter(
        (m) =>
          Number(m.minStockThreshold || 0) > 0 &&
          Number(m.stockQuantity || 0) < Number(m.minStockThreshold || 0)
      )
    } else if (stockStatusFilter === 'OUT_OF_STOCK') {
      list = list.filter((m) => Number(m.stockQuantity || 0) === 0)
    } else if (stockStatusFilter === 'SAFE') {
      list = list.filter(
        (m) =>
          Number(m.minStockThreshold || 0) > 0 &&
          Number(m.stockQuantity || 0) >= Number(m.minStockThreshold || 0)
      )
    } else if (stockStatusFilter === 'UNSET') {
      list = list.filter((m) => Number(m.minStockThreshold || 0) === 0)
    }

    if (specialControlFilter === 'SPECIAL') {
      list = list.filter((m) => Boolean(m.isSpecialControl))
    } else if (specialControlFilter === 'NORMAL') {
      list = list.filter((m) => !m.isSpecialControl)
    } else if (specialControlFilter && specialControlFilter !== 'ALL') {
      list = list.filter(
        (m) => Boolean(m.isSpecialControl) && m.specialControlGroup === specialControlFilter
      )
    }

    // TODO (Backend): Cần bổ sung tham số `missingMaxDailyDose` vào SearchMedicinesQuery / API GET /medicines
    // để hỗ trợ lọc phân trang server-side đồng bộ (tránh lỗi lệch pha filter/phân trang trên từng trang
    // client-side như từng gặp ở Danh mục CLS). Hiện tại bảng hiển thị trực quan qua Tag "Chưa khai báo liều".
    return list
  }, [medicines, stockStatusFilter, specialControlFilter])

  const stats = useMemo(() => {
    const total = totalElements || medicines.length
    const lowStockCount = lowStockList.length
    const outOfStockCount = lowStockList.filter(
      (item) => Number(item.eligibleStockQuantity || item.stockQuantity || 0) === 0
    ).length
    const safeCount = Math.max(total - lowStockCount, 0)

    return { total, lowStockCount, outOfStockCount, safeCount }
  }, [totalElements, medicines, lowStockList])

  if (!canManageMedicineCatalog) {
    return (
      <div style={{ padding: 24 }}>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 20px', maxWidth: 600, margin: '40px auto' }}>
          <Empty description="Tài khoản của bạn không có quyền quản lý danh mục và ngưỡng tồn thuốc." />
        </Card>
      </div>
    )
  }

  const columns = [
    {
      title: 'Mã thuốc',
      dataIndex: 'medicineCode',
      key: 'medicineCode',
      width: 120,
      render: (v) => <Text code>{v || '—'}</Text>,
    },
    {
      title: 'Tên thuốc & Hoạt chất',
      key: 'medicineInfo',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space align="center" wrap>
            <strong>{record.medicineName || '—'}</strong>
            {record.isSpecialControl && (
              <SpecialControlBadge
                group={record.specialControlGroup}
                note={record.specialControlNote}
                short
              />
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[record.activeIngredient, record.strength].filter(Boolean).join(' · ')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Dạng bào chế',
      dataIndex: 'dosageForm',
      key: 'dosageForm',
      width: 120,
      render: (v) => (v ? DOSAGE_FORM_LABELS[v] || v : '—'),
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      align: 'center',
      render: (v) => <Tag color="blue">{v || '—'}</Tag>,
    },
    {
      title: 'Liều tối đa/ngày',
      key: 'maxDailyDose',
      width: 175,
      render: (_, record) => {
        const strength = record.strengthValueMg != null ? Number(record.strengthValueMg) : null
        const maxDose = record.maxDailyDoseMg != null ? Number(record.maxDailyDoseMg) : null

        if (maxDose == null && strength == null) {
          return (
            <Space direction="vertical" size={2}>
              <span style={{ color: '#94a3b8' }}>—</span>
              <Tag
                style={{
                  fontSize: 11,
                  margin: 0,
                  padding: '1px 6px',
                  borderRadius: 4,
                  border: '1px dashed #cbd5e1',
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                }}
              >
                Chưa khai báo liều
              </Tag>
            </Space>
          )
        }

        if (maxDose != null && strength != null) {
          return (
            <Space direction="vertical" size={2}>
              <span style={{ fontWeight: 600, color: '#0369a1' }}>
                {maxDose.toLocaleString('vi-VN')} mg/ngày
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Hàm lượng: {strength.toLocaleString('vi-VN')} mg/{record.unit || 'đơn vị'}
              </span>
            </Space>
          )
        }

        return (
          <Space direction="vertical" size={2}>
            {maxDose != null ? (
              <span style={{ fontWeight: 600, color: '#0369a1' }}>
                {maxDose.toLocaleString('vi-VN')} mg/ngày
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Hàm lượng: {strength.toLocaleString('vi-VN')} mg/{record.unit || 'đơn vị'}
              </span>
            )}
            <Tag color="warning" style={{ fontSize: 11, margin: 0, padding: '1px 6px', borderRadius: 4 }}>
              Chưa đủ cặp kiểm tra
            </Tag>
          </Space>
        )
      },
    },
    {
      title: 'Tồn kho thực tế',
      dataIndex: 'stockQuantity',
      key: 'stockQuantity',
      width: 130,
      align: 'right',
      render: (val, record) => {
        const stock = Number(val || 0)
        const threshold = Number(record.minStockThreshold || 0)
        const isOutOfStock = stock === 0
        const isLow = threshold > 0 && stock < threshold

        return (
          <Space direction="vertical" size={2} align="end">
            <span
              style={{
                fontWeight: 700,
                color: isOutOfStock ? '#dc2626' : isLow ? '#d97706' : '#16a34a',
              }}
            >
              {stock.toLocaleString('vi-VN')} {record.unit || ''}
            </span>
            {isOutOfStock ? (
              <Tag color="red" style={{ margin: 0 }}>Hết hàng</Tag>
            ) : isLow ? (
              <Tag color="orange" style={{ margin: 0 }}>Dưới ngưỡng</Tag>
            ) : (
              <Tag color="green" style={{ margin: 0 }}>An toàn</Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Ngưỡng tồn tối thiểu',
      dataIndex: 'minStockThreshold',
      key: 'minStockThreshold',
      width: 200,
      align: 'right',
      render: (val, record) => {
        const isInline = inlineEditingId === record.id
        const thresholdNum = Number(val || 0)

        if (isInline) {
          return (
            <Space size="small">
              <InputNumber
                size="small"
                min={0}
                max={1000000}
                precision={0}
                value={inlineValue}
                style={{ width: 90 }}
                autoFocus
                onChange={(num) => setInlineValue(Number(num ?? 0))}
                onPressEnter={() => saveInlineEdit(record)}
              />
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                loading={inlineSaving}
                onClick={() => saveInlineEdit(record)}
              />
              <Button
                size="small"
                icon={<CloseOutlined />}
                disabled={inlineSaving}
                onClick={cancelInlineEdit}
              />
            </Space>
          )
        }

        return (
          <Space size="small">
            <span
              style={{
                fontWeight: 600,
                color: thresholdNum === 0 ? '#94a3b8' : '#1e293b',
              }}
            >
              {thresholdNum === 0 ? (
                <Text type="secondary" italic>Chưa đặt (0)</Text>
              ) : (
                `${thresholdNum.toLocaleString('vi-VN')} ${record.unit || ''}`
              )}
            </span>
            <Tooltip title="Chỉnh sửa nhanh ngưỡng tồn">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: '#1677ff' }} />}
                onClick={() => startInlineEdit(record)}
              />
            </Tooltip>
          </Space>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      key: 'active',
      width: 120,
      render: (val) => (
        <Tag color={val !== false ? 'green' : 'default'}>
          {val !== false ? 'Đang dùng' : 'Ngừng dùng'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'threshold',
            icon: <ControlOutlined style={{ color: '#2563eb' }} />,
            label: 'Thiết lập ngưỡng tồn',
            onClick: () => openThresholdModal(record),
          },
          {
            key: 'edit',
            icon: <EditOutlined style={{ color: '#0284c7' }} />,
            label: 'Sửa thông tin thuốc',
            onClick: () => openEditModal(record),
          },
          {
            type: 'divider',
          },
          record.active !== false
            ? {
                key: 'deactivate',
                icon: <StopOutlined />,
                danger: true,
                label: 'Ngừng sử dụng',
                onClick: () => setDeactivatingMedicine(record),
              }
            : {
                key: 'activate',
                icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
                label: 'Kích hoạt sử dụng',
                onClick: () => handleToggleStatus(record, true),
              },
        ]

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button
              size="small"
              icon={<EllipsisOutlined />}
              title="Thao tác"
              style={{
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24, paddingBottom: 40 }}>
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <MedicineBoxOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Quản lý Danh mục & Ngưỡng tồn thuốc
          </Title>
        </div>

        <Space wrap>
          <Button
            icon={<InboxOutlined />}
            onClick={() => navigate('/pharmacy/receipts')}
          >
            Nhập kho theo lô
          </Button>
          <Button
            icon={<ReloadOutlined />}
            loading={loading || lowStockLoading}
            onClick={refreshAll}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAddModal}
          >
            Thêm thuốc mới
          </Button>
        </Space>
      </div>

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          action={
            <Button
              size="small"
              type="primary"
              danger
              icon={<ReloadOutlined />}
              onClick={refreshAll}
            >
              Thử lại
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Tổng số loại thuốc"
              value={stats.total}
              prefix={<MedicineBoxOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 8,
              borderLeft: stats.lowStockCount > 0 ? '4px solid #faad14' : undefined,
            }}
          >
            <Statistic
              title="Thuốc dưới ngưỡng tồn"
              value={stats.lowStockCount}
              valueStyle={stats.lowStockCount > 0 ? { color: '#faad14', fontWeight: 700 } : undefined}
              prefix={<WarningOutlined />}
              suffix={
                stats.lowStockCount > 0 && (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, marginLeft: 8 }}
                    onClick={() => setActiveTab('alerts')}
                  >
                    Xem chi tiết →
                  </Button>
                )
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 8,
              borderLeft: stats.outOfStockCount > 0 ? '4px solid #ff4d4f' : undefined,
            }}
          >
            <Statistic
              title="Thuốc đã hết hàng"
              value={stats.outOfStockCount}
              valueStyle={stats.outOfStockCount > 0 ? { color: '#ff4d4f', fontWeight: 700 } : undefined}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Tồn kho đạt mức an toàn"
              value={stats.safeCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: '16px 20px' } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'catalog',
              label: (
                <Space>
                  <MedicineBoxOutlined />
                  <span>Danh mục & Thiết lập ngưỡng tồn</span>
                </Space>
              ),
              children: (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <Space wrap size="middle">
                      <Input.Search
                        placeholder="Tìm theo tên thuốc, hoạt chất, mã..."
                        allowClear
                        style={{ width: 320 }}
                        onSearch={(val) => {
                          setSearchKeyword(val)
                          setPage(1)
                        }}
                        onChange={(e) => {
                          if (!e.target.value) {
                            setSearchKeyword('')
                            setPage(1)
                          }
                        }}
                      />

                      <Select
                        defaultValue="ALL"
                        value={statusFilter}
                        style={{ width: 160 }}
                        onChange={(val) => {
                          setStatusFilter(val)
                          setPage(1)
                        }}
                        options={[
                          { value: 'ALL', label: 'Tất cả trạng thái' },
                          { value: 'ACTIVE', label: 'Đang dùng' },
                          { value: 'INACTIVE', label: 'Ngừng dùng' },
                        ]}
                      />

                      <Select
                        defaultValue="ALL"
                        value={stockStatusFilter}
                        style={{ width: 220 }}
                        onChange={setStockStatusFilter}
                        options={[
                          { value: 'ALL', label: 'Tất cả tình trạng tồn' },
                          { value: 'LOW_STOCK', label: '⚠️ Dưới ngưỡng tồn (Cần nhập)' },
                          { value: 'OUT_OF_STOCK', label: '🔴 Đã hết hàng' },
                          { value: 'SAFE', label: '🟢 Đạt mức an toàn' },
                          { value: 'UNSET', label: '⚪ Chưa đặt ngưỡng (0)' },
                        ]}
                      />

                      <Select
                        defaultValue="ALL"
                        value={specialControlFilter}
                        style={{ width: 230 }}
                        onChange={setSpecialControlFilter}
                        options={[
                          { value: 'ALL', label: 'Tất cả nhóm kiểm soát' },
                          { value: 'SPECIAL', label: '⭐ Tất cả thuốc kiểm soát đặc biệt' },
                          { value: 'NARCOTIC', label: '🔴 Thuốc gây nghiện' },
                          { value: 'PSYCHOTROPIC', label: '🟠 Thuốc hướng thần' },
                          { value: 'PRECURSOR', label: '🟡 Thuốc tiền chất' },
                          { value: 'TOXIC', label: '🟣 Thuốc độc / Dược chất độc' },
                          { value: 'NORMAL', label: 'Thuốc thông thường' },
                        ]}
                      />
                    </Space>
                  </div>

                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredMedicines}
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 1050 }}
                    locale={{ emptyText: 'Không tìm thấy thuốc nào phù hợp với bộ lọc' }}
                  />

                  <div
                    style={{
                      marginTop: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <Text type="secondary">
                      Hiển thị {filteredMedicines.length} thuốc · Trang {page} / {Math.ceil(totalElements / pageSize) || 1}
                    </Text>

                    <Pagination
                      current={page}
                      pageSize={pageSize}
                      total={totalElements}
                      showSizeChanger
                      pageSizeOptions={['10', '20', '50', '100']}
                      onChange={(p, ps) => {
                        setPage(p)
                        setPageSize(ps)
                      }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'alerts',
              label: (
                <Space>
                  <WarningOutlined style={{ color: stats.lowStockCount > 0 ? '#faad14' : undefined }} />
                  <span>Cảnh báo thiếu tồn kho</span>
                  {stats.lowStockCount > 0 && (
                    <Badge
                      count={stats.lowStockCount}
                      overflowCount={99}
                      style={{ backgroundColor: '#ff4d4f' }}
                    />
                  )}
                </Space>
              ),
              children: (
                <LowStockAlertTable
                  items={lowStockList}
                  loading={lowStockLoading}
                  onRefresh={loadLowStockAlerts}
                  onEditThreshold={(item) => {
                    openThresholdModal({
                      id: item.medicineId,
                      medicineCode: item.medicineCode,
                      medicineName: item.medicineName,
                      activeIngredient: item.activeIngredient,
                      unit: item.unit,
                      stockQuantity: item.stockQuantity,
                      minStockThreshold: item.minStockThreshold,
                    })
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      <StockThresholdModal
        open={thresholdModalOpen}
        medicine={thresholdMedicine}
        onCancel={() => {
          setThresholdModalOpen(false)
          setThresholdMedicine(null)
        }}
        onSuccess={() => {
          refreshAll()
        }}
      />

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 4 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: editingMedicine ? '#eff6ff' : '#f0fdf4',
                color: editingMedicine ? '#2563eb' : '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                border: editingMedicine ? '1px solid #bfdbfe' : '1px solid #bbf7d0',
              }}
            >
              {editingMedicine ? <EditOutlined /> : <PlusOutlined />}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                {editingMedicine
                  ? `Sửa thông tin thuốc: ${editingMedicine.medicineName}`
                  : 'Thêm thuốc mới vào danh mục'}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                {editingMedicine
                  ? 'Cập nhật thông tin chi tiết, ngưỡng tồn kho và phân loại kiểm soát đặc biệt'
                  : 'Khai báo thông số thuốc, hoạt chất và thiết lập giám sát dược phẩm'}
              </div>
            </div>
          </div>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingMedicine(null)
        }}
        footer={[
          <Button
            key="cancel"
            size="large"
            onClick={() => {
              setModalOpen(false)
              setEditingMedicine(null)
            }}
            style={{
              height: 42,
              minWidth: 100,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Hủy bỏ
          </Button>,
          <Button
            key="submit"
            type="primary"
            size="large"
            loading={submitting}
            onClick={() => form.submit()}
            style={{
              height: 42,
              minWidth: 130,
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {editingMedicine ? 'Lưu thay đổi' : 'Tạo mới'}
          </Button>,
        ]}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveMedicine}
          onValuesChange={(changedValues) => {
            if ('isSpecialControl' in changedValues) {
              setIsSpecialControlChecked(Boolean(changedValues.isSpecialControl))
            }
          }}
          initialValues={{
            dosageForm: 'TABLET',
            defaultRoute: 'ORAL',
            unit: 'Viên',
            minStockThreshold: 10,
            isSpecialControl: false,
          }}
          style={{ marginTop: 12 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="medicineCode"
                label={<strong>Mã thuốc</strong>}
                rules={[{ required: true, message: 'Vui lòng nhập mã thuốc.' }]}
              >
                <Input
                  placeholder="VD: MED-001"
                  disabled={!!editingMedicine}
                  style={{ borderRadius: 8, height: 38 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={16}>
              <Form.Item
                name="medicineName"
                label={<strong>Tên thuốc</strong>}
                rules={[{ required: true, message: 'Vui lòng nhập tên thuốc.' }]}
              >
                <Input
                  placeholder="VD: Paracetamol 500mg"
                  style={{ borderRadius: 8, height: 38 }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item
                name="activeIngredient"
                label={<strong>Hoạt chất chính</strong>}
                rules={[{ required: true, message: 'Vui lòng nhập hoạt chất.' }]}
              >
                <Input
                  placeholder="VD: Paracetamol"
                  style={{ borderRadius: 8, height: 38 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={10}>
              <Form.Item
                name="strength"
                label={<strong>Hàm lượng</strong>}
                rules={[{ required: true, message: 'Vui lòng nhập hàm lượng.' }]}
              >
                <Input
                  placeholder="VD: 500 mg, 10mg/5ml..."
                  style={{ borderRadius: 8, height: 38 }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="dosageForm"
                label={<strong>Dạng bào chế</strong>}
                rules={[{ required: true, message: 'Vui lòng chọn dạng bào chế.' }]}
              >
                <Select
                  style={{ borderRadius: 8, height: 38 }}
                  options={Object.entries(DOSAGE_FORM_LABELS).map(
                    ([key, val]) => ({
                      value: key,
                      label: val,
                    })
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="defaultRoute"
                label={<strong>Đường dùng / Cách dùng</strong>}
                rules={[{ required: true, message: 'Vui lòng chọn cách dùng.' }]}
              >
                <Select
                  style={{ borderRadius: 8, height: 38 }}
                  options={Object.entries(ROUTE_LABELS).map(([key, val]) => ({
                    value: key,
                    label: val,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="unit"
                label={<strong>Đơn vị tính</strong>}
                rules={[{ required: true, message: 'Vui lòng nhập đơn vị tính.' }]}
              >
                <Input
                  placeholder="VD: Viên, Chai, Gói, Tuýp..."
                  style={{ borderRadius: 8, height: 38 }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="minStockThreshold"
                label={<strong>Ngưỡng tồn kho tối thiểu</strong>}
                rules={[{ required: true, message: 'Vui lòng nhập ngưỡng tồn kho.' }]}
                tooltip="Hệ thống sẽ bật cảnh báo khi lượng tồn khả dụng thấp hơn mức này"
              >
                <InputNumber
                  min={0}
                  max={1000000}
                  precision={0}
                  style={{ width: '100%', borderRadius: 8, height: 38, lineHeight: '38px' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="strengthValueMg"
                label={<strong>Hàm lượng hoạt chất (mg/đơn vị)</strong>}
                tooltip="Khai báo để hệ thống cảnh báo khi đơn vượt liều tối đa theo ngày. Bỏ trống sẽ không kiểm tra tự động."
                rules={[
                  {
                    validator: (_, val) => {
                      if (val != null && val !== '') {
                        const num = Number(val)
                        if (isNaN(num) || num <= 0) {
                          return Promise.reject(new Error('Hàm lượng hoạt chất phải lớn hơn 0.'))
                        }
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
              >
                <InputNumber
                  min={0.001}
                  step={0.001}
                  precision={3}
                  placeholder="VD: 500 (mg)"
                  style={{ width: '100%', borderRadius: 8, height: 38, lineHeight: '38px' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="maxDailyDoseMg"
                label={<strong>Liều tối đa theo ngày (mg/ngày)</strong>}
                tooltip="Khai báo để hệ thống cảnh báo khi đơn vượt liều tối đa theo ngày. Bỏ trống sẽ không kiểm tra tự động."
                rules={[
                  {
                    validator: (_, val) => {
                      if (val != null && val !== '') {
                        const num = Number(val)
                        if (isNaN(num) || num <= 0) {
                          return Promise.reject(new Error('Liều tối đa theo ngày phải lớn hơn 0.'))
                        }
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
              >
                <InputNumber
                  min={0.001}
                  step={0.001}
                  precision={3}
                  placeholder="VD: 4000 (mg/ngày)"
                  style={{ width: '100%', borderRadius: 8, height: 38, lineHeight: '38px' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Khung cấu hình Thuốc kiểm soát đặc biệt thiết kế cao cấp */}
          <div
            style={{
              marginTop: 10,
              marginBottom: 10,
              padding: '16px 18px',
              borderRadius: 12,
              border: isSpecialControlChecked
                ? '1px solid #fdba74'
                : '1px solid #e2e8f0',
              backgroundColor: isSpecialControlChecked ? '#fffaf5' : '#f8fafc',
              transition: 'all 0.25s ease',
              boxShadow: isSpecialControlChecked
                ? '0 4px 14px rgba(249, 115, 22, 0.08)'
                : 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSpecialControlChecked ? '#ffedd5' : '#f1f5f9',
                    color: isSpecialControlChecked ? '#ea580c' : '#64748b',
                    fontSize: 22,
                    flexShrink: 0,
                    border: isSpecialControlChecked
                      ? '1px solid #fed7aa'
                      : '1px solid #e2e8f0',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <SafetyCertificateOutlined />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: isSpecialControlChecked ? '#9a3412' : '#1e293b',
                      lineHeight: 1.3,
                    }}
                  >
                    Thuốc kiểm soát đặc biệt
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: isSpecialControlChecked ? '#c2410c' : '#64748b',
                      marginTop: 2,
                    }}
                  >
                    Áp dụng quy chế giám sát nghiêm ngặt khi kê đơn và cấp phát
                  </div>
                </div>
              </div>

              <Form.Item
                name="isSpecialControl"
                valuePropName="checked"
                style={{ margin: 0 }}
              >
                <Switch
                  checked={isSpecialControlChecked}
                  checkedChildren="BẬT"
                  unCheckedChildren="TẮT"
                  onChange={(checked) => {
                    setIsSpecialControlChecked(checked)
                    form.setFieldsValue({ isSpecialControl: checked })
                  }}
                  style={{
                    backgroundColor: isSpecialControlChecked ? '#ea580c' : undefined,
                    minWidth: 54,
                  }}
                />
              </Form.Item>
            </div>

            {isSpecialControlChecked && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: '1px dashed #fed7aa',
                }}
              >
                <Form.Item
                  name="specialControlGroup"
                  label={
                    <span style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                      Nhóm kiểm soát đặc biệt
                    </span>
                  }
                  rules={[
                    {
                      required: isSpecialControlChecked,
                      message: 'Vui lòng chọn nhóm kiểm soát đặc biệt.',
                    },
                  ]}
                  style={{ marginBottom: 14 }}
                >
                  <Select
                    size="large"
                    placeholder="Chọn nhóm kiểm soát theo quy định Bộ Y tế"
                    style={{ width: '100%', borderRadius: 8 }}
                    options={Object.values(SPECIAL_CONTROL_GROUPS).map((g) => ({
                      value: g.code,
                      label: (
                        <Space align="center">
                          <Tag
                            color={g.tagColor}
                            style={{
                              margin: 0,
                              fontWeight: 600,
                              borderRadius: 4,
                              padding: '2px 8px',
                            }}
                          >
                            {g.shortLabel}
                          </Tag>
                          <span style={{ fontWeight: 500 }}>{g.label}</span>
                        </Space>
                      ),
                    }))}
                  />
                </Form.Item>

                <Form.Item
                  name="specialControlNote"
                  label={
                    <span style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                      Ghi chú và cảnh báo lâm sàng
                    </span>
                  }
                  tooltip="Thông tin này sẽ hiển thị cảnh báo trực tiếp cho Bác sĩ khi kê đơn và Dược sĩ khi cấp phát thuốc."
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea
                    rows={3}
                    maxLength={500}
                    showCount
                    placeholder="Nhập hướng dẫn liều dùng tối đa, lưu ý bảo quản hoặc quy chế cấp phát..."
                    style={{
                      borderRadius: 8,
                      fontSize: 14,
                      padding: '8px 12px',
                    }}
                  />
                </Form.Item>
              </div>
            )}
          </div>
        </Form>
      </Modal>

      <Modal
        title="Xác nhận ngừng sử dụng thuốc"
        open={!!deactivatingMedicine}
        onCancel={() => setDeactivatingMedicine(null)}
        onOk={() =>
          deactivatingMedicine && handleToggleStatus(deactivatingMedicine, false)
        }
        okText="Xác nhận ngừng dùng"
        okButtonProps={{
          danger: true,
          size: 'large',
          style: { height: 42, minWidth: 140, borderRadius: 8, fontWeight: 600 },
        }}
        cancelText="Hủy bỏ"
        cancelButtonProps={{
          size: 'large',
          style: { height: 42, minWidth: 100, borderRadius: 8 },
        }}
      >
        <p>
          Bạn có chắc chắn muốn <strong>ngừng sử dụng</strong> thuốc{' '}
          <strong>{deactivatingMedicine?.medicineName}</strong> (Hoạt chất:{' '}
          <em>{deactivatingMedicine?.activeIngredient}</em>) không?
        </p>
        <p style={{ color: '#8c8c8c', fontSize: 13 }}>
          * Thuốc sẽ chuyển sang trạng thái <em>Ngừng dùng</em> và không thể chọn
          khi kê đơn mới, nhưng dữ liệu vẫn lưu vết trong lịch sử hệ thống.
        </p>
      </Modal>
    </div>
  )
}

export default MedicineCatalogPage
