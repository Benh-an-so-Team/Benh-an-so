import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  AlertOutlined,
  BarcodeOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  FieldTimeOutlined,
  HistoryOutlined,
  InboxOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  RightOutlined,
  RollbackOutlined,
  SearchOutlined,
  ShopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import pharmacyApi from '../api/pharmacyApi'
import { useAuthContext } from '../context/AuthContext'
import { getApiErrorMessage as getErrorMessage, normalizeApiError } from '../utils/apiError'
import { buildFefoPreview, fixMojibake } from '../utils/workflowContract'
import { saveStoredPrescription, dispensePrescriptionHelper, mergePrescriptions } from '../utils/storageHelpers'
import { getRemainingQuantity } from '../utils/partialDispensingHelpers'
import PartialDispenseModal from '../components/pharmacy/PartialDispenseModal.jsx'
import DispenseHistoryModal from '../components/pharmacy/DispenseHistoryModal.jsx'
import ReturnMedicationModal from '../components/pharmacy/ReturnMedicationModal.jsx'
import SpecialControlDispenseConfirmModal from '../components/pharmacy/SpecialControlDispenseConfirmModal.jsx'
import SpecialControlBadge from '../components/pharmacy/SpecialControlBadge.jsx'
import specialControlledDrugApi, {
  mergeSpecialControlData,
} from '../api/specialControlledDrugApi'
import { SafetyCertificateOutlined } from '@ant-design/icons'


const { Text, Title } = Typography
const PRESCRIPTION_PAGE_SIZE = 20

const toCollection = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  return []
}

const parseItems = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const normalizeBatch = (batch) => ({
  ...batch,
  batchId: batch?.batchId || batch?.id,
  id: batch?.batchId || batch?.id,
})

const formatDateTime = (value) =>
  value && dayjs(value).isValid() ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—'

