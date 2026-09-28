import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  DatePicker,
  Select,
  Checkbox,
  Input,
  Space,
  Row,
  Col,
  Statistic,
  Modal,
  Badge,
  Tooltip,
  Alert,
  Typography,
  message,
} from 'antd'
import {
  SyncOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  RedoOutlined,
  SearchOutlined,
  PlusOutlined,
  HistoryOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthContext } from '../context/AuthContext.jsx'
import prescriptionReconciliationApi from '../api/prescriptionReconciliationApi.js'
import {
  RECONCILIATION_OUTCOMES,
  OUTCOME_CONFIG,
  getOutcomeTag,
  canAddNote,
  canRetryInterconnection,
  getPrescriptionStatusTag,
  getInterconnectionStatusTag,
} from '../utils/prescriptionReconciliationHelpers.js'
import ReconciliationNotesDrawer from '../components/prescription/ReconciliationNotesDrawer.jsx'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

/**
 * PrescriptionReconciliationPage.jsx
 * 
 * NCL-12-CN-007 / QTN-21: Đối chiếu đơn đã liên thông với đơn đã cấp phát.
 * - Server-side pagination using totalElements
 * - Discrepancy row highlighting
 * - Conditional Note & Retransmission actions based strictly on matrix & roles
 * - Patient names rendered AS-IS (respecting anonymization)
 */
