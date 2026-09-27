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
  Input,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FilterOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import inventoryStockReportApi from '../api/inventoryStockReportApi.js'
import { useAuthContext } from '../context/AuthContext.jsx'
import {
  calculateStockSummary,
  downloadCsvBlob,
  extractBlobErrorMessage,
  extractFilenameFromHeader,
  formatQuantity,
  getInventoryStockReportErrorMessage,
  validateClosingBalance,
  validateDateRange,
} from '../utils/inventoryStockReportHelpers.js'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

// Chuẩn hóa tên đơn vị tính từ backend (không dấu) → hiển thị đúng tiếng Việt
const UNIT_DISPLAY_MAP = {
  vien: 'viên',
  vi: 'vỉ',
  hop: 'hộp',
  chai: 'chai',
  goi: 'gói',
  ong: 'ống',
  lo: 'lọ',
  tuyp: 'tuýp',
  tuýp: 'tuýp',
  ml: 'ml',
  mg: 'mg',
  g: 'g',
  kg: 'kg',
  l: 'l',
}
const normalizeUnit = (unit) => {
  if (!unit) return '—'
  const key = String(unit).trim().toLowerCase()
  return UNIT_DISPLAY_MAP[key] || unit
}

export default function InventoryStockReportPage() {
  const { user } = useAuthContext()

  // Phân quyền bảo mật: Cho phép PHARMACIST, MANAGER, ADMIN. Chặn DOCTOR, RECEPTIONIST.
  const userRoles = useMemo(() => {
    return (user?.roles || [user?.role || '']).map((r) =>
      String(r || '').toLowerCase().replace(/^role_/, '')
    )
  }, [user])

  const userPerms = useMemo(() => {
    return (user?.permissions || []).map((p) =>
      String(p || '').toUpperCase().replace(/^PERMISSION_/, '')
    )
  }, [user])

  const isAdmin = userRoles.includes('admin')
  const isManager = userRoles.includes('manager') || userRoles.includes('clinic_manager')
  const isPharmacist = userRoles.includes('pharmacist')
  const hasReportPerm = userPerms.includes('INVENTORY_REPORT_VIEW')

  const isAuthorized = isAdmin || isManager || isPharmacist || hasReportPerm

  // State bộ lọc
  const [dateRange, setDateRange] = useState(() => [
    dayjs().subtract(29, 'day').startOf('day'),
    dayjs().endOf('day'),
  ])

  // State tìm kiếm theo tên/mã thuốc
  const [searchText, setSearchText] = useState('')

  // State dữ liệu báo cáo
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Hàm gọi API lấy dữ liệu báo cáo
  const handleFetchReport = useCallback(
    async (rangeToUse = dateRange) => {
      if (!rangeToUse || !rangeToUse[0] || !rangeToUse[1]) {
        message.warning('Vui lòng chọn khoảng thời gian báo cáo.')
        return
      }

      const fromStr = rangeToUse[0].format('YYYY-MM-DD')
      const toStr = rangeToUse[1].format('YYYY-MM-DD')

      const validation = validateDateRange(fromStr, toStr)
      if (!validation.valid) {
        message.error(validation.error)
        return
      }

      try {
        setLoading(true)
        const res = await inventoryStockReportApi.getReport({
          from: fromStr,
          to: toStr,
        })
        setReportData(res?.data || { from: fromStr, to: toStr, hasTransactions: false, items: [] })
        setHasSearched(true)
      } catch (err) {
        const errorMsg = getInventoryStockReportErrorMessage(err)
        message.error(errorMsg)
      } finally {
        setLoading(false)
      }
    },
    [dateRange]
  )

  // Tự động tải báo cáo lần đầu
  useEffect(() => {
    if (isAuthorized) {
      handleFetchReport()
    }
  }, [isAuthorized])

  // Xử lý chọn nhanh kỳ báo cáo
  const handleQuickPreset = (preset) => {
    let newRange
    const now = dayjs()

    switch (preset) {
      case '7DAYS':
        newRange = [now.subtract(6, 'day').startOf('day'), now.endOf('day')]
        break
      case '30DAYS':
        newRange = [now.subtract(29, 'day').startOf('day'), now.endOf('day')]
        break
      case 'THIS_MONTH':
        newRange = [now.startOf('month'), now.endOf('day')]
        break
      case 'LAST_MONTH':
        newRange = [
          now.subtract(1, 'month').startOf('month'),
          now.subtract(1, 'month').endOf('month'),
        ]
        break
      default:
        newRange = [now.subtract(29, 'day').startOf('day'), now.endOf('day')]
    }

    setDateRange(newRange)
    handleFetchReport(newRange)
  }

  // Xử lý xuất file CSV
  const handleExportCsv = async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.warning('Vui lòng chọn khoảng thời gian báo cáo.')
      return
    }

    const fromStr = dateRange[0].format('YYYY-MM-DD')
    const toStr = dateRange[1].format('YYYY-MM-DD')

    const validation = validateDateRange(fromStr, toStr)
    if (!validation.valid) {
      message.error(validation.error)
      return
    }

    try {
      setExporting(true)
      const response = await inventoryStockReportApi.exportReport({
        from: fromStr,
        to: toStr,
      })

      const disposition = response?.headers?.['content-disposition'] || ''
      const filename = extractFilenameFromHeader(
        disposition,
        `stock-in-out-report-${fromStr}-to-${toStr}.csv`
      )

      downloadCsvBlob(response?.data, filename)
      message.success('Xuất file báo cáo xuất nhập tồn thành công!')
    } catch (err) {
      const errorMsg = await extractBlobErrorMessage(err)
      message.error(errorMsg)
    } finally {
      setExporting(false)
    }
  }

  // Dữ liệu lọc theo ô tìm kiếm
  const filteredItems = useMemo(() => {
    const rawItems = reportData?.items || []
    if (!searchText.trim()) return rawItems

    const keyword = searchText.trim().toLowerCase()
    return rawItems.filter(
      (item) =>
        (item.medicineCode || '').toLowerCase().includes(keyword) ||
        (item.medicineName || '').toLowerCase().includes(keyword)
    )
  }, [reportData, searchText])

  // Dữ liệu tổng hợp toàn kho
  const stockSummary = useMemo(() => {
    return calculateStockSummary(reportData?.items || [])
  }, [reportData])

  // Cấu hình các cột của Bảng dữ liệu cân đối kho (10 cột chuẩn)
  const columns = useMemo(
    () => [
      {
        title: 'Mã thuốc',
        dataIndex: 'medicineCode',
        key: 'medicineCode',
        width: 140,
        render: (code) => (
          <Tag
            color="blue"
            style={{
              fontWeight: 700,
              fontSize: 11,
              fontFamily: 'Consolas, "SFMono-Regular", monospace',
              borderRadius: 6,
              padding: '1px 6px',
              whiteSpace: 'nowrap',
              display: 'inline-block',
              maxWidth: '100%',
            }}
          >
            {code || '—'}
          </Tag>
        ),
      },

      {
        title: 'Tên thuốc & Hoạt chất',
        dataIndex: 'medicineName',
        key: 'medicineName',
        render: (name) => (
          <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
            {name || 'Chưa đặt tên'}
          </Text>
        ),
      },
      {
        title: 'ĐVT',
        dataIndex: 'unit',
        key: 'unit',
        width: 70,
        align: 'center',
        render: (unit) => (
          <Tag style={{ borderRadius: 6, background: '#f8fafc', color: '#475569', fontSize: 11, margin: 0 }}>
            {normalizeUnit(unit)}
          </Tag>
        ),
      },
      {
        title: 'Tồn đầu',
        dataIndex: 'openingQuantity',
        key: 'openingQuantity',
        width: 90,
        align: 'right',
        render: (qty) => (
          <span style={{ color: '#334155', fontSize: 13, fontWeight: 500 }}>
            {formatQuantity(qty)}
          </span>
        ),
      },
      {
        title: 'Nhập (+)',
        dataIndex: 'receivedQuantity',
        key: 'receivedQuantity',
        width: 90,
        align: 'right',
        render: (qty) => {
          const num = Number(qty) || 0
          return (
            <span style={{ color: num > 0 ? '#059669' : '#334155', fontSize: 13, fontWeight: 500 }}>
              {num > 0 ? `+${formatQuantity(num)}` : '0'}
            </span>
          )
        },
      },
      {
        title: 'Cấp phát (-)',
        dataIndex: 'dispensedQuantity',
        key: 'dispensedQuantity',
        width: 100,
        align: 'right',
        render: (qty) => {
          const num = Number(qty) || 0
          return (
            <span style={{ color: num > 0 ? '#2563eb' : '#334155', fontSize: 13, fontWeight: 500 }}>
              {num > 0 ? `-${formatQuantity(num)}` : '0'}
            </span>
          )
        },
      },
      {
        title: 'Trả lại (+)',
        dataIndex: 'returnedQuantity',
        key: 'returnedQuantity',
        width: 90,
        align: 'right',
        render: (qty) => {
          const num = Number(qty) || 0
          return (
            <span style={{ color: num > 0 ? '#7c3aed' : '#334155', fontSize: 13, fontWeight: 500 }}>
              {num > 0 ? `+${formatQuantity(num)}` : '0'}
            </span>
          )
        },
      },
      {
        title: (
          <Tooltip title="Bao gồm điều chỉnh kiểm kê và xuất hủy thuốc hết hạn">
            <span>
              Đ.Chỉnh (±) <InfoCircleOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
            </span>
          </Tooltip>
        ),
        dataIndex: 'adjustedQuantity',
        key: 'adjustedQuantity',
        width: 85,
        align: 'right',
        render: (qty) => {
          const num = Number(qty) || 0
          const color = num > 0 ? '#059669' : num < 0 ? '#dc2626' : '#334155'
          return (
            <span style={{ color, fontSize: 13, fontWeight: 500 }}>
              {formatQuantity(num, { showSign: true })}
            </span>
          )
        },
      },
      {
        title: (
          <Tooltip title="Tồn cuối = Tồn đầu + Nhập - Cấp phát + Trả lại + Điều chỉnh">
            <span style={{ color: '#0f172a', fontWeight: 600 }}>
              Tồn cuối <InfoCircleOutlined style={{ fontSize: 11, color: '#2563eb' }} />
            </span>
          </Tooltip>
        ),
        dataIndex: 'closingQuantity',
        key: 'closingQuantity',
        width: 100,
        align: 'right',
        className: 'closing-balance-column',
        render: (qty) => (
          <div
            style={{
              padding: '2px 6px',
              borderRadius: 6,
              background: '#f0fdf4',
              display: 'inline-block',
            }}
          >
            <span style={{ color: '#166534', fontSize: 13, fontWeight: 500 }}>
              {formatQuantity(qty)}
            </span>
          </div>
        ),
      },
      {
        title: 'ĐC',
        key: 'reconciliation',
        width: 52,
        align: 'center',
        render: (_, record) => {
          const check = validateClosingBalance(record)
          if (!check.hasDiscrepancy) {
            return (
              <Tooltip title="Số liệu cân đối đúng công thức">
                <CheckCircleOutlined style={{ color: '#059669', fontSize: 15 }} />
              </Tooltip>
            )
          }
          return (
            <Tooltip
              title={`Số liệu chưa khớp công thức cân đối kho: Tồn cuối thực tế (${check.actualClosing}) lệch ${check.difference > 0 ? `+${check.difference}` : check.difference} so với tính toán lý thuyết (${check.expectedClosing}). Vui lòng kiểm tra lại.`}
            >
              <WarningOutlined style={{ color: '#ea580c', fontSize: 15, cursor: 'pointer' }} />
            </Tooltip>
          )
        },
      },
    ],
    []
  )


  // Nếu người dùng không có quyền truy cập
  if (!isAuthorized) {
    return (
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        <Alert
          type="error"
          showIcon
          message="Truy cập bị từ chối"
          description="Báo cáo xuất nhập tồn chỉ dành cho Dược sĩ (PHARMACIST), Quản lý phòng khám (MANAGER) và Quản trị viên (ADMIN). Vui lòng liên hệ người quản trị nếu bạn cần được cấp quyền."
          style={{ borderRadius: 10 }}
        />
      </div>
    )
  }

  // Nút Xuất file CSV chỉ cho phép khi có dữ liệu và hasTransactions = true
  const canExport =
    reportData &&
    reportData.hasTransactions &&
    Array.isArray(reportData.items) &&
    reportData.items.length > 0

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Tiêu đề trang (Tuân thủ Rule: Không thêm dòng mô tả phụ dài dòng dưới tiêu đề) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space size={10} align="center">
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            <MedicineBoxOutlined />
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 22 }}>
            Báo cáo xuất nhập tồn theo kỳ
          </Title>
        </Space>

        <Space size={10}>
          <Button
            type="default"
            icon={<ReloadOutlined />}
            onClick={() => handleFetchReport()}
            loading={loading}
            style={{ height: 40, borderRadius: 8, fontWeight: 600, padding: '0 16px' }}
          >
            Làm mới
          </Button>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportCsv}
            loading={exporting}
            disabled={!canExport || loading}
            style={{
              height: 40,
              borderRadius: 8,
              fontWeight: 700,
              padding: '0 18px',
              background: canExport ? '#059669' : undefined,
              borderColor: canExport ? '#059669' : undefined,
            }}
          >
            Xuất file CSV
          </Button>
        </Space>
      </div>

      {/* Thanh bộ lọc (Filter Bar) */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          border: '1px solid #f1f5f9',
          marginBottom: 18,
        }}
        styles={{ body: { padding: '18px 20px' } }}
      >
        <Row gutter={[16, 16]} align="bottom">
          {/* Chọn kỳ báo cáo */}
          <Col xs={24} sm={24} md={12} lg={10}>
            <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#334155' }}>
              <CalendarOutlined style={{ marginRight: 6, color: '#059669' }} />
              Kỳ báo cáo xuất nhập tồn (Tối đa 366 ngày):
            </Text>
            <RangePicker
              value={dateRange}
              onChange={(val) => setDateRange(val)}
              format="DD/MM/YYYY"
              allowClear={false}
              disabledDate={(current) => current && current > dayjs().endOf('day')}
              style={{ width: '100%', height: 40, borderRadius: 8 }}
            />
          </Col>

          {/* Ô tìm kiếm nhanh thuốc */}
          <Col xs={24} sm={16} md={8} lg={9}>
            <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#334155' }}>
              <SearchOutlined style={{ marginRight: 6, color: '#059669' }} />
              Tìm nhanh mã hoặc tên thuốc:
            </Text>
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Nhập mã hoặc tên thuốc..."
              allowClear
              style={{ width: '100%', height: 40, borderRadius: 8 }}
            />
          </Col>

          {/* Nút Xem báo cáo */}
          <Col xs={24} sm={8} md={4} lg={5}>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => handleFetchReport()}
              loading={loading}
              style={{
                width: '100%',
                height: 40,
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14.5,
              }}
            >
              Xem báo cáo
            </Button>
          </Col>
        </Row>

        {/* Dòng chọn nhanh khoảng thời gian (Quick Presets) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px dashed #e2e8f0',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <FilterOutlined style={{ color: '#059669' }} /> Chọn nhanh:
          </span>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('7DAYS')}>
            7 ngày qua
          </Button>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('30DAYS')}>
            30 ngày qua
          </Button>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('THIS_MONTH')}>
            Tháng này
          </Button>
          <Button size="middle" style={{ borderRadius: 6, fontSize: 12.5, height: 34 }} onClick={() => handleQuickPreset('LAST_MONTH')}>
            Tháng trước
          </Button>
        </div>
      </Card>

      {/* Cảnh báo chênh lệch kho nếu phát hiện bất kỳ dòng nào không khớp công thức */}
      {stockSummary.hasAnyDiscrepancy && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Cảnh báo chênh lệch số liệu kho"
          description={`Phát hiện ${stockSummary.discrepancyCount} mặt hàng thuốc có số liệu chưa khớp hoàn toàn theo công thức cân đối kho (Tồn cuối = Tồn đầu + Nhập - Cấp phát + Trả lại + Điều chỉnh). Vui lòng kiểm tra các dòng có biểu tượng cảnh báo bên dưới để đối chiếu và giải trình.`}
          style={{ marginBottom: 18, borderRadius: 10 }}
        />
      )}

      {/* Nội dung kết quả */}
      {loading ? (
        <Card
          bordered={false}
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Spin size="large" tip="Đang tổng hợp báo cáo xuất nhập tồn kho dược..." />
        </Card>
      ) : reportData && reportData.hasTransactions && Array.isArray(reportData.items) && reportData.items.length > 0 ? (
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          {/* Thẻ KPI Tổng hợp Kho dược */}
          <Row gutter={[16, 16]}>
            {/* Tổng số mặt hàng */}
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ borderRadius: 10, border: '1px solid #f1f5f9', background: '#fff' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>Mặt hàng thuốc</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {stockSummary.totalMedicines.toLocaleString('vi-VN')}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>loại thuốc</Text>
              </Card>
            </Col>

            {/* Tổng tồn đầu kỳ */}
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ borderRadius: 10, border: '1px solid #f1f5f9', background: '#fff' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>Tổng tồn đầu kỳ</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#334155', marginTop: 2 }}>
                  {stockSummary.totalOpening.toLocaleString('vi-VN')}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>đơn vị thuốc</Text>
              </Card>
            </Col>

            {/* Tổng nhập kho */}
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ borderRadius: 10, border: '1px solid #f1f5f9', background: '#ecfdf5' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text strong style={{ fontSize: 12, color: '#059669', display: 'block' }}>Tổng nhập (+)</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#059669', marginTop: 2 }}>
                  +{stockSummary.totalReceived.toLocaleString('vi-VN')}
                </div>
                <Text style={{ fontSize: 11, color: '#047857' }}>từ phiếu nhập kho</Text>
              </Card>
            </Col>

            {/* Tổng cấp phát */}
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ borderRadius: 10, border: '1px solid #f1f5f9', background: '#eff6ff' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text strong style={{ fontSize: 12, color: '#2563eb', display: 'block' }}>Tổng cấp phát (-)</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                  -{stockSummary.totalDispensed.toLocaleString('vi-VN')}
                </div>
                <Text style={{ fontSize: 11, color: '#1d4ed8' }}>đã phát bệnh nhân</Text>
              </Card>
            </Col>

            {/* Tổng trả lại */}
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ borderRadius: 10, border: '1px solid #f1f5f9', background: stockSummary.totalReturned > 0 ? '#faf5ff' : '#fff' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text strong style={{ fontSize: 12, color: '#7c3aed', display: 'block' }}>Tổng trả lại (+)</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: stockSummary.totalReturned > 0 ? '#7c3aed' : '#334155', marginTop: 2 }}>
                  {stockSummary.totalReturned > 0 ? `+${stockSummary.totalReturned.toLocaleString('vi-VN')}` : '0'}
                </div>
                <Text style={{ fontSize: 11, color: '#6d28d9' }}>thuốc trả về kho</Text>
              </Card>
            </Col>

            {/* Tổng điều chỉnh */}
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ borderRadius: 10, border: '1px solid #f1f5f9', background: '#fff' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>Tổng điều chỉnh (±)</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: stockSummary.totalAdjusted >= 0 ? '#059669' : '#dc2626', marginTop: 2 }}>
                  {formatQuantity(stockSummary.totalAdjusted, { showSign: true })}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>kiểm kê & xuất hủy</Text>
              </Card>
            </Col>

            {/* Tổng tồn cuối kỳ */}
            <Col xs={12} sm={8} md={4}>
              <Card bordered={false} style={{ borderRadius: 10, border: '1.5px solid #bbf7d0', background: '#f0fdf4' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text strong style={{ fontSize: 12, color: '#166534', display: 'block' }}>Tổng tồn cuối kỳ</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', marginTop: 2 }}>
                  {stockSummary.totalClosing.toLocaleString('vi-VN')}
                </div>
                <Text style={{ fontSize: 11, color: '#15803d' }}>tồn kho hiện tại</Text>
              </Card>
            </Col>
          </Row>

          {/* AC-03: Banner khi kỳ không có giao dịch nhưng vẫn có tồn */}
          {!reportData.hasTransactions && reportData.items?.length > 0 && (
            <Alert
              type="info"
              showIcon
              message="Kỳ không có giao dịch xuất nhập (AC-03)"
              description="Trong khoảng thời gian này không ghi nhận bất kỳ phiếu nhập, cấp phát, trả thuốc hay điều chỉnh nào. Số tồn cuối kỳ = số tồn đầu kỳ (giữ nguyên). Bảng dưới cho thấy trạng thái tồn kho hiện hành của từng mặt hàng."
              style={{ borderRadius: 10 }}
            />
          )}

          {/* Bảng Dữ liệu Cân đối Kho 10 cột */}
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
                <Space size={8}>
                  <FileTextOutlined style={{ color: '#059669', fontSize: 18 }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    Chi tiết cân đối xuất nhập tồn từng mặt hàng thuốc ({filteredItems.length} thuốc)
                  </span>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Thời điểm kết xuất: {reportData.generatedAt ? dayjs(reportData.generatedAt).format('DD/MM/YYYY HH:mm:ss') : '-'}
                </Text>
              </div>
            }
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              border: '1px solid #f1f5f9',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Table
              dataSource={filteredItems}
              columns={columns}
              rowKey={(r) => r.medicineId || r.medicineCode}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              scroll={undefined}
              bordered
            />
          </Card>
        </Space>
      ) : hasSearched ? (
        /* Empty State */
        <Card
          bordered={false}
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text style={{ fontSize: 14.5, color: '#64748b' }}>
                  Không có giao dịch nhập/xuất kho nào trong khoảng thời gian đã chọn.
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Button
                    type="link"
                    onClick={() => handleQuickPreset('30DAYS')}
                    style={{ fontSize: 13, color: '#059669' }}
                  >
                    Xem dữ liệu 30 ngày qua
                  </Button>
                </div>
              </div>
            }
          />
        </Card>
      ) : null}
    </div>
  )
}
