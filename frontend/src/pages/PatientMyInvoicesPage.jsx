import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Radio,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SearchOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'

import patientPortalInvoiceApi from '../api/patientPortalInvoiceApi'
import PatientInvoiceDetailModal from '../components/portal/PatientInvoiceDetailModal'
import {
  calculateInvoiceStats,
  downloadPdfBlob,
  filterInvoices,
  formatCurrency,
  formatDate,
  formatTime,
  getSecuritySafeErrorMessage,
  mapInvoicesWithAdjustments,
  sortInvoicesByDateDesc,
} from '../utils/patientInvoiceHelpers'
import './styles/patientMyInvoices.css'

const { Title, Text } = Typography

function PatientMyInvoicesPage() {
  const [rawInvoices, setRawInvoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterType, setFilterType] = useState('ALL') // 'ALL', 'EFFECTIVE_ONLY', 'ORIGINAL', 'ADJUSTMENT'

  // Modal xem chi tiết hóa đơn
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [selectedInvoiceSummary, setSelectedInvoiceSummary] = useState(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const res = await patientPortalInvoiceApi.getInvoices()
      const data = res.data
      const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []
      // Sắp xếp mặc định ngày mới nhất lên đầu (Mục 2)
      const sorted = sortInvoicesByDateDesc(list)
      setRawInvoices(sorted)
    } catch (err) {
      // Ràng buộc bảo mật: Thông báo lỗi thân thiện, không lộ thông tin
      const safeMsg = getSecuritySafeErrorMessage(err)
      setErrorMessage(safeMsg)
      setRawInvoices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  // Xử lý logic nghiệp vụ bản gốc vs bản điều chỉnh (Mục 1, 4)
  const enrichedInvoices = useMemo(() => {
    return mapInvoicesWithAdjustments(rawInvoices)
  }, [rawInvoices])

  // Lọc theo từ khóa tìm kiếm và bộ lọc loại hóa đơn
  const displayedInvoices = useMemo(() => {
    return filterInvoices(enrichedInvoices, {
      searchKeyword,
      filterType,
    })
  }, [enrichedInvoices, searchKeyword, filterType])

  // Thống kê tổng quan viện phí
  const stats = useMemo(() => {
    return calculateInvoiceStats(enrichedInvoices)
  }, [enrichedInvoices])

  // Thao tác sao chép mã
  const handleCopyCode = (code, label = 'mã hóa đơn') => {
    if (!code) return
    navigator.clipboard.writeText(code)
    message.success(`Đã sao chép ${label}!`)
  }

  // Thao tác 1-Click Tải hóa đơn (PDF) trực tiếp từ danh sách (Mục 3)
  const handleDownloadInvoice = async (inv) => {
    if (!inv?.invoiceId || downloadingId) return

    setDownloadingId(inv.invoiceId)
    try {
      const response = await patientPortalInvoiceApi.downloadInvoice(inv.invoiceId)
      const disposition = response.headers?.['content-disposition']
      let filename = `hoa-don-${inv.invoiceCode || 'HD'}.pdf`
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) filename = match[1]
      }
      downloadPdfBlob(response.data, filename)
      message.success(`Đã tải hóa đơn ${inv.invoiceCode} thành công!`)
    } catch (err) {
      const safeMsg = getSecuritySafeErrorMessage(err)
      message.error(safeMsg)
    } finally {
      setDownloadingId(null)
    }
  }

  // Mở modal xem chi tiết hóa đơn
  const handleOpenDetail = (inv) => {
    setSelectedInvoiceId(inv.invoiceId)
    setSelectedInvoiceSummary(inv)
    setDetailModalOpen(true)
  }

  // Nhảy tới xem hóa đơn điều chỉnh có hiệu lực
  const handleJumpToAdjustment = (adjustmentInvoiceId) => {
    const target = enrichedInvoices.find((i) => i.invoiceId === adjustmentInvoiceId)
    if (target) {
      setSelectedInvoiceId(target.invoiceId)
      setSelectedInvoiceSummary(target)
      setDetailModalOpen(true)
    }
  }

  return (
    <div className="portal-my-invoices-page">
      {/* Header đồng bộ Cổng bệnh nhân */}
      <header className="portal-my-invoices-header">
        <div className="portal-my-invoices-header-inner">
          <Link className="portal-booking-brand" to="/portal/dashboard">
            <span className="portal-booking-brand-icon">
              <MedicineBoxOutlined />
            </span>
            <span>
              <strong>BỆNH ÁN SỐ</strong>
              <small>Cổng thông tin bệnh nhân</small>
            </span>
          </Link>

          <Space size={10} wrap>
            <Link to="/portal/book-appointment">
              <Button type="primary" className="portal-header-btn-primary" icon={<PlusOutlined />}>
                Đặt lịch khám mới
              </Button>
            </Link>
            <Link to="/portal/my-appointments">
              <Button className="portal-header-btn" icon={<ScheduleOutlined style={{ color: '#2563eb' }} />}>
                Lịch hẹn của tôi
              </Button>
            </Link>
            <Link to="/portal/medical-history">
              <Button className="portal-header-btn" icon={<FileDoneOutlined style={{ color: '#16a34a' }} />}>
                Lịch sử khám
              </Button>
            </Link>
            <Link to="/portal/dashboard">
              <Button className="portal-header-btn" icon={<HomeOutlined style={{ color: '#64748b' }} />}>
                Trang chủ
              </Button>
            </Link>
          </Space>
        </div>
      </header>

      <main className="portal-my-invoices-main">
        {/* Breadcrumb điều hướng */}
        <div style={{ marginBottom: 16 }}>
          <Breadcrumb
            items={[
              {
                title: (
                  <Link to="/portal/dashboard">
                    <HomeOutlined /> Trang chủ
                  </Link>
                ),
              },
              {
                title: 'Hóa đơn của tôi',
              },
            ]}
          />
        </div>

        <div className="portal-invoices-card-wrapper">
          {/* Tiêu đề trang */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <Title level={4} style={{ margin: 0, color: '#1e3a8a' }}>
                <FileProtectOutlined style={{ marginRight: 8, color: '#2563eb' }} />
                Hóa đơn viện phí của tôi
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Xem lại danh sách hóa đơn các lượt khám và tải chứng từ thanh toán (PDF) phục vụ bảo hiểm, quyết toán hoặc lưu trữ
              </Text>
            </div>

            <Button icon={<ReloadOutlined />} onClick={fetchInvoices} loading={loading}>
              Làm mới
            </Button>
          </div>

          {/* Khối thẻ tóm tắt số liệu (KPIs) nếu đã có dữ liệu */}
          {enrichedInvoices.length > 0 && (
            <div className="portal-invoices-stats-grid">
              <div className="portal-stat-card">
                <div className="portal-stat-icon blue">
                  <FileTextOutlined />
                </div>
                <div className="portal-stat-info">
                  <span className="portal-stat-label">Tổng số hóa đơn</span>
                  <span className="portal-stat-value">{stats.totalCount} hóa đơn</span>
                </div>
              </div>

              <div className="portal-stat-card">
                <div className="portal-stat-icon green">
                  <CheckCircleOutlined />
                </div>
                <div className="portal-stat-info">
                  <span className="portal-stat-label">Tổng viện phí đã trả</span>
                  <span className="portal-stat-value" style={{ color: '#16a34a' }}>
                    {formatCurrency(stats.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="portal-stat-card">
                <div className="portal-stat-icon amber">
                  <CalendarOutlined />
                </div>
                <div className="portal-stat-info">
                  <span className="portal-stat-label">Lần khám gần nhất</span>
                  <span className="portal-stat-value" style={{ fontSize: 15 }}>
                    {stats.latestVisitDate ? formatDate(stats.latestVisitDate) : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Thanh công cụ tìm kiếm và lọc phân loại */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12,
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <Input
              placeholder="Tìm theo mã hóa đơn, bác sĩ, ngày khám..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
              style={{ width: 280, borderRadius: 8 }}
            />

            <Radio.Group
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              size="middle"
              buttonStyle="solid"
            >
              <Radio.Button value="ALL">Tất cả ({enrichedInvoices.length})</Radio.Button>
              <Radio.Button value="EFFECTIVE_ONLY">Bản có hiệu lực</Radio.Button>
              <Radio.Button value="ORIGINAL">Hóa đơn gốc</Radio.Button>
              <Radio.Button value="ADJUSTMENT">Hóa đơn điều chỉnh</Radio.Button>
            </Radio.Group>
          </div>

          {/* Khối hiển thị danh sách hóa đơn */}
          {loading ? (
            <div style={{ padding: '24px 0' }}>
              {[1, 2, 3].map((k) => (
                <Card key={k} style={{ marginBottom: 14, borderRadius: 12 }}>
                  <Skeleton active paragraph={{ rows: 3 }} />
                </Card>
              ))}
            </div>
          ) : errorMessage ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <Alert
                type="error"
                message="Thông báo"
                description={errorMessage}
                showIcon
                action={
                  <Button type="primary" onClick={fetchInvoices} style={{ marginTop: 6 }}>
                    Thử lại
                  </Button>
                }
                style={{ maxWidth: 600, margin: '0 auto', textAlign: 'left', borderRadius: 10 }}
              />
            </div>
          ) : displayedInvoices.length === 0 ? (
            /* Trạng thái rỗng: Thông báo rõ ràng (Mục 5) */
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <Empty
                description={
                  <div>
                    <strong
                      style={{
                        fontSize: 16,
                        color: '#1e293b',
                        display: 'block',
                        marginBottom: 6,
                      }}
                    >
                      {searchKeyword || filterType !== 'ALL'
                        ? 'Không tìm thấy hóa đơn nào phù hợp với bộ lọc'
                        : 'Bạn chưa có hóa đơn nào'}
                    </strong>
                    <Text type="secondary" style={{ fontSize: 13.5, maxWidth: 480, display: 'inline-block' }}>
                      {searchKeyword || filterType !== 'ALL'
                        ? 'Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc chọn lại trạng thái hiển thị.'
                        : 'Hóa đơn các lượt khám chữa bệnh sau khi hoàn tất thanh toán tại phòng khám sẽ được tự động lưu trữ và hiển thị tại đây.'}
                    </Text>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                {searchKeyword || filterType !== 'ALL' ? (
                  <Button
                    onClick={() => {
                      setSearchKeyword('')
                      setFilterType('ALL')
                    }}
                    style={{ marginTop: 8 }}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : (
                  <Link to="/portal/book-appointment">
                    <Button type="primary" icon={<PlusOutlined />} style={{ background: '#2563eb', marginTop: 8 }}>
                      Đặt lịch khám ngay
                    </Button>
                  </Link>
                )}
              </Empty>
            </div>
          ) : (
            /* Danh sách các dòng / thẻ hóa đơn (Mục 1, 2) */
            <div>
              {displayedInvoices.map((inv) => {
                const cardClassModifier = inv.isAdjustment
                  ? 'is-adjustment-invoice'
                  : inv.hasBeenAdjusted
                  ? 'is-adjusted'
                  : 'is-original-valid'

                return (
                  <div
                    key={inv.invoiceId}
                    className={`portal-invoice-item-card ${cardClassModifier}`}
                    data-testid={`invoice-card-${inv.invoiceCode}`}
                  >
                    {/* Header thẻ hóa đơn: Ngày khám / Mã lượt khám / Trạng thái */}
                    <div className="portal-invoice-card-header">
                      <Space size={10} wrap align="center">
                        <div
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <CalendarOutlined />
                          <span>Ngày khám: {formatDate(inv.visitDate || inv.createdAt)}</span>
                          {inv.visitDate && (
                            <span style={{ fontWeight: 400, color: '#3b82f6' }}>
                              • {formatTime(inv.visitDate)}
                            </span>
                          )}
                        </div>

                        {inv.visitCode && (
                          <Tag color="geekblue" style={{ fontWeight: 600 }}>
                            Mã lượt: {inv.visitCode}
                          </Tag>
                        )}

                        {inv.specialtyName && (
                          <Tag color="blue" style={{ fontWeight: 500 }}>
                            {inv.specialtyName}
                          </Tag>
                        )}
                      </Space>

                      {/* Trạng thái hóa đơn (Mục 1, 4) */}
                      <div>
                        {inv.isAdjustment ? (
                          <Tag
                            color="blue"
                            icon={<CheckCircleOutlined />}
                            style={{ fontWeight: 700, fontSize: 12.5, padding: '3px 8px' }}
                          >
                            Hóa đơn điều chỉnh (Có hiệu lực)
                          </Tag>
                        ) : inv.hasBeenAdjusted ? (
                          <Tag
                            color="warning"
                            icon={<WarningOutlined />}
                            style={{ fontWeight: 700, fontSize: 12.5, padding: '3px 8px' }}
                          >
                            Đã có điều chỉnh
                          </Tag>
                        ) : (
                          <Tag
                            color="green"
                            icon={<CheckCircleOutlined />}
                            style={{ fontWeight: 600, fontSize: 12.5, padding: '3px 8px' }}
                          >
                            Hóa đơn gốc
                          </Tag>
                        )}
                      </div>
                    </div>

                    {/* Nội dung chi tiết thẻ */}
                    <div className="portal-invoice-card-body">
                      <Row gutter={[20, 16]} align="middle">
                        <Col xs={24} sm={14} md={15}>
                          {/* Mã hóa đơn nổi bật */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 13, color: '#64748b' }}>Mã hóa đơn:</span>
                            <span className="portal-invoice-code-badge">
                              <FileTextOutlined style={{ color: '#2563eb' }} />
                              {inv.invoiceCode}
                            </span>
                            <Tooltip title="Sao chép mã hóa đơn">
                              <CopyOutlined
                                style={{ color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
                                onClick={() => handleCopyCode(inv.invoiceCode, 'mã hóa đơn')}
                              />
                            </Tooltip>
                          </div>

                          {/* Bác sĩ khám và thông tin bổ trợ */}
                          <div className="portal-invoice-meta-row">
                            {inv.doctorName && (
                              <div className="portal-invoice-meta-item">
                                <UserOutlined style={{ color: '#2563eb' }} />
                                <span>
                                  Bác sĩ khám:{' '}
                                  <strong style={{ color: '#1e293b' }}>
                                    BS. {inv.doctorName}
                                  </strong>
                                </span>
                              </div>
                            )}

                            {inv.itemCount > 0 && (
                              <div className="portal-invoice-meta-item">
                                <Tag color="default" style={{ margin: 0 }}>
                                  {inv.itemCount} khoản mục dịch vụ
                                </Tag>
                              </div>
                            )}
                          </div>

                          {/* Cảnh báo rõ ràng nếu hóa đơn đã từng bị điều chỉnh (Mục 4) */}
                          {inv.hasBeenAdjusted && (
                            <div className="portal-invoice-adjusted-alert">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <InfoCircleOutlined style={{ color: '#d97706', fontSize: 15 }} />
                                <span>
                                  Hóa đơn gốc này đã được thay thế bởi hóa đơn điều chỉnh.
                                </span>
                              </div>
                              {inv.effectiveAdjustment && (
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0, fontWeight: 700, color: '#b45309' }}
                                  onClick={() => handleJumpToAdjustment(inv.effectiveAdjustment.invoiceId)}
                                >
                                  Xem bản điều chỉnh {inv.effectiveAdjustment.invoiceCode} <ArrowRightOutlined />
                                </Button>
                              )}
                            </div>
                          )}
                        </Col>

                        <Col xs={24} sm={10} md={9}>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: { xs: 'flex-start', sm: 'flex-end' },
                              gap: 12,
                            }}
                          >
                            {/* Tổng tiền viện phí */}
                            <div className="portal-invoice-amount-block">
                              <span className="portal-invoice-amount-label">Tổng tiền thanh toán</span>
                              <span className="portal-invoice-amount-value">
                                {formatCurrency(inv.totalAmount)}
                              </span>
                            </div>

                            {/* Các nút hành động: Tải hóa đơn (1-click) & Xem chi tiết */}
                            <div
                              className="portal-invoice-card-actions"
                              style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
                            >
                              <Button
                                className="portal-view-detail-btn"
                                icon={<EyeOutlined />}
                                onClick={() => handleOpenDetail(inv)}
                              >
                                Xem chi tiết
                              </Button>

                              <Button
                                type="primary"
                                className="portal-download-btn-primary"
                                icon={<DownloadOutlined />}
                                loading={downloadingId === inv.invoiceId}
                                onClick={() => handleDownloadInvoice(inv)}
                              >
                                Tải hóa đơn
                              </Button>
                            </div>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Hộp ghi chú bảo mật & giá trị chứng từ */}
          <div className="portal-security-note-box">
            <SafetyCertificateOutlined style={{ fontSize: 20, color: '#16a34a', flexShrink: 0 }} />
            <div>
              <strong>Bảo mật thông tin tài chính cá nhân:</strong> Mọi hóa đơn trên cổng thông tin đều được xác thực điện tử và liên kết chính chủ với mã bệnh nhân của bạn. Bản PDF tải về có giá trị pháp lý làm chứng từ thanh toán bảo hiểm y tế, quyết toán công ty và lưu trữ cá nhân.
            </div>
          </div>
        </div>
      </main>

      {/* Modal chi tiết hóa đơn */}
      <PatientInvoiceDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedInvoiceId(null)
          setSelectedInvoiceSummary(null)
        }}
        invoiceId={selectedInvoiceId}
        initialSummary={selectedInvoiceSummary}
        onSelectAdjustment={handleJumpToAdjustment}
      />
    </div>
  )
}

export default PatientMyInvoicesPage