export default function PrescriptionReconciliationPage() {
  const { user } = useAuthContext()

  // User roles & permissions
  const userRoles = useMemo(() => {
    return (user?.roles || [user?.role || '']).map((r) =>
      String(r || '').toUpperCase().replace(/^ROLE_/, '')
    )
  }, [user])

  const isAdmin = userRoles.includes('ADMIN')
  const isPharmacist = userRoles.includes('PHARMACIST')
  const hasAccess = isAdmin || isPharmacist

  // Filter states
  const [dateRange, setDateRange] = useState(null)
  const [outcomeFilter, setOutcomeFilter] = useState('ALL')
  const [discrepanciesOnly, setDiscrepanciesOnly] = useState(false)
  const [prescriptionCode, setPrescriptionCode] = useState('')

  // Pagination states (server-side 0-indexed)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [totalElements, setTotalElements] = useState(0)

  // Data states
  const [dataList, setDataList] = useState([])
  const [loading, setLoading] = useState(false)
  const [retryingId, setRetryingId] = useState(null)

  // Note Drawer states
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState(null)

  // Fetch reconciliation data
  const fetchData = useCallback(async () => {
    if (!hasAccess) return
    setLoading(true)
    try {
      const params = {
        page,
        size,
      }

      if (dateRange && dateRange[0] && dateRange[1]) {
        params.from = dateRange[0].startOf('day').toISOString()
        params.to = dateRange[1].endOf('day').toISOString()
      }

      if (outcomeFilter && outcomeFilter !== 'ALL') {
        params.outcome = outcomeFilter
      }

      if (discrepanciesOnly) {
        params.discrepanciesOnly = true
      }

      if (prescriptionCode && prescriptionCode.trim()) {
        params.prescriptionCode = prescriptionCode.trim()
      }

      const res = await prescriptionReconciliationApi.search(params)
      const pageData = res?.data || {}
      setDataList(Array.isArray(pageData.content) ? pageData.content : [])
      setTotalElements(Number(pageData.totalElements) || 0)
    } catch (err) {
      console.error('Lỗi tải dữ liệu đối chiếu đơn thuốc:', err)
      message.error(err.response?.data?.message || 'Không thể tải dữ liệu đối chiếu đơn thuốc.')
    } finally {
      setLoading(false)
    }
  }, [hasAccess, page, size, dateRange, outcomeFilter, discrepanciesOnly, prescriptionCode])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page when filter changes
  const handleFilterChange = (setter, value) => {
    setter(value)
    setPage(0)
  }

  // Handle Note Added callback from Drawer
  const handleNoteAdded = (newNote, prescriptionId) => {
    setDataList((prev) =>
      prev.map((item) =>
        item.prescriptionId === prescriptionId
          ? { ...item, reconciliationNoteCount: (Number(item.reconciliationNoteCount) || 0) + 1 }
          : item
      )
    )
  }

  // Open Drawer to view/add notes
  const openNotesDrawer = (record) => {
    setSelectedPrescription(record)
    setNotesDrawerOpen(true)
  }

  // Handle Retry Interconnection Submission (ADMIN only, retransmissionEligible only)
  const handleRetry = (record) => {
    if (!canRetryInterconnection(record, userRoles)) return

    Modal.confirm({
      title: 'Xác nhận gửi lại liên thông đơn thuốc',
      icon: <RedoOutlined style={{ color: '#2563eb' }} />,
      content: (
        <div>
          <p>
            Bạn có chắc chắn muốn gửi lại yêu cầu liên thông quốc gia cho đơn thuốc{' '}
            <strong>{record.prescriptionCode}</strong>?
          </p>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Bệnh nhân: <strong>{record.patientName}</strong> ({record.patientCode})
          </div>
          {record.lastInterconnectionError && (
            <div style={{ marginTop: 8, padding: 8, background: '#fef2f2', borderRadius: 6, color: '#b91c1c', fontSize: 12 }}>
              Lỗi trước đó: {record.lastInterconnectionError}
            </div>
          )}
        </div>
      ),
      okText: 'Gửi lại ngay',
      cancelText: 'Hủy',
      okButtonProps: { style: { backgroundColor: '#2563eb' } },
      onOk: async () => {
        setRetryingId(record.prescriptionId)
        try {
          const res = await prescriptionReconciliationApi.retryInterconnection(record.prescriptionId)
          const result = res?.data || {}
          if (result.status === 'SUCCESS') {
            message.success(
              `Gửi lại đơn ${record.prescriptionCode} thành công! Mã tiếp nhận: ${result.receiptCode || '---'}`
            )
          } else {
            message.warning(
              `Yêu cầu gửi lại đã tiếp nhận: ${result.failureReason || 'Đang chờ cổng xử lý'}`
            )
          }
          await fetchData()
        } catch (err) {
          const errMsg = err.response?.data?.message || 'Gửi lại liên thông thất bại.'
          message.error(errMsg)
        } finally {
          setRetryingId(null)
        }
      },
    })
  }

  // Compute summary metrics on current page
  const metrics = useMemo(() => {
    let totalDiscrepancies = 0
    let dispensedNotTransmitted = 0
    let transmittedNotDispensed = 0

    dataList.forEach((item) => {
      if (item.discrepancy) totalDiscrepancies++
      if (item.outcome === RECONCILIATION_OUTCOMES.DISPENSED_NOT_TRANSMITTED) {
        dispensedNotTransmitted++
      }
      if (item.outcome === RECONCILIATION_OUTCOMES.TRANSMITTED_NOT_DISPENSED) {
        transmittedNotDispensed++
      }
    })

    return { totalDiscrepancies, dispensedNotTransmitted, transmittedNotDispensed }
  }, [dataList])

  // Table Columns
  const columns = [
    {
      title: 'Mã đơn thuốc',
      dataIndex: 'prescriptionCode',
      key: 'prescriptionCode',
      width: 140,
      render: (code, record) => (
        <div>
          <span style={{ fontWeight: 700, color: '#1e40af' }}>{code || '---'}</span>
          {record.interconnectionReceiptCode && (
            <div style={{ fontSize: 11, color: '#16a34a' }}>
              MBN: {record.interconnectionReceiptCode}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      width: 180,
      render: (_, record) => (
        <div>
          {/* Patient name rendered AS-IS (preserves anonymization masking if applied) */}
          <div style={{ fontWeight: 600, color: '#0f172a' }}>
            {record.patientName || '---'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Mã BN: {record.patientCode || '---'}
          </div>
        </div>
      ),
    },
    {
      title: 'Bác sĩ kê',
      dataIndex: 'doctorName',
      key: 'doctorName',
      width: 150,
      render: (doc) => (
        <span style={{ color: '#334155' }}>{doc ? `BS. ${doc}` : '---'}</span>
      ),
    },
    {
      title: 'Trạng thái cấp phát',
      dataIndex: 'prescriptionStatus',
      key: 'prescriptionStatus',
      width: 160,
      render: (status) => {
        const meta = getPrescriptionStatusTag(status)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Trạng thái liên thông',
      dataIndex: 'interconnectionStatus',
      key: 'interconnectionStatus',
      width: 160,
      render: (status) => {
        const meta = getInterconnectionStatusTag(status)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Kết quả đối chiếu',
      dataIndex: 'outcome',
      key: 'outcome',
      width: 220,
      render: (outcome, record) => {
        const tag = getOutcomeTag(outcome)
        return (
          <div>
            <Tag
              color={tag.antdColor}
              style={{
                fontWeight: 700,
                fontSize: 12,
                padding: '3px 8px',
                borderRadius: 4,
              }}
            >
              {record.discrepancy && (
                <WarningOutlined style={{ marginRight: 4, color: tag.color }} />
              )}
              {tag.label}
            </Tag>
            {record.lastInterconnectionError && (
              <Tooltip title={record.lastInterconnectionError}>
                <div
                  style={{
                    color: '#dc2626',
                    fontSize: 11,
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <ExclamationCircleOutlined />
                  <span>{record.lastInterconnectionError}</span>
                </div>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      title: 'Mốc thời gian',
      key: 'timestamps',
      width: 200,
      render: (_, record) => (
        <div style={{ fontSize: 11, color: '#64748b' }}>
          <div>
            Kê đơn: {record.prescribedAt ? dayjs(record.prescribedAt).format('DD/MM/YYYY HH:mm') : '---'}
          </div>
          <div>
            Liên thông: {record.lastInterconnectionAt ? dayjs(record.lastInterconnectionAt).format('DD/MM/YYYY HH:mm') : 'Chưa'}
          </div>
          <div>
            Cấp phát: {record.lastDispensedAt ? dayjs(record.lastDispensedAt).format('DD/MM/YYYY HH:mm') : 'Chưa'}
          </div>
        </div>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'reconciliationNoteCount',
      key: 'reconciliationNoteCount',
      width: 100,
      align: 'center',
      render: (count, record) => {
        const num = Number(count) || 0
        return (
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => openNotesDrawer(record)}
            style={{
              color: num > 0 ? '#2563eb' : '#94a3b8',
              fontWeight: num > 0 ? 600 : 400,
            }}
          >
            <Badge
              count={num}
              overflowCount={99}
              style={{
                backgroundColor: num > 0 ? '#2563eb' : '#cbd5e1',
                marginLeft: 4,
              }}
            />
          </Button>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      fixed: 'right',
      render: (_, record) => {
        const showAddNote = canAddNote(record)
        const showRetry = canRetryInterconnection(record, userRoles)

        return (
          <Space size="small">
            {/* View Notes Button */}
            <Tooltip title="Xem lịch sử ghi chú đối chiếu">
              <Button
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => openNotesDrawer(record)}
              />
            </Tooltip>

            {/* Add Note Button (Hidden if discrepancy === false or CANCELLED) */}
            {showAddNote && (
              <Tooltip title="Ghi chú lý do giải trình đơn lệch">
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => openNotesDrawer(record)}
                  style={{ color: '#d97706', borderColor: '#fde68a' }}
                >
                  Ghi chú
                </Button>
              </Tooltip>
            )}

            {/* Retransmit Button (ADMIN only AND retransmissionEligible === true) */}
            {showRetry && (
              <Tooltip title="Gửi lại liên thông quốc gia (Đơn liên thông lỗi)">
                <Button
                  size="small"
                  type="primary"
                  danger
                  icon={<RedoOutlined />}
                  loading={retryingId === record.prescriptionId}
                  onClick={() => handleRetry(record)}
                >
                  Gửi lại
                </Button>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
  ]

  if (!hasAccess) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message="Không có quyền truy cập"
          description="Chức năng đối chiếu đơn thuốc liên thông và cấp phát chỉ dành cho Quản trị viên (Admin) và Dược sĩ (Pharmacist) có quyền PRESCRIPTION_RECONCILIATION_VIEW."
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <style>{`
        .reconciliation-row-discrepancy {
          background-color: #fffaf0 !important;
          transition: background-color 0.2s ease;
        }
        .reconciliation-row-discrepancy:hover > td {
          background-color: #fff3db !important;
        }
      `}</style>

      {/* Page Title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              fontSize: 22,
            }}
          >
            <SyncOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Đối Chiếu Đơn Liên Thông & Cấp Phát Thuốc
            </Title>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8} md={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Tổng số đơn trong kỳ</span>}
              value={totalElements}
              valueStyle={{ color: '#1e293b', fontWeight: 700 }}
              prefix={<MedicineBoxOutlined style={{ color: '#2563eb' }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 10,
              border: '1px solid #fed7aa',
              backgroundColor: metrics.totalDiscrepancies > 0 ? '#fffaf5' : '#ffffff',
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#c2410c' }}>Đơn bị lệch cần xử lý</span>}
              value={metrics.totalDiscrepancies}
              valueStyle={{ color: '#ea580c', fontWeight: 700 }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 10,
              border: '1px solid #fecaca',
              backgroundColor: metrics.dispensedNotTransmitted > 0 ? '#fef2f2' : '#ffffff',
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#b91c1c' }}>Đã cấp phát - Chưa liên thông (Nghiêm trọng)</span>}
              value={metrics.dispensedNotTransmitted}
              valueStyle={{ color: '#dc2626', fontWeight: 700 }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8} md={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #fde68a' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#b45309' }}>Đã liên thông - Chưa cấp phát</span>}
              value={metrics.transmittedNotDispensed}
              valueStyle={{ color: '#d97706', fontWeight: 700 }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Filter & Table Card */}
      <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Filters Row */}
        <div style={{ marginBottom: 16 }}>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={12} md={7}>
              <RangePicker
                placeholder={['Từ ngày', 'Đến ngày']}
                format="DD/MM/YYYY"
                value={dateRange}
                onChange={(dates) => handleFilterChange(setDateRange, dates)}
                style={{ width: '100%' }}
                allowClear
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Select
                value={outcomeFilter}
                onChange={(val) => handleFilterChange(setOutcomeFilter, val)}
                style={{ width: '100%' }}
              >
                <Option value="ALL">-- Tất cả kết quả đối chiếu --</Option>
                <Option value={RECONCILIATION_OUTCOMES.CONSISTENT}>
                  Đồng bộ (Khớp)
                </Option>
                <Option value={RECONCILIATION_OUTCOMES.TRANSMITTED_NOT_DISPENSED}>
                  Đã liên thông - Chưa cấp phát
                </Option>
                <Option value={RECONCILIATION_OUTCOMES.DISPENSED_NOT_TRANSMITTED}>
                  Đã cấp phát - Chưa liên thông
                </Option>
                <Option value={RECONCILIATION_OUTCOMES.NOT_TRANSMITTED_NOT_DISPENSED}>
                  Chưa liên thông - Chưa cấp phát
                </Option>
                <Option value={RECONCILIATION_OUTCOMES.CANCELLED}>
                  Đơn thuốc đã hủy
                </Option>
              </Select>
            </Col>

            <Col xs={24} sm={12} md={5}>
              <Input
                placeholder="Tìm mã đơn (VD: DT2026...)"
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={prescriptionCode}
                onChange={(e) => handleFilterChange(setPrescriptionCode, e.target.value)}
                allowClear
              />
            </Col>

            <Col xs={24} sm={12} md={4}>
              <Checkbox
                checked={discrepanciesOnly}
                onChange={(e) => handleFilterChange(setDiscrepanciesOnly, e.target.checked)}
              >
                <strong style={{ color: '#ea580c' }}>Chỉ đơn lệch</strong>
              </Checkbox>
            </Col>

            <Col xs={24} sm={12} md={2} style={{ textAlign: 'right' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchData}
                loading={loading}
              >
                Tải lại
              </Button>
            </Col>
          </Row>
        </div>

        {/* Informative Legend */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 14px',
            marginBottom: 16,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#64748b', fontWeight: 600 }}>Chú giải trạng thái:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#bbf7d0', display: 'inline-block' }} />
            Đồng bộ (Khớp)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#fde68a', display: 'inline-block' }} />
            Đã liên thông nhưng chưa cấp phát
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#fca5a5', display: 'inline-block' }} />
            Đã cấp phát nhưng chưa liên thông (Cần xử lý)
          </span>
          <span style={{ marginLeft: 'auto', color: '#64748b' }}>
            Các dòng <span style={{ backgroundColor: '#fffaf0', padding: '1px 6px', border: '1px solid #fed7aa', borderRadius: 4, color: '#c2410c' }}>màu cam nhạt</span> là đơn phát hiện bị lệch dữ liệu
          </span>
        </div>

        {/* Data Table */}
        <Table
          columns={columns}
          dataSource={dataList}
          rowKey={(record) => record.prescriptionId}
          rowClassName={(record) => (record.discrepancy ? 'reconciliation-row-discrepancy' : '')}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page + 1,
            pageSize: size,
            total: totalElements,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (p, s) => {
              setPage(p - 1)
              setSize(s)
            },
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} đơn thuốc`,
          }}
        />
      </Card>

      {/* Note History & Form Drawer */}
      <ReconciliationNotesDrawer
        open={notesDrawerOpen}
        onClose={() => setNotesDrawerOpen(false)}
        prescription={selectedPrescription}
        canAddNote={canAddNote(selectedPrescription)}
        onNoteAdded={handleNoteAdded}
      />
    </div>
  )
}
