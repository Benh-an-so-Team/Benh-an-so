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
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  CalculatorOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import medicationProcurementApi from '../api/medicationProcurementApi.js'
import AddMedicineToProcurementModal from '../components/procurement/AddMedicineToProcurementModal.jsx'
import ProcurementPlanDetailModal from '../components/procurement/ProcurementPlanDetailModal.jsx'
import RejectProcurementModal from '../components/procurement/RejectProcurementModal.jsx'
import { useAuthContext } from '../context/AuthContext.jsx'
import {
  canApproveOrRejectPlan,
  formatDate,
  formatDateTime,
  getProcurementStatusMeta,
  getSuggestionFormulaText,
  hasEnoughConsumptionHistory,
  validateProcurementPlanForm,
} from '../utils/medicationProcurementHelpers.js'
import './medicationProcurement.css'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker
const { TextArea } = Input

export default function MedicationProcurementPage() {
  const { user } = useAuthContext()

  // Phân quyền vai trò người dùng
  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) =>
      String(r || '').toLowerCase().replace(/^role_/, '')
    )
  }, [user])

  const isPharmacist = userRoles.includes('pharmacist')
  const isManagerOrAdmin = userRoles.includes('manager') || userRoles.includes('clinic_manager') || userRoles.includes('admin')
  const currentUserId = user?.id || user?.userId

  // Tab đang kích hoạt: Quản lý ưu tiên xem tab danh sách, Dược sĩ ưu tiên xem tab lập phiếu
  const [activeTab, setActiveTab] = useState(isManagerOrAdmin && !isPharmacist ? 'plans' : 'create')

  // ==================== TAB 1: LẬP PHIẾU DỰ TRÙ (DƯỢC SĨ) ====================
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [onlyBelowThreshold, setOnlyBelowThreshold] = useState(true)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [submittingPlan, setSubmittingPlan] = useState(false)

  // Danh sách dòng thuốc trong phiếu dự trù hiện tại
  const [procurementItems, setProcurementItems] = useState([])
  const [planGeneralNote, setPlanGeneralNote] = useState('')

  // Modal thêm thuốc khác vào phiếu
  const [addMedicineModalOpen, setAddMedicineModalOpen] = useState(false)

  // Tải danh sách gợi ý thuốc cần mua
  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true)
    try {
      const from = dateRange[0]?.format('YYYY-MM-DD')
      const to = dateRange[1]?.format('YYYY-MM-DD')
      const res = await medicationProcurementApi.getSuggestions({
        from,
        to,
        onlyBelowThreshold,
      })

      const rawItems = res.data?.items || []
      // Ánh xạ thành danh sách dòng thuốc cho phiếu dự trù
      const mapped = rawItems.map((item) => {
        const hasHistory = hasEnoughConsumptionHistory(item)
        const suggestedQty = item.suggestedQuantity
        return {
          medicineId: item.medicineId,
          medicineCode: item.medicineCode,
          medicineName: item.medicineName,
          unit: item.unit || 'Viên',
          currentStock: item.currentStock,
          eligibleStock: item.eligibleStock,
          minStockThreshold: item.minStockThreshold,
          previousPeriodConsumption: item.previousPeriodConsumption,
          suggestedQuantity: suggestedQty,
          // Ràng buộc nghiệp vụ: Nếu thuốc mới chưa đủ dữ liệu tiêu thụ, ô đề xuất để trống (null) bắt buộc dược sĩ tự nhập
          proposedQuantity: hasHistory ? (suggestedQty > 0 ? suggestedQty : 1) : null,
          note: '',
          hasConsumptionHistory: hasHistory,
          isManualAdded: false,
        }
      })

      setProcurementItems(mapped)
    } catch (err) {
      message.error('Không thể tải dữ liệu gợi ý mua thuốc. Vui lòng thử lại sau.')
      setProcurementItems([])
    } finally {
      setLoadingSuggestions(false)
    }
  }, [dateRange, onlyBelowThreshold])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  // Cập nhật số lượng đề xuất của một dòng thuốc
  const handleUpdateItemProposedQuantity = (medicineId, value) => {
    setProcurementItems((prev) =>
      prev.map((item) => {
        if (item.medicineId === medicineId) {
          return { ...item, proposedQuantity: value }
        }
        return item
      })
    )
  }

  // Cập nhật ghi chú của một dòng thuốc
  const handleUpdateItemNote = (medicineId, noteVal) => {
    setProcurementItems((prev) =>
      prev.map((item) => {
        if (item.medicineId === medicineId) {
          return { ...item, note: noteVal }
        }
        return item
      })
    )
  }

  // Xóa một dòng thuốc khỏi phiếu
  const handleRemoveItem = (medicineId) => {
    setProcurementItems((prev) => prev.filter((item) => item.medicineId !== medicineId))
    message.info('Đã xóa thuốc khỏi danh sách dự trù.')
  }

  // Thêm các thuốc được chọn từ Modal vào danh sách
  const handleAddMedicines = (newItems) => {
    setProcurementItems((prev) => [...prev, ...newItems])
  }

  // Gửi hoặc Lưu nháp phiếu dự trù
  const handleSubmitPlan = async (submitImmediately = true) => {
    const validation = validateProcurementPlanForm(procurementItems, planGeneralNote)
    if (!validation.valid) {
      validation.errors.forEach((err) => message.error(err))
      return
    }

    setSubmittingPlan(true)
    try {
      const payload = {
        periodStartDate: dateRange[0]?.format('YYYY-MM-DD'),
        periodEndDate: dateRange[1]?.format('YYYY-MM-DD'),
        note: planGeneralNote.trim() || undefined,
        submitImmediately,
        items: procurementItems.map((item) => ({
          medicineId: item.medicineId,
          currentStock: item.currentStock,
          minStockThreshold: item.minStockThreshold,
          previousPeriodConsumption: item.previousPeriodConsumption != null ? item.previousPeriodConsumption : 0,
          suggestedQuantity: item.suggestedQuantity != null ? item.suggestedQuantity : 0,
          proposedQuantity: Number(item.proposedQuantity),
          note: item.note ? item.note.trim() : undefined,
        })),
      }

      const res = await medicationProcurementApi.create(payload)
      const createdPlan = res.data

      if (submitImmediately) {
        message.success(
          `Phiếu dự trù ${createdPlan.planCode} đã được gửi thành công! Chuyển sang trạng thái 'Chờ duyệt'.`
        )
      } else {
        message.success(`Phiếu dự trù ${createdPlan.planCode} đã được lưu dưới dạng 'Bản nháp'.`)
      }

      // Xóa form và tải lại danh sách phiếu
      setPlanGeneralNote('')
      fetchSuggestions()
      fetchPlans()
      setActiveTab('plans')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể tạo phiếu dự trù mua thuốc. Vui lòng thử lại.'
      message.error(msg)
    } finally {
      setSubmittingPlan(false)
    }
  }

  // ==================== TAB 2: DANH SÁCH & PHÊ DUYỆT PHIẾU DỰ TRÙ ====================
  const [plans, setPlans] = useState([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [planSearchKeyword, setPlanSearchKeyword] = useState('')

  // Modal xem chi tiết phiếu
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState(null)

  // Modal từ chối phiếu nhanh
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectPlanTarget, setRejectPlanTarget] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true)
    try {
      const params = { size: 50 }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter
      }
      const res = await medicationProcurementApi.list(params)
      const list = res.data?.content || []
      setPlans(list)
    } catch (err) {
      message.error('Không thể tải danh sách phiếu dự trù.')
      setPlans([])
    } finally {
      setLoadingPlans(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  // Lọc danh sách phiếu theo từ khóa tìm kiếm
  const filteredPlans = useMemo(() => {
    if (!planSearchKeyword.trim()) return plans
    const kw = planSearchKeyword.trim().toLowerCase()
    return plans.filter((p) => {
      const code = (p.planCode || '').toLowerCase()
      return code.includes(kw)
    })
  }, [plans, planSearchKeyword])

  // Phê duyệt phiếu nhanh từ bảng danh sách
  const handleQuickApprove = async (plan) => {
    setActionLoading(true)
    try {
      await medicationProcurementApi.approve(plan.id, {
        note: 'Đồng ý phê duyệt phiếu dự trù thuốc',
      })
      message.success(`Đã phê duyệt phiếu ${plan.planCode} thành công!`)
      fetchPlans()
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể phê duyệt phiếu.'
      message.error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // Từ chối phiếu từ modal
  const handleConfirmReject = async (reason) => {
    if (!rejectPlanTarget?.id) return
    setActionLoading(true)
    try {
      await medicationProcurementApi.reject(rejectPlanTarget.id, { reason })
      message.success(`Đã từ chối phiếu ${rejectPlanTarget.planCode}!`)
      setRejectModalOpen(false)
      setRejectPlanTarget(null)
      fetchPlans()
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể từ chối phiếu.'
      message.error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // Tổng số lượng đề xuất trong bảng tạo phiếu
  const totalProposedQuantity = useMemo(() => {
    return procurementItems.reduce((sum, item) => sum + (Number(item.proposedQuantity) || 0), 0)
  }, [procurementItems])

  // Thống kê nhanh danh sách phiếu
  const pendingCount = useMemo(() => {
    return plans.filter((p) => p.status === 'PENDING_APPROVAL').length
  }, [plans])

  // ==================== CỘT BẢNG LẬP PHIẾU DỰ TRÙ ====================
  const suggestionColumns = [
    {
      title: 'Mã thuốc',
      dataIndex: 'medicineCode',
      key: 'medicineCode',
      width: 105,
      render: (code) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>
          {code || '—'}
        </span>
      ),
    },
    {
      title: 'Tên thuốc & Quy cách',
      dataIndex: 'medicineName',
      key: 'medicineName',
      render: (name, record) => (
        <div>
          <strong style={{ color: '#0f172a' }}>{name}</strong>
          {record.isManualAdded && (
            <Tag color="cyan" style={{ marginLeft: 6, fontSize: 11, borderRadius: 4 }}>
              Thêm chủ động
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'ĐVT',
      dataIndex: 'unit',
      key: 'unit',
      width: 75,
      render: (unit) => <Tag color="blue">{unit || 'Viên'}</Tag>,
    },
    {
      title: 'Tồn hiện tại',
      dataIndex: 'currentStock',
      key: 'currentStock',
      width: 105,
      align: 'right',
      render: (stock, record) => {
        const isBelow = stock < record.minStockThreshold
        return (
          <span className={isBelow ? 'procurement-below-stock' : 'procurement-normal-stock'}>
            {stock}
            {isBelow && (
              <Tooltip title="Đang dưới ngưỡng tồn tối thiểu">
                <WarningOutlined style={{ color: '#dc2626', marginLeft: 4 }} />
              </Tooltip>
            )}
          </span>
        )
      },
    },
    {
      title: 'Tồn tối thiểu',
      dataIndex: 'minStockThreshold',
      key: 'minStockThreshold',
      width: 105,
      align: 'right',
      render: (min) => <span style={{ color: '#64748b' }}>{min}</span>,
    },
    {
      title: 'Tiêu thụ kỳ trước',
      dataIndex: 'previousPeriodConsumption',
      key: 'previousPeriodConsumption',
      width: 135,
      align: 'right',
      render: (consumption, record) => {
        if (!record.hasConsumptionHistory || consumption === null || consumption === undefined) {
          return (
            <Tooltip title="Thuốc mới chưa có lịch sử cấp phát ở kỳ trước. Dược sĩ cần tự nhập số lượng đặt.">
              <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                Chưa đủ dữ liệu
              </Tag>
            </Tooltip>
          )
        }
        return <span style={{ fontWeight: 600, color: '#0f172a' }}>{consumption}</span>
      },
    },
    {
      title: (
        <span>
          Gợi ý mua{' '}
          <Tooltip title="Công thức: max(0, (Tiêu thụ kỳ trước + Tồn tối thiểu) - Tồn hiện tại)">
            <CalculatorOutlined style={{ color: '#2563eb' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: 'suggestedQuantity',
      key: 'suggestedQuantity',
      width: 130,
      align: 'right',
      render: (qty, record) => {
        if (!record.hasConsumptionHistory || qty === null || qty === undefined) {
          return (
            <Tooltip title="Chưa đủ dữ liệu tiêu thụ để hệ thống tính gợi ý tự động.">
              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>
                Tự nhập tay
              </span>
            </Tooltip>
          )
        }
        const formula = getSuggestionFormulaText(
          record.currentStock,
          record.minStockThreshold,
          record.previousPeriodConsumption,
          qty
        )
        return (
          <Tooltip title={formula}>
            <span className="procurement-suggested-highlight">
              {qty}
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: (
        <span style={{ color: '#1d4ed8' }}>
          SL thực tế muốn đặt <span style={{ color: '#dc2626' }}>*</span>
        </span>
      ),
      dataIndex: 'proposedQuantity',
      key: 'proposedQuantity',
      width: 155,
      align: 'right',
      render: (val, record) => (
        <InputNumber
          min={1}
          max={99999}
          precision={0}
          value={val}
          placeholder={!record.hasConsumptionHistory ? 'Nhập SL' : ''}
          status={val == null || val <= 0 ? 'error' : ''}
          onChange={(newVal) => handleUpdateItemProposedQuantity(record.medicineId, newVal)}
          style={{ width: '100%', borderRadius: 6, fontWeight: 700 }}
        />
      ),
    },
    {
      title: 'Ghi chú thuốc',
      dataIndex: 'note',
      key: 'note',
      width: 160,
      render: (note, record) => (
        <Input
          placeholder="Thêm ghi chú..."
          value={note}
          maxLength={100}
          onChange={(e) => handleUpdateItemNote(record.medicineId, e.target.value)}
          style={{ borderRadius: 6, fontSize: 12.5 }}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      align: 'center',
      render: (_, record) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveItem(record.medicineId)}
          title="Xóa thuốc khỏi phiếu"
        />
      ),
    },
  ]

  // ==================== CỘT BẢNG DANH SÁCH PHIẾU ====================
  const planColumns = [
    {
      title: 'Mã phiếu',
      dataIndex: 'planCode',
      key: 'planCode',
      width: 120,
      render: (code) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
          {code}
        </span>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (dt) => formatDateTime(dt),
    },
    {
      title: 'Kỳ tham chiếu',
      key: 'period',
      width: 180,
      render: (_, record) => (
        <span style={{ fontSize: 12.5, color: '#475569' }}>
          {formatDate(record.periodStartDate)} — {formatDate(record.periodEndDate)}
        </span>
      ),
    },
    {
      title: 'Số loại thuốc',
      dataIndex: 'totalItems',
      key: 'totalItems',
      width: 110,
      align: 'right',
      render: (count) => <strong>{count} loại</strong>,
    },
    {
      title: 'Tổng SL đề xuất',
      dataIndex: 'totalProposedQuantity',
      key: 'totalProposedQuantity',
      width: 130,
      align: 'right',
      render: (qty) => (
        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
          {qty}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => {
        const meta = getProcurementStatusMeta(status)
        return (
          <Tag color={meta.color} style={{ fontWeight: 600, borderRadius: 6, padding: '2px 8px' }}>
            {meta.label}
          </Tag>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 180,
      render: (_, record) => {
        const sodCheck = canApproveOrRejectPlan(record, currentUserId)
        const isPending = record.status === 'PENDING_APPROVAL'

        return (
          <Space size={6} wrap>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedPlanId(record.id)
                setDetailModalOpen(true)
              }}
              style={{ borderRadius: 6 }}
            >
              Chi tiết
            </Button>

            {isManagerOrAdmin && isPending && (
              <>
                <Tooltip title={!sodCheck.allowed ? sodCheck.reason : ''}>
                  <Popconfirm
                    title="Phê duyệt phiếu dự trù này?"
                    okText="Duyệt"
                    cancelText="Hủy"
                    onConfirm={() => handleQuickApprove(record)}
                    disabled={!sodCheck.allowed || actionLoading}
                  >
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      disabled={!sodCheck.allowed}
                      style={{
                        background: '#16a34a',
                        borderColor: '#16a34a',
                        borderRadius: 6,
                        fontWeight: 600,
                      }}
                    >
                      Duyệt
                    </Button>
                  </Popconfirm>
                </Tooltip>

                <Tooltip title={!sodCheck.allowed ? sodCheck.reason : ''}>
                  <Button
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    disabled={!sodCheck.allowed || actionLoading}
                    onClick={() => {
                      setRejectPlanTarget(record)
                      setRejectModalOpen(true)
                    }}
                    style={{ borderRadius: 6 }}
                  >
                    Từ chối
                  </Button>
                </Tooltip>
              </>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="procurement-page-container">
      {/* Header trang */}
      <div className="procurement-header-title">
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>
            📦 Dự trù mua thuốc và phiếu đặt hàng
          </Title>
        </div>

        <Space size={10} wrap>
          <Tag color="geekblue" style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}>
            <UserOutlined style={{ marginRight: 4 }} />
            Vai trò: <strong>{isPharmacist ? 'Dược sĩ' : isManagerOrAdmin ? 'Quản lý phòng khám' : 'Nhân viên'}</strong>
          </Tag>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              if (activeTab === 'create') fetchSuggestions()
              else fetchPlans()
            }}
            loading={loadingSuggestions || loadingPlans}
            style={{ borderRadius: 8 }}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      {/* Thống kê nhanh */}
      <div className="procurement-stats-grid">
        <div className="procurement-stat-card">
          <div className="procurement-stat-icon blue">
            <ShopOutlined />
          </div>
          <div className="procurement-stat-info">
            <span className="procurement-stat-label">Số thuốc đang dự trù</span>
            <span className="procurement-stat-value">{procurementItems.length} loại</span>
          </div>
        </div>

        <div className="procurement-stat-card">
          <div className="procurement-stat-icon orange">
            <ClockCircleOutlined />
          </div>
          <div className="procurement-stat-info">
            <span className="procurement-stat-label">Phiếu đang chờ duyệt</span>
            <span className="procurement-stat-value">{pendingCount} phiếu</span>
          </div>
        </div>

        <div className="procurement-stat-card">
          <div className="procurement-stat-icon green">
            <FileDoneOutlined />
          </div>
          <div className="procurement-stat-info">
            <span className="procurement-stat-label">Tổng phiếu đã lưu</span>
            <span className="procurement-stat-value">{plans.length} phiếu</span>
          </div>
        </div>
      </div>

      {/* Tabs điều hướng */}
      <Card className="procurement-card" styles={{ body: { padding: '16px 20px 24px' } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'create',
              label: (
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  <ShoppingCartOutlined style={{ marginRight: 6 }} />
                  Lập phiếu dự trù mới
                </span>
              ),
              children: (
                <div>
                  {/* Toolbar cấu hình kỳ tham chiếu & lọc */}
                  <div className="procurement-toolbar">
                    <Space size={12} wrap>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginRight: 8 }}>
                          Kỳ tham chiếu tiêu thụ:
                        </span>
                        <RangePicker
                          value={dateRange}
                          onChange={(dates) => {
                            if (dates && dates[0] && dates[1]) {
                              setDateRange(dates)
                            }
                          }}
                          format="DD/MM/YYYY"
                          style={{ borderRadius: 8 }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch
                          checked={onlyBelowThreshold}
                          onChange={setOnlyBelowThreshold}
                        />
                        <span style={{ fontSize: 13, color: '#475569' }}>
                          Chỉ hiển thị thuốc đang dưới ngưỡng tồn tối thiểu
                        </span>
                      </div>
                    </Space>

                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => setAddMedicineModalOpen(true)}
                      style={{ borderRadius: 8, borderColor: '#2563eb', color: '#2563eb', fontWeight: 600 }}
                    >
                      Thêm thuốc khác vào phiếu
                    </Button>
                  </div>

                  {/* Header tóm tắt số lượng thuốc đã chọn */}
                  <div
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 10,
                      padding: '12px 18px',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <FileProtectOutlined style={{ fontSize: 20, color: '#2563eb' }} />
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>
                          Đã chọn {procurementItems.length} loại thuốc vào phiếu
                        </span>
                        <span style={{ fontSize: 13, color: '#3b82f6', marginLeft: 12 }}>
                          Tổng số lượng đề xuất: <strong>{totalProposedQuantity} đơn vị</strong>
                        </span>
                      </div>
                    </div>

                    <Space size={8}>
                      <Button
                        onClick={() => handleSubmitPlan(false)}
                        loading={submittingPlan}
                        disabled={procurementItems.length === 0}
                        style={{ borderRadius: 8 }}
                      >
                        Lưu bản nháp
                      </Button>
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={() => handleSubmitPlan(true)}
                        loading={submittingPlan}
                        disabled={procurementItems.length === 0}
                        style={{
                          background: '#2563eb',
                          borderColor: '#2563eb',
                          borderRadius: 8,
                          fontWeight: 700,
                        }}
                      >
                        Gửi phiếu dự trù duyệt
                      </Button>
                    </Space>
                  </div>

                  {/* Bảng danh sách thuốc cần dự trù */}
                  {loadingSuggestions ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <Spin size="large" />
                      <div style={{ marginTop: 12, color: '#64748b' }}>Đang phân tích tồn kho và tính toán gợi ý mua...</div>
                    </div>
                  ) : procurementItems.length === 0 ? (
                    /* Trạng thái không có thuốc nào dưới ngưỡng */
                    <Card
                      style={{
                        borderRadius: 12,
                        textAlign: 'center',
                        padding: '40px 20px',
                        background: '#fafafa',
                        border: '1px dashed #cbd5e1',
                      }}
                    >
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>
                              <CheckCircleOutlined style={{ marginRight: 6 }} />
                              Không có thuốc nào cần dự trù tại thời điểm này
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', maxWidth: 480, margin: '0 auto 16px' }}>
                              Tất cả các thuốc trong kho đều đang đạt hoặc vượt ngưỡng tồn an toàn.
                              Nếu bạn muốn chủ động dự trù thuốc cho các đợt khám tới, hãy bấm nút thêm thuốc thủ công bên dưới.
                            </div>
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => setAddMedicineModalOpen(true)}
                              style={{ borderRadius: 8, background: '#2563eb' }}
                            >
                              Thêm thuốc khác vào phiếu
                            </Button>
                          </div>
                        }
                      />
                    </Card>
                  ) : (
                    <div>
                      <Table
                        rowKey="medicineId"
                        columns={suggestionColumns}
                        dataSource={procurementItems}
                        pagination={false}
                        bordered
                        size="small"
                        scroll={{ x: 960 }}
                      />

                      {/* Ô nhập ghi chú chung của phiếu */}
                      <div style={{ marginTop: 18 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                          Ghi chú chung cho phiếu dự trù:
                        </label>
                        <TextArea
                          rows={2}
                          placeholder="Ví dụ: Dự trù định kỳ bổ sung thuốc tháng 10/2026, dự phòng thuốc tiêu hóa và cảm cúm..."
                          value={planGeneralNote}
                          onChange={(e) => setPlanGeneralNote(e.target.value)}
                          maxLength={300}
                          showCount
                          style={{ borderRadius: 8 }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Thông điệp nhắc nhở nghiệp vụ */}
                  <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    message="Quy trình nghiệp vụ dự trù mua thuốc"
                    description="Sau khi Dược sĩ bấm 'Gửi phiếu dự trù', phiếu sẽ chuyển sang trạng thái 'Chờ duyệt' gửi đến Quản lý phòng khám. Đây là công cụ hỗ trợ ra quyết định mua hàng nội bộ, không tự động đặt hàng nhà cung cấp hoặc trừ/cộng tồn kho."
                    style={{ marginTop: 20, borderRadius: 10 }}
                  />
                </div>
              ),
            },
            {
              key: 'plans',
              label: (
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  <FileTextOutlined style={{ marginRight: 6 }} />
                  Danh sách phiếu dự trù & Phê duyệt
                  {pendingCount > 0 && (
                    <Badge
                      count={pendingCount}
                      style={{ backgroundColor: '#ea580c', marginLeft: 8 }}
                    />
                  )}
                </span>
              ),
              children: (
                <div>
                  {/* Toolbar lọc danh sách phiếu */}
                  <div className="procurement-toolbar">
                    <Space size={12} wrap>
                      <Input
                        placeholder="Tìm theo mã phiếu (vd: DT000001)..."
                        allowClear
                        value={planSearchKeyword}
                        onChange={(e) => setPlanSearchKeyword(e.target.value)}
                        style={{ width: 260, borderRadius: 8 }}
                      />

                      <Radio.Group
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        buttonStyle="solid"
                        size="middle"
                      >
                        <Radio.Button value="ALL">Tất cả ({plans.length})</Radio.Button>
                        <Radio.Button value="PENDING_APPROVAL">
                          Chờ duyệt ({pendingCount})
                        </Radio.Button>
                        <Radio.Button value="APPROVED">Đã duyệt</Radio.Button>
                        <Radio.Button value="REJECTED">Bị từ chối</Radio.Button>
                      </Radio.Group>
                    </Space>
                  </div>

                  {/* Bảng danh sách phiếu */}
                  <Table
                    rowKey="id"
                    columns={planColumns}
                    dataSource={filteredPlans}
                    loading={loadingPlans}
                    size="small"
                    bordered
                    pagination={{ pageSize: 15, showTotal: (t) => `Tổng ${t} phiếu dự trù` }}
                    locale={{ emptyText: 'Chưa có phiếu dự trù nào phù hợp' }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal thêm thuốc vào phiếu */}
      <AddMedicineToProcurementModal
        open={addMedicineModalOpen}
        onClose={() => setAddMedicineModalOpen(false)}
        onAddMedicines={handleAddMedicines}
        existingMedicineIds={procurementItems.map((item) => item.medicineId)}
      />

      {/* Modal xem chi tiết phiếu & duyệt */}
      <ProcurementPlanDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedPlanId(null)
        }}
        planId={selectedPlanId}
        currentUserId={currentUserId}
        isManagerOrAdmin={isManagerOrAdmin}
        onActionSuccess={fetchPlans}
      />

      {/* Modal từ chối phiếu nhanh */}
      <RejectProcurementModal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false)
          setRejectPlanTarget(null)
        }}
        onConfirmReject={handleConfirmReject}
        loading={actionLoading}
        planCode={rejectPlanTarget?.planCode}
      />
    </div>
  )
}