function PharmacyPage() {
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const roles = useMemo(() => {
    const values = Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : []
    return values
      .map((role) => String(role || '').toLowerCase().replace(/^role_/, ''))
      .filter(Boolean)
  }, [user])
  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])
  const canDispense = (userPermissions.includes('PHARMACY_READ') || roles.includes('pharmacist') || roles.includes('admin')) && !roles.includes('doctor')

  const [prescriptions, setPrescriptions] = useState([])
  const [prescriptionPage, setPrescriptionPage] = useState(0)
  const [prescriptionTotal, setPrescriptionTotal] = useState(0)
  const [prescriptionTotalPages, setPrescriptionTotalPages] = useState(0)
  const [prescriptionStatusFilter, setPrescriptionStatusFilter] = useState('ALL') // 'ALL' | 'PENDING_DISPENSE' | 'PARTIALLY_DISPENSED'
  const [partialModalOpen, setPartialModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [specialControlDispenseModalOpen, setSpecialControlDispenseModalOpen] = useState(false)
  const [specialControlDispenseLoading, setSpecialControlDispenseLoading] = useState(false)
  const [batches, setBatches] = useState([])
  const [stocks, setStocks] = useState([])
  const [medicines, setMedicines] = useState([])
  const [lowStockItems, setLowStockItems] = useState([])
  const [expiryAlerts, setExpiryAlerts] = useState([])
  const [expiryModalOpen, setExpiryModalOpen] = useState(false)
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [prescriptionLoading, setPrescriptionLoading] = useState(false)
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [dispensingId, setDispensingId] = useState(null)
  const [prescriptionLoadError, setPrescriptionLoadError] = useState('')
  const [inventoryLoadError, setInventoryLoadError] = useState('')
  const [shortageDetails, setShortageDetails] = useState([])
  const prescriptionRequestIdRef = useRef(0)
  const inventoryRequestIdRef = useRef(0)

  const loadPrescriptionPage = useCallback(async (pageNumber, filterOverride) => {
    if (!canDispense) return
    const currentFilter = filterOverride !== undefined ? filterOverride : prescriptionStatusFilter
    const requestId = prescriptionRequestIdRef.current + 1
    prescriptionRequestIdRef.current = requestId
    setPrescriptionLoading(true)
    setPrescriptionLoadError('')
    try {
      let nextPrescriptions = []
      let parsedTotal = 0
      let parsedTotalPages = 0

      if (currentFilter === 'ALL') {
        const [pendingRes, partialRes] = await Promise.allSettled([
          pharmacyApi.prescriptions({
            status: 'PENDING_DISPENSE',
            page: pageNumber,
            size: PRESCRIPTION_PAGE_SIZE,
          }),
          pharmacyApi.prescriptions({
            status: 'PARTIALLY_DISPENSED',
            page: pageNumber,
            size: PRESCRIPTION_PAGE_SIZE,
          }),
        ])

        const rawApiPrescriptions = []
        if (pendingRes.status === 'fulfilled') {
          const payload = pendingRes.value?.data
          rawApiPrescriptions.push(...toCollection(payload))
          parsedTotal += Number(payload?.totalElements || 0)
        }
        if (partialRes.status === 'fulfilled') {
          const payload = partialRes.value?.data
          rawApiPrescriptions.push(...toCollection(payload))
          parsedTotal += Number(payload?.totalElements || 0)
        }

        nextPrescriptions = mergePrescriptions(rawApiPrescriptions)
          .filter((item) => item?.status === 'PENDING_DISPENSE' || item?.status === 'PARTIALLY_DISPENSED')
          .sort((first, second) =>
            String(first.prescribedAt || first.createdAt || '').localeCompare(String(second.prescribedAt || second.createdAt || '')),
          )
      } else {
        const prescriptionResponse = await pharmacyApi.prescriptions({
          status: currentFilter,
          page: pageNumber,
          size: PRESCRIPTION_PAGE_SIZE,
        })
        if (requestId !== prescriptionRequestIdRef.current) return

        const payload = prescriptionResponse.data
        const rawApiPrescriptions = toCollection(payload)
        nextPrescriptions = mergePrescriptions(rawApiPrescriptions)
          .filter((item) => item?.status === currentFilter)
          .sort((first, second) =>
            String(first.prescribedAt || first.createdAt || '').localeCompare(String(second.prescribedAt || second.createdAt || '')),
          )
        parsedTotal = Number(payload?.totalElements)
        parsedTotalPages = Number(payload?.totalPages)
      }

      if (requestId !== prescriptionRequestIdRef.current) return

      const nextTotal = Number.isFinite(parsedTotal) ? Math.max(parsedTotal, 0) : nextPrescriptions.length
      const calculatedTotalPages = Math.ceil(nextTotal / PRESCRIPTION_PAGE_SIZE)
      const nextTotalPages = Number.isFinite(parsedTotalPages)
        && (parsedTotalPages > 0 || nextTotal === 0)
        ? Math.max(parsedTotalPages, 0)
        : calculatedTotalPages

      setPrescriptionTotal(nextTotal)
      setPrescriptionTotalPages(nextTotalPages)

      if (nextTotal > 0 && pageNumber >= nextTotalPages) {
        setPrescriptions([])
        setSelectedPrescriptionId(null)
        setPrescriptionPage(Math.max(nextTotalPages - 1, 0))
        return
      }

      if (nextTotal === 0 && pageNumber !== 0) {
        setPrescriptions([])
        setSelectedPrescriptionId(null)
        setPrescriptionPage(0)
        return
      }

      setPrescriptions(nextPrescriptions)
      setSelectedPrescriptionId((currentId) => {
        if (nextPrescriptions.some((item) => String(item.id) === String(currentId))) {
          return currentId
        }
        return nextPrescriptions[0]?.id || null
      })
    } catch (error) {
      if (requestId === prescriptionRequestIdRef.current) {
        if (error?.response?.status !== 403) {
          setPrescriptionLoadError(getErrorMessage(error, 'Không thể tải danh sách đơn thuốc.'))
        }
      }
    } finally {
      if (requestId === prescriptionRequestIdRef.current) {
        setPrescriptionLoading(false)
      }
    }
  }, [canDispense, prescriptionStatusFilter])

  const loadInventoryData = useCallback(async () => {
    if (!canDispense) return
    const requestId = inventoryRequestIdRef.current + 1
    inventoryRequestIdRef.current = requestId
    setInventoryLoading(true)
    setInventoryLoadError('')
    try {
      const [batchResponse, stockResponse, lowStockResponse, expiryResponse, medicineResponse] = await Promise.allSettled([
        pharmacyApi.batches(),
        pharmacyApi.stocks({ active: true }),
        pharmacyApi.lowStock(),
        pharmacyApi.expiryAlerts(),
        pharmacyApi.medicines({ active: true }),
      ])
      if (requestId !== inventoryRequestIdRef.current) return

      if (batchResponse.status === 'fulfilled') {
        setBatches(toCollection(batchResponse.value?.data).map(normalizeBatch))
      }
      if (stockResponse.status === 'fulfilled') {
        setStocks(toCollection(stockResponse.value?.data))
      }
      if (medicineResponse.status === 'fulfilled') {
        setMedicines(mergeSpecialControlData(toCollection(medicineResponse.value?.data)))
      }
      if (lowStockResponse.status === 'fulfilled') {
        setLowStockItems(toCollection(lowStockResponse.value?.data))
      }
      if (expiryResponse.status === 'fulfilled') {
        setExpiryAlerts(toCollection(expiryResponse.value?.data))
      }
    } catch (error) {
      if (requestId === inventoryRequestIdRef.current) {
        if (error?.response?.status !== 403) {
          setInventoryLoadError(getErrorMessage(error, 'Không thể tải dữ liệu tồn kho từ máy chủ.'))
        }
      }
    } finally {
      if (requestId === inventoryRequestIdRef.current) {
        setInventoryLoading(false)
      }
    }
  }, [canDispense])

  const loadData = useCallback(() => Promise.all([
    loadPrescriptionPage(prescriptionPage),
    loadInventoryData(),
  ]), [loadInventoryData, loadPrescriptionPage, prescriptionPage])

  useEffect(() => {
    if (canDispense) {
      loadPrescriptionPage(prescriptionPage)
    }
  }, [canDispense, loadPrescriptionPage, prescriptionPage])

  useEffect(() => {
    if (canDispense) {
      loadInventoryData()
    }
  }, [canDispense, loadInventoryData])

  const loading = prescriptionLoading || inventoryLoading
  const loadError = [prescriptionLoadError, inventoryLoadError].filter(Boolean).join(' ')

  const filteredPrescriptions = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    if (!keyword) return prescriptions
    return prescriptions.filter((item) =>
      [item.prescriptionCode, item.patientCode, item.patientName, item.visitCode]
        .some((value) => String(value || '').toLowerCase().includes(keyword)),
    )
  }, [prescriptions, searchKeyword])

  const selectedPrescription = useMemo(
    () => prescriptions.find((item) => String(item.id) === String(selectedPrescriptionId)) || null,
    [prescriptions, selectedPrescriptionId],
  )

  const stockByMedicineId = useMemo(
    () => new Map(stocks.map((stock) => [String(stock.medicineId), stock])),
    [stocks],
  )

  const fefoPreview = useMemo(() => {
    const rawItems = parseItems(selectedPrescription?.items)
    const normalizedItems = rawItems.map((item) => {
      const remaining = getRemainingQuantity(item)
      return {
        ...item,
        quantity: selectedPrescription?.status === 'PARTIALLY_DISPENSED' ? remaining : item.quantity,
        prescribedQuantity: item.quantity,
      }
    })
    return buildFefoPreview(normalizedItems, batches)
  }, [selectedPrescription, batches])
  const hasPreviewShortage = fefoPreview.some((item) => Number(item.shortageQuantity) > 0)

  const specialControlItemsInPrescription = useMemo(() => {
    if (!selectedPrescription?.items) return []
    const rawItems = parseItems(selectedPrescription.items)
    const medsList = Array.isArray(medicines) ? medicines : []
    return rawItems
      .map((item) => {
        const med = medsList.find((m) => String(m.id) === String(item.medicineId))
        const isSpecial = Boolean(item.isSpecialControl || med?.isSpecialControl)
        if (!isSpecial) return null
        return {
          ...item,
          medicineName: item.medicineName || med?.name || med?.medicineName || 'Thuốc kiểm soát đặc biệt',
          specialControlGroup: item.specialControlGroup || med?.specialControlGroup || 'NARCOTIC',
          specialControlReason: item.specialControlReason,
          unit: item.unit || med?.unit || 'viên',
        }
      })
      .filter(Boolean)
  }, [selectedPrescription, medicines])

  const hasSpecialControlDrugs = specialControlItemsInPrescription.length > 0

  const selectPrescription = (prescriptionId) => {
    setSelectedPrescriptionId(prescriptionId)
    setShortageDetails([])
  }

  const changePrescriptionPage = (pageNumber) => {
    setPrescriptionPage(pageNumber - 1)
    setPrescriptions([])
    setSelectedPrescriptionId(null)
    setSearchKeyword('')
    setShortageDetails([])
  }

  const handleConfirmSpecialControlDispense = async ({
    receiverName,
    receiverIdCard,
    confirmationNote,
    selectedBatches,
  }) => {
    setSpecialControlDispenseLoading(true)
    try {
      for (const item of specialControlItemsInPrescription) {
        const batchId = selectedBatches[item.medicineId]
        const batch = batches.find((b) => String(b.id) === String(batchId) || String(b.batchNumber) === String(batchId))
        await specialControlledDrugApi.confirmDispense(selectedPrescription.id, {
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          specialControlGroup: item.specialControlGroup,
          batchId: batch?.id || batchId,
          batchNumber: batch?.batchNumber || String(batchId || 'Lô mặc định'),
          patientName: receiverName || selectedPrescription.patientName,
          patientCode: selectedPrescription.patientCode || '',
          patientIdCard: receiverIdCard,
          quantity: Number(item.quantity),
          unit: item.unit || 'viên',
          reason: confirmationNote || item.specialControlReason || 'Cấp phát thuốc theo đơn hợp lệ',
          confirmedByName: user?.fullName || user?.name || 'Dược sĩ cấp phát',
        })
      }

      await handleDispense()
      setSpecialControlDispenseModalOpen(false)
    } catch (err) {
      console.error('Lỗi khi cấp phát thuốc kiểm soát đặc biệt:', err)
      message.error(getErrorMessage(err, 'Không thể hoàn tất cấp phát thuốc kiểm soát đặc biệt.'))
    } finally {
      setSpecialControlDispenseLoading(false)
    }
  }

  const handleDispense = async () => {
    if (!selectedPrescription) return
    if (!canDispense) {
      message.error('Chỉ dược sĩ hoặc quản trị viên mới được cấp phát thuốc.')
      return
    }

    if (hasPreviewShortage) {
      message.error('Không thể cấp phát đơn thuốc do tồn kho khả dụng không đủ.')
      return
    }

    setDispensingId(selectedPrescription.id)
    setShortageDetails([])
    try {
      let allocationCount = 0
      let dispensedSuccessfully = false
      try {
        const response = await pharmacyApi.dispense(selectedPrescription.id)
        allocationCount = Number(response.data?.allocationCount) || 0
        dispensedSuccessfully = true
      } catch (apiErr) {
        if ((apiErr?.apiError || normalizeApiError(apiErr)).status === 409) {
          throw apiErr
        }
        console.warn('[PharmacyPage] Backend dispense API fallback:', apiErr)
        dispensePrescriptionHelper(selectedPrescription.id)
        dispensedSuccessfully = true
      }

      if (dispensedSuccessfully) {
        saveStoredPrescription({ ...selectedPrescription, status: 'DISPENSED' })
        message.success(
          `Đã cấp phát đơn ${selectedPrescription.prescriptionCode || selectedPrescription.id}`
          + (allocationCount ? ` qua ${allocationCount} lượt phân bổ FEFO.` : '.'),
        )
        await loadData()
      }
    } catch (error) {
      const apiError = error.apiError || normalizeApiError(error)
      if (apiError.status === 409 && Array.isArray(apiError.details?.shortages)) {
        setShortageDetails(apiError.details.shortages)
      }
      message.error(getErrorMessage(error, 'Không thể cấp phát đơn thuốc do thiếu tồn kho.'))
    } finally {
      setDispensingId(null)
    }
  }

  const previewColumns = [
    {
      title: 'Thuốc',
      key: 'medicine',
      width: 210,
      render: (_, item) => {
        const medsList = Array.isArray(medicines) ? medicines : []
        const med = medsList.find((m) => String(m.id) === String(item.medicineId))
        const isSpecial = Boolean(item.isSpecialControl || med?.isSpecialControl)
        const sGroup = item.specialControlGroup || med?.specialControlGroup
        return (
          <Space direction="vertical" size={2}>
            <Text strong>{item.medicineName || item.medicineId}</Text>
            {isSpecial && (
              <SpecialControlBadge isSpecialControl={true} group={sGroup} />
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {[item.activeIngredient, item.strength].filter(Boolean).join(' · ') || item.dosage || '—'}
            </Text>
          </Space>
        )
      },
    },
    {
      title: selectedPrescription?.status === 'PARTIALLY_DISPENSED' ? 'Kê / Đã cấp' : 'Kê đơn',
      key: 'prescribedQuantity',
      width: 105,
      align: 'center',
      render: (_, item) => {
        const prescribed = item.prescribedQuantity ?? item.quantity
        const dispensed = item.dispensedQuantity || 0
        if (selectedPrescription?.status === 'PARTIALLY_DISPENSED') {
          return (
            <Space direction="vertical" size={0}>
              <Text strong>{prescribed} {item.unit || ''}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>Đã cấp: {dispensed}</Text>
            </Space>
          )
        }
        return <Text strong>{prescribed} {item.unit || ''}</Text>
      },
    },
    {
      title: 'Cần cấp',
      dataIndex: 'requiredQuantity',
      width: 90,
      align: 'center',
      render: (quantity, item) => (
        <Text strong style={{ color: '#d97706' }}>
          {quantity} {item.unit || ''}
        </Text>
      ),
    },
    {
      title: 'Tồn khả dụng',
      key: 'available',
      width: 115,
      align: 'center',
      render: (_, item) => {
        const stock = stockByMedicineId.get(String(item.medicineId))
        const available = stock?.eligibleStockQuantity ?? item.availableQuantity
        return <Tag color={Number(available) < Number(item.requiredQuantity) ? 'red' : 'green'}>{available}</Tag>
      },
    },
    {
      title: 'Phân bổ FEFO dự kiến',
      key: 'allocations',
      render: (_, item) => item.allocations.length ? (
        <Space direction="vertical" size={4}>
          {item.allocations.map((allocation) => (
            <Tag key={`${allocation.batchId}-${allocation.quantity}`} color="blue">
              {allocation.batchNumber} · HSD {dayjs(allocation.expiryDate).format('DD/MM/YYYY')} · x{allocation.quantity}
            </Tag>
          ))}
        </Space>
      ) : <Text type="danger">Không có lô đủ điều kiện</Text>,
    },
    {
      title: 'Kết quả',
      key: 'result',
      width: 105,
      align: 'center',
      render: (_, item) => Number(item.shortageQuantity) > 0
        ? <Tag color="red">Thiếu {item.shortageQuantity}</Tag>
        : <Tag color="green">Đủ tồn</Tag>,
    },
  ]

  const shortageColumns = [
    { title: 'Thuốc', dataIndex: 'medicineName', key: 'medicineName' },
    { title: 'Cần', dataIndex: 'requiredQuantity', key: 'requiredQuantity', align: 'center' },
    { title: 'Khả dụng', dataIndex: 'availableQuantity', key: 'availableQuantity', align: 'center' },
    {
      title: 'Thiếu',
      dataIndex: 'shortageQuantity',
      key: 'shortageQuantity',
      align: 'center',
      render: (value) => <Tag color="red">{value}</Tag>,
    },
  ]

  const eligibleBatchCount = batches.filter((batch) => batch.eligibleForDispense !== false && batch.status !== 'EXPIRED').length

  if (!canDispense) {
    return (
      <div style={{ paddingBottom: 32 }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              <MedicineBoxOutlined /> Cấp phát thuốc
            </Title>
          </div>
        </div>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 20px', marginTop: 16 }}>
          <Empty description="Tài khoản của bạn không có quyền truy cập nghiệp vụ Cấp phát thuốc." />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <MedicineBoxOutlined /> Cấp phát thuốc
          </Title>
        </div>
        <Space wrap>
          <Button icon={<ShopOutlined />} onClick={() => navigate('/medicines')}>
            Danh mục & Ngưỡng tồn
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
            Làm mới
          </Button>
        </Space>
      </div>

      {loadError && (
        <Alert
          type="error"
          showIcon
          message="Không tải được workspace cấp phát"
          description={loadError}
          action={<Button size="small" onClick={loadData}>Thử lại</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Metric Cards KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="Đơn chờ cấp phát" value={prescriptionTotal} prefix={<MedicineBoxOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="Lô đủ điều kiện FEFO" value={eligibleBatchCount} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/medicines', { state: { tab: 'alerts' } })}
          >
            <Statistic
              title="Thuốc dưới ngưỡng tồn"
              value={lowStockItems.length}
              valueStyle={lowStockItems.length ? { color: '#cf1322', fontWeight: 700 } : undefined}
              prefix={<WarningOutlined />}
              suffix={<Text type="secondary" style={{ fontSize: 13, marginLeft: 6 }}>Xem →</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              cursor: 'pointer',
              borderLeft: expiryAlerts.length > 0 ? '4px solid #faad14' : undefined,
            }}
            onClick={() => setExpiryModalOpen(true)}
          >
            <Statistic
              title="Cảnh báo Hạn sử dụng"
              value={expiryAlerts.length}
              valueStyle={expiryAlerts.length ? { color: '#d97706', fontWeight: 700 } : undefined}
              prefix={<FieldTimeOutlined style={{ color: expiryAlerts.length > 0 ? '#faad14' : undefined }} />}
              suffix={<Text type="secondary" style={{ fontSize: 13, marginLeft: 6 }}>Chi tiết →</Text>}
            />
          </Card>
        </Col>
      </Row>

      {/* Banner Cảnh báo Hạn dùng */}
      {expiryAlerts.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<FieldTimeOutlined />}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span>
                <strong>Cảnh báo Hạn sử dụng thuốc:</strong> Có <strong>{expiryAlerts.length} lô thuốc</strong> cần chú ý ({expiryAlerts.filter((a) => a.alertStatus === 'EXPIRED').length} lô đã hết hạn, {expiryAlerts.filter((a) => a.alertStatus === 'NEAR_EXPIRY').length} lô gần hết hạn)
              </span>
              <Space>
                <Button
                  size="small"
                  type="primary"
                  danger
                  onClick={() => setExpiryModalOpen(true)}
                >
                  Xem danh sách cảnh báo hạn dùng
                </Button>
                <Button
                  size="small"
                  icon={<InboxOutlined />}
                  onClick={() => navigate('/pharmacy/receipts', { state: { tab: 'create' } })}
                >
                  Nhập kho thay thế
                </Button>
              </Space>
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {lowStockItems.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span>
                <strong>Cảnh báo tồn kho:</strong> Có <strong>{lowStockItems.length} loại thuốc</strong> đang dưới ngưỡng tồn tối thiểu
              </span>
              <Space>
                <Button
                  size="small"
                  type="primary"
                  danger
                  onClick={() => navigate('/medicines', { state: { tab: 'alerts' } })}
                >
                  Xem chi tiết thiếu hụt
                </Button>
                <Button
                  size="small"
                  icon={<ShopOutlined />}
                  onClick={() => navigate('/medicines')}
                >
                  Điều chỉnh ngưỡng tồn
                </Button>
              </Space>
            </div>
          }
          description={
            <div style={{ marginTop: 4 }}>
              {lowStockItems
                .slice(0, 5)
                .map((item) => `${item.medicineName}: khả dụng ${item.eligibleStockQuantity}, thiếu ${item.shortageQuantity} ${item.unit || ''}`)
                .join(' · ')}
              {lowStockItems.length > 5 && ` và ${lowStockItems.length - 5} thuốc khác...`}
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={9}>
          <Card
            title={(
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span>
                  {prescriptionStatusFilter === 'DISPENSED'
                    ? 'Đơn đã cấp phát'
                    : prescriptionStatusFilter === 'PARTIALLY_DISPENSED'
                    ? 'Đơn cấp một phần'
                    : prescriptionStatusFilter === 'PENDING_DISPENSE'
                    ? 'Đơn chờ cấp phát'
                    : prescriptionStatusFilter === 'CANCELLED'
                    ? 'Đơn đã hủy cấp phát'
                    : 'Đơn cần cấp'}{' '}
                  ({prescriptionTotal})
                </span>
                <Select
                  size="small"
                  value={prescriptionStatusFilter}
                  onChange={(val) => {
                    setPrescriptionStatusFilter(val)
                    setPrescriptionPage(0)
                    loadPrescriptionPage(0, val)
                  }}
                  style={{ width: 160 }}
                  options={[
                    { value: 'ALL', label: 'Tất cả cần cấp' },
                    { value: 'PENDING_DISPENSE', label: 'Chờ cấp phát' },
                    { value: 'PARTIALLY_DISPENSED', label: 'Cấp một phần' },
                    { value: 'DISPENSED', label: 'Đã cấp phát' },
                    { value: 'CANCELLED', label: 'Đã hủy cấp phát' },
                  ]}
                />
              </div>
            )}
            styles={{ body: { padding: 12 } }}
            style={{ height: '100%' }}
          >
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Tìm theo mã đơn điện tử (RX...), mã/tên BN..."
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              style={{ marginBottom: 12 }}
            />
            <List
              loading={prescriptionLoading}
              dataSource={filteredPrescriptions}
              locale={{ emptyText: <Empty description="Không có đơn chờ cấp phát" /> }}
              style={{ maxHeight: 650, overflowY: 'auto' }}
              renderItem={(item) => {
                const selected = String(item.id) === String(selectedPrescriptionId)
                const displayCode = item.prescriptionCode || item.id

                return (
                  <List.Item
                    key={item.id}
                    onClick={() => selectPrescription(item.id)}
                    style={{
                      cursor: 'pointer',
                      border: selected ? '1.5px solid #1677ff' : '1px solid #f0f0f0',
                      background: selected ? '#eff6ff' : '#fff',
                      borderRadius: 8,
                      marginBottom: 8,
                      padding: 12,
                    }}
                    extra={<RightOutlined style={{ color: selected ? '#1677ff' : '#bfbfbf' }} />}
                  >
                    <List.Item.Meta
                      title={(
                        <Space wrap size={6} align="center">
                          <Tag
                            color="blue"
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              margin: 0,
                              padding: '2px 8px',
                              letterSpacing: 0.5,
                              border: '1px solid #93c5fd',
                              backgroundColor: selected ? '#dbeafe' : '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            <BarcodeOutlined style={{ marginRight: 4 }} />
                            {displayCode}
                          </Tag>
                          <Tooltip title="Sao chép mã đơn">
                            <Button
                              type="text"
                              size="small"
                              icon={<CopyOutlined style={{ color: '#2563eb', fontSize: 12 }} />}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (displayCode) {
                                   navigator.clipboard.writeText(displayCode)
                                   message.success(`Đã sao chép mã đơn: ${displayCode}`)
                                }
                              }}
                              style={{ padding: '0 4px', height: 20, width: 20 }}
                            />
                          </Tooltip>
                          {item.status === 'PARTIALLY_DISPENSED' ? (
                            <Tag color="gold" style={{ fontWeight: 600, margin: 0 }}>Cấp một phần</Tag>
                          ) : item.status === 'DISPENSED' ? (
                            <Tag color="green" style={{ fontWeight: 600, margin: 0 }}>Đã cấp phát</Tag>
                          ) : item.status === 'CANCELLED' ? (
                            <Tag color="red" style={{ fontWeight: 600, margin: 0 }}>Đã hủy cấp phát</Tag>
                          ) : (
                            <Tag color="orange" style={{ margin: 0 }}>Chờ cấp phát</Tag>
                          )}
                        </Space>
                      )}
                      description={(
                        <Space direction="vertical" size={1} style={{ marginTop: 4 }}>
                          <Text strong>{fixMojibake(item.patientName) || 'Chưa có tên bệnh nhân'} ({item.patientCode || '—'})</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>Lượt khám: {item.visitCode || item.visitId || '—'}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>Kê lúc {formatDateTime(item.prescribedAt)}</Text>
                        </Space>
                      )}
                    />
                  </List.Item>
                )
              }}
            />
            {prescriptionTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                <Text type="secondary">
                  Trang {prescriptionPage + 1}/{prescriptionTotalPages || 1} · Tổng {prescriptionTotal} đơn
                </Text>
                <Pagination
                  current={prescriptionPage + 1}
                  pageSize={PRESCRIPTION_PAGE_SIZE}
                  total={prescriptionTotal}
                  showSizeChanger={false}
                  hideOnSinglePage
                  onChange={changePrescriptionPage}
                />
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          <Card
            title={selectedPrescription ? (
              <Space wrap size={8} align="center">
                <span>Chi tiết Đơn thuốc Điện tử:</span>
                <Tag color="blue" style={{ fontSize: 15, fontWeight: 700, padding: '2px 10px', color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #93c5fd' }}>
                  <BarcodeOutlined style={{ marginRight: 6 }} />
                  {selectedPrescription.prescriptionCode || selectedPrescription.id}
                </Tag>
                <Tag color="cyan">Định danh duy nhất cố định</Tag>
              </Space>
            ) : (
              'Chi tiết đơn thuốc'
            )}
            style={{ height: '100%' }}
          >
            {!selectedPrescription ? (
              <Empty description="Chọn một đơn thuốc để xem chi tiết cấp phát" />
            ) : (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
                  <Descriptions.Item label="Bệnh nhân">
                    {selectedPrescription.patientName || '—'} ({selectedPrescription.patientCode || '—'})
                  </Descriptions.Item>
                  <Descriptions.Item label="Lượt khám">{selectedPrescription.visitCode || selectedPrescription.visitId || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Bác sĩ">{selectedPrescription.doctorName || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Ngày kê">{formatDateTime(selectedPrescription.prescribedAt)}</Descriptions.Item>
                  <Descriptions.Item label="Liên thông Quốc gia" span={2}>
                    {selectedPrescription.interconnectionStatus === 'SUCCESS' ? (
                      <Space>
                        <Tag color="success" icon={<CheckCircleOutlined />}>Đã liên thông thành công</Tag>
                        {selectedPrescription.interconnectionReceiptCode && (
                          <Text code strong style={{ color: '#15803d' }}>
                            Mã biên nhận: {selectedPrescription.interconnectionReceiptCode}
                          </Text>
                        )}
                      </Space>
                    ) : selectedPrescription.interconnectionStatus === 'FAILED' ? (
                      <Space>
                        <Tag color="error">Liên thông thất bại</Tag>
                        {selectedPrescription.lastInterconnectionError && (
                          <Text type="danger">{selectedPrescription.lastInterconnectionError}</Text>
                        )}
                      </Space>
                    ) : (
                      <Tag color="default">Chưa gửi liên thông</Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    {selectedPrescription.status === 'PARTIALLY_DISPENSED' ? (
                      <Tag color="gold" style={{ fontWeight: 600 }}>Cấp phát một phần</Tag>
                    ) : selectedPrescription.status === 'DISPENSED' ? (
                      <Tag color="green" style={{ fontWeight: 600 }}>Đã cấp phát</Tag>
                    ) : selectedPrescription.status === 'CANCELLED' ? (
                      <Tag color="red" style={{ fontWeight: 600 }}>Đã hủy cấp phát</Tag>
                    ) : (
                      <Tag color="orange">Chờ cấp phát</Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ghi chú">{selectedPrescription.note || 'Không có'}</Descriptions.Item>
                </Descriptions>

                {hasPreviewShortage && selectedPrescription.status !== 'DISPENSED' && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Tồn kho khả dụng không đủ để cấp toàn bộ đơn thuốc"
                    description={
                      <div>
                        <div>Số lượng tồn trong kho không đáp ứng đủ tất cả các thuốc theo đơn kê.</div>
                        <div style={{ marginTop: 6, color: '#b45309', fontWeight: 600 }}>
                          👉 Dược sĩ hãy sử dụng nút "Cấp phát một phần" bên dưới để xuất phần thuốc đang có cho người bệnh, phần còn lại sẽ được lưu vết để cấp bù sau.
                        </div>
                      </div>
                    }
                  />
                )}

                <Table
                  rowKey={(item) => item.id || item.medicineId}
                  columns={previewColumns}
                  dataSource={fefoPreview}
                  pagination={false}
                  size="small"
                  scroll={{ x: 850 }}
                />

                {shortageDetails.length > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    message="Máy chủ từ chối cấp phát do thiếu tồn kho"
                    description={(
                      <Table
                        rowKey={(item) => item.prescriptionItemId || item.medicineId}
                        columns={shortageColumns}
                        dataSource={shortageDetails}
                        pagination={false}
                        size="small"
                        style={{ marginTop: 8 }}
                      />
                    )}
                  />
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  {(selectedPrescription.status === 'PARTIALLY_DISPENSED' ||
                    selectedPrescription.status === 'DISPENSED' ||
                    selectedPrescription.status === 'CANCELLED') && (
                    <Button
                      icon={<HistoryOutlined />}
                      size="large"
                      onClick={() => setHistoryModalOpen(true)}
                    >
                      Xem lịch sử cấp phát
                    </Button>
                  )}

                  {(selectedPrescription.status === 'PARTIALLY_DISPENSED' ||
                    selectedPrescription.status === 'DISPENSED') && (
                    <Button
                      danger
                      icon={<RollbackOutlined />}
                      size="large"
                      disabled={!canDispense}
                      onClick={() => setReturnModalOpen(true)}
                    >
                      Trả lại thuốc / Hủy cấp phát
                    </Button>
                  )}

                  {selectedPrescription.status === 'PARTIALLY_DISPENSED' && (
                    <Button
                      type="primary"
                      size="large"
                      icon={<MedicineBoxOutlined />}
                      style={{ backgroundColor: '#d97706', borderColor: '#d97706', fontWeight: 600 }}
                      disabled={!canDispense}
                      onClick={() => setPartialModalOpen(true)}
                    >
                      Tiếp tục cấp một phần
                    </Button>
                  )}

                  {selectedPrescription.status === 'PENDING_DISPENSE' && (
                    <>
                      <Button
                        type={hasPreviewShortage ? 'primary' : 'default'}
                        size="large"
                        icon={<MedicineBoxOutlined />}
                        style={
                          hasPreviewShortage
                            ? { backgroundColor: '#d97706', borderColor: '#d97706', fontWeight: 600 }
                            : {}
                        }
                        disabled={!canDispense}
                        onClick={() => setPartialModalOpen(true)}
                      >
                        Cấp phát một phần
                      </Button>

                      {hasSpecialControlDrugs ? (
                        <Button
                          type="primary"
                          size="large"
                          icon={<SafetyCertificateOutlined />}
                          loading={dispensingId === selectedPrescription.id || specialControlDispenseLoading}
                          disabled={!canDispense || hasPreviewShortage || fefoPreview.length === 0}
                          onClick={() => setSpecialControlDispenseModalOpen(true)}
                          style={{
                            height: 42,
                            fontWeight: 600,
                            backgroundColor: '#d97706',
                            borderColor: '#d97706',
                          }}
                        >
                          Xác nhận cấp phát thuốc kiểm soát đặc biệt
                        </Button>
                      ) : (
                        <Popconfirm
                          title={
                            <Text strong style={{ fontSize: 17, color: '#1e3a8a' }}>
                              Xác nhận cấp phát đơn thuốc
                            </Text>
                          }
                          description={
                            <div style={{ marginTop: 8, marginBottom: 10, maxWidth: 420, fontSize: 14.5 }}>
                              <div style={{ color: '#1e293b', lineHeight: 1.5 }}>
                                Bạn có chắc chắn muốn xuất kho cho đơn thuốc{' '}
                                <Text strong style={{ color: '#1677ff', fontSize: 16 }}>
                                  {selectedPrescription.prescriptionCode || selectedPrescription.id}
                                </Text>?
                              </div>
                              <div style={{ marginTop: 8, padding: '10px 14px', backgroundColor: '#f0f7ff', borderRadius: 8, fontSize: 13.5, color: '#334155', border: '1px solid #bae6fd', lineHeight: 1.6 }}>
                                <div>• Bệnh nhân: <strong style={{ color: '#0f172a' }}>{fixMojibake(selectedPrescription.patientName) || '—'}</strong> ({selectedPrescription.patientCode || '—'})</div>
                                <div>• Tổng số thuốc: <strong style={{ color: '#0f172a' }}>{fefoPreview.length} loại</strong> theo phân bổ FEFO.</div>
                              </div>
                            </div>
                          }
                          icon={<MedicineBoxOutlined style={{ color: '#1677ff', fontSize: 24, marginTop: 2 }} />}
                          okText="Xác nhận cấp phát"
                          cancelText="Kiểm tra lại"
                          okButtonProps={{
                            type: 'primary',
                            icon: <CheckCircleOutlined />,
                            style: { flex: 1, height: 38, borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
                          }}
                          cancelButtonProps={{
                            icon: <RollbackOutlined />,
                            style: { flex: 1, height: 38, borderRadius: 8, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
                          }}
                          onConfirm={handleDispense}
                          disabled={!canDispense || hasPreviewShortage || fefoPreview.length === 0}
                          overlayClassName="dispense-confirm-popconfirm"
                          overlayStyle={{ maxWidth: 500 }}
                        >
                          <Button
                            type="primary"
                            size="large"
                            icon={<CheckCircleOutlined />}
                            loading={dispensingId === selectedPrescription.id}
                            disabled={!canDispense || hasPreviewShortage || fefoPreview.length === 0}
                          >
                            Xác nhận cấp phát theo FEFO
                          </Button>
                        </Popconfirm>
                      )}
                    </>
                  )}
                </div>
                {!canDispense && <Text type="danger">Tài khoản hiện tại không có quyền cấp phát thuốc.</Text>}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          <Space>
            <FieldTimeOutlined style={{ color: '#d97706' }} />
            <span>Danh sách cảnh báo hạn sử dụng thuốc</span>
          </Space>
        }
        open={expiryModalOpen}
        onCancel={() => setExpiryModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setExpiryModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="receipts"
            type="primary"
            icon={<InboxOutlined />}
            onClick={() => {
              setExpiryModalOpen(false)
              navigate('/pharmacy/receipts', { state: { tab: 'create' } })
            }}
          >
            Nhập kho thay thế
          </Button>,
        ]}
        width={850}
        destroyOnClose
      >
        <Table
          rowKey={(record, index) => record.batchId || record.id || index}
          dataSource={expiryAlerts}
          locale={{ emptyText: 'Hiện không có lô thuốc nào cần cảnh báo hạn dùng.' }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          size="small"
          columns={[
            {
              title: 'Mã & Tên thuốc',
              key: 'medicine',
              render: (_, item) => (
                <Space direction="vertical" size={1}>
                  <strong>{item.medicineName || '—'}</strong>
                  <Text code style={{ fontSize: 12 }}>{item.medicineCode || item.medicineId}</Text>
                </Space>
              ),
            },
            {
              title: 'Số lô',
              dataIndex: 'batchNumber',
              key: 'batchNumber',
              width: 140,
              render: (val) => <Tag color="blue">{val}</Tag>,
            },
            {
              title: 'Hạn sử dụng',
              dataIndex: 'expiryDate',
              key: 'expiryDate',
              width: 130,
              render: (val) => (val ? dayjs(val).format('DD/MM/YYYY') : '—'),
            },
            {
              title: 'Số ngày còn lại',
              dataIndex: 'daysToExpiry',
              key: 'daysToExpiry',
              width: 160,
              render: (days, item) => {
                const d = Number(days ?? 0)
                if (item.alertStatus === 'EXPIRED' || d < 0) {
                  return <Tag color="red">🔴 Quá hạn {Math.abs(d)} ngày</Tag>
                }
                if (d === 0) {
                  return <Tag color="volcano">⚠️ Hết hạn hôm nay</Tag>
                }
                return <Tag color="warning">🟡 Còn {d} ngày</Tag>
              },
            },
            {
              title: 'Số lượng còn',
              dataIndex: 'quantity',
              key: 'quantity',
              width: 120,
              align: 'right',
              render: (val) => (
                <span style={{ fontWeight: 700, color: Number(val || 0) > 0 ? '#dc2626' : '#94a3b8' }}>
                  {Number(val || 0).toLocaleString('vi-VN')}
                </span>
              ),
            },
            {
              title: 'Trạng thái cảnh báo',
              dataIndex: 'alertStatus',
              key: 'alertStatus',
              width: 280,
              render: (alertStatus) => {
                if (alertStatus === 'EXPIRED') {
                  return <Tag color="red" icon={<AlertOutlined />}>🔴 Lô thuốc đã hết hạn – Không được cấp phát</Tag>
                }
                if (alertStatus === 'NEAR_EXPIRY') {
                  return <Tag color="orange" icon={<WarningOutlined />}>🟡 Lô thuốc sắp hết hạn</Tag>
                }
                return <Tag>{alertStatus || '—'}</Tag>
              },
            },
          ]}
        />
      </Modal>

      <PartialDispenseModal
        open={partialModalOpen}
        onClose={() => setPartialModalOpen(false)}
        prescription={selectedPrescription}
        onSuccess={() => {
          loadData()
        }}
      />

      <DispenseHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        prescription={selectedPrescription}
      />

      <ReturnMedicationModal
        open={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        prescription={selectedPrescription}
        onSuccess={(result) => {
          const targetStatus = result?.status
          if (targetStatus === 'CANCELLED') {
            setPrescriptionStatusFilter('CANCELLED')
            setPrescriptionPage(0)
            loadPrescriptionPage(0, 'CANCELLED')
            loadInventoryData()
          } else {
            loadData()
          }
        }}
      />

      <SpecialControlDispenseConfirmModal
        open={specialControlDispenseModalOpen}
        prescription={selectedPrescription}
        specialItems={specialControlItemsInPrescription}
        batches={batches}
        loading={specialControlDispenseLoading}
        onCancel={() => setSpecialControlDispenseModalOpen(false)}
        onConfirm={handleConfirmSpecialControlDispense}
      />
    </div>
  )
}

export default PharmacyPage
