import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  Input,
  Radio,
  Row,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FilePdfOutlined,
  FileProtectOutlined,
  FilterOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'

import patientPortalClinicalResultApi from '../api/patientPortalClinicalResultApi'
import patientPortalMedicalHistoryApi from '../api/patientPortalMedicalHistoryApi'
import PatientClinicalResultDetailModal from '../components/portal/PatientClinicalResultDetailModal'
import PatientNotificationBell from '../components/portal/PatientNotificationBell.jsx'
import { useAuthContext } from '../context/AuthContext'
import {
  downloadPdfBlob,
  filterConfirmedResults,
  formatDate,
  formatDateTime,
  formatTime,
  getAbnormalFlagInfo,
  getSecuritySafeErrorMessage,
  getServiceCategory,
  isPostVisitResult,
  isRecentResult,
  isValidUuid,
} from '../utils/patientClinicalResultHelpers'
import './styles/patientMyClinicalResults.css'

const { Title, Text, Paragraph } = Typography

function PatientMyClinicalResultsPage() {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Danh sách lượt khám của bệnh nhân
  const [visits, setVisits] = useState([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [selectedVisitId, setSelectedVisitId] = useState(null)

  // Danh sách kết quả CLS theo lượt khám (bản map { [visitId]: results[] })
  const [resultsCache, setResultsCache] = useState({})
  const [loadingResults, setLoadingResults] = useState(false)
  const [downloadingVisitId, setDownloadingVisitId] = useState(null)
  const [downloadingResultId, setDownloadingResultId] = useState(null)

  // Bộ lọc & tìm kiếm
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterType, setFilterType] = useState('ALL') // 'ALL', 'RECENT', 'HAS_RESULTS'

  // Thông báo lỗi thân thiện & bảo mật
  const [securityError, setSecurityError] = useState('')

  // Modal chi tiết
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedResultId, setSelectedResultId] = useState(null)
  const [selectedResultSummary, setSelectedResultSummary] = useState(null)

  const handleLogout = () => {
    logout()
    navigate('/portal/login', { replace: true })
  }

  // 1. Tải danh sách lượt khám của bệnh nhân
  const fetchVisits = useCallback(async () => {
    setLoadingVisits(true)
    setSecurityError('')
    try {
      const res = await patientPortalMedicalHistoryApi.getMedicalHistory()
      const data = res.data
      const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []
      // Sắp xếp ngày khám mới nhất lên đầu
      const sorted = [...list].sort((a, b) => new Date(b.visitAt || 0) - new Date(a.visitAt || 0))
      setVisits(sorted)
      return sorted
    } catch (err) {
      const safeMsg = getSecuritySafeErrorMessage(err)
      setSecurityError(safeMsg)
      setVisits([])
      return []
    } finally {
      setLoadingVisits(false)
    }
  }, [])

  // 2. Tải kết quả cận lâm sàng của một lượt khám
  const fetchResultsForVisit = useCallback(async (visitId) => {
    if (!visitId) return []

    // Ràng buộc bảo mật: Ngăn chặn ID số tuần tự hoặc chuỗi rác trên URL
    if (!isValidUuid(visitId)) {
      setSecurityError('Mã lượt khám không hợp lệ. Vui lòng chọn lượt khám từ danh sách của bạn.')
      return []
    }

    setLoadingResults(true)
    try {
      const res = await patientPortalClinicalResultApi.getClinicalResultsByVisit(visitId)
      const data = Array.isArray(res.data) ? res.data : []
      // RÀNG BUỘC NGHIỆP VỤ BẮT BUỘC: CHỈ HIỂN THỊ KẾT QUẢ ĐÃ XÁC NHẬN (status === 'FINAL')
      const confirmedOnly = filterConfirmedResults(data)

      setResultsCache((prev) => ({
        ...prev,
        [visitId]: confirmedOnly,
      }))
      return confirmedOnly
    } catch (err) {
      const safeMsg = getSecuritySafeErrorMessage(err)
      setSecurityError(safeMsg)
      return []
    } finally {
      setLoadingResults(false)
    }
  }, [])

  // Khởi động trang và xử lý tham số URL ban đầu
  useEffect(() => {
    const init = async () => {
      const loadedVisits = await fetchVisits()
      if (loadedVisits.length === 0) return

      // Đọc visitId từ search param hoặc router state
      const urlVisitId = searchParams.get('visitId') || location.state?.visitId

      if (urlVisitId) {
        if (!isValidUuid(urlVisitId)) {
          // Ràng buộc bảo mật: Cố tình nhập số tuần tự (1, 2, 3...)
          setSecurityError('Không tìm thấy kết quả cận lâm sàng của lượt khám này hoặc bạn không có quyền truy cập.')
          setSelectedVisitId(loadedVisits[0]?.visitId)
          fetchResultsForVisit(loadedVisits[0]?.visitId)
          return
        }

        // Kiểm tra xem visitId có thuộc danh sách của bệnh nhân hay không
        const existsInList = loadedVisits.some((v) => v.visitId === urlVisitId)
        if (existsInList) {
          setSelectedVisitId(urlVisitId)
          fetchResultsForVisit(urlVisitId)
        } else {
          // Bệnh nhân sửa mã trên URL để truy cập lượt khám của người khác: Từ chối thân thiện
          setSecurityError('Không tìm thấy kết quả cận lâm sàng của lượt khám này hoặc bạn không có quyền truy cập.')
          setSelectedVisitId(loadedVisits[0]?.visitId)
          fetchResultsForVisit(loadedVisits[0]?.visitId)
        }
      } else {
        // Mặc định chọn lượt khám đầu tiên
        const firstId = loadedVisits[0]?.visitId
        setSelectedVisitId(firstId)
        fetchResultsForVisit(firstId)
      }
    }

    init()
  }, [fetchVisits, fetchResultsForVisit, searchParams, location.state])

  // Chuyển chọn lượt khám
  const handleSelectVisit = (visitId) => {
    setSecurityError('')
    setSelectedVisitId(visitId)
    setSearchParams({ visitId })
    if (!resultsCache[visitId]) {
      fetchResultsForVisit(visitId)
    }
  }

  // Lượt khám hiện tại đang chọn
  const currentVisit = useMemo(() => {
    return visits.find((v) => v.visitId === selectedVisitId) || null
  }, [visits, selectedVisitId])

  // Danh sách kết quả của lượt khám hiện tại
  const currentResults = useMemo(() => {
    return resultsCache[selectedVisitId] || []
  }, [resultsCache, selectedVisitId])

  // Tải ngầm số lượng kết quả cho tất cả các lượt khám để gắn badge (chỉ khi có ít hơn 10 lượt khám)
  useEffect(() => {
    if (visits.length > 0) {
      visits.forEach((v) => {
        if (!resultsCache[v.visitId]) {
          patientPortalClinicalResultApi
            .getClinicalResultsByVisit(v.visitId)
            .then((res) => {
              const list = filterConfirmedResults(res.data)
              setResultsCache((prev) => ({
                ...prev,
                [v.visitId]: list,
              }))
            })
            .catch(() => {
              // Bỏ qua lỗi ngầm, không gây phiền bệnh nhân
            })
        }
      })
    }
  }, [visits])

  // Đánh dấu lượt khám nào có kết quả mới hoặc trả sau
  const visitMetaMap = useMemo(() => {
    const map = {}
    visits.forEach((v) => {
      const resList = resultsCache[v.visitId] || []
      const hasResults = resList.length > 0
      const hasRecent = resList.some((r) => isRecentResult(r.enteredAt))
      const hasPostVisit = resList.some((r) => isPostVisitResult(r.enteredAt, v.visitAt))
      map[v.visitId] = {
        count: resList.length,
        hasResults,
        hasRecent,
        hasPostVisit,
        isNew: hasRecent || hasPostVisit,
      }
    })
    return map
  }, [visits, resultsCache])

  // Lọc danh sách lượt khám
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      const meta = visitMetaMap[v.visitId] || { count: 0, isNew: false, hasResults: false }

      // Lọc theo loại
      if (filterType === 'RECENT' && !meta.isNew) return false
      if (filterType === 'HAS_RESULTS' && !meta.hasResults) return false

      // Lọc theo từ khóa
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase()
        const doc = (v.doctorName || '').toLowerCase()
        const spec = (v.specialtyName || '').toLowerCase()
        const diag = (v.diagnosisSummary || '').toLowerCase()
        return doc.includes(kw) || spec.includes(kw) || diag.includes(kw)
      }
      return true
    })
  }, [visits, visitMetaMap, filterType, searchKeyword])

  // Thống kê tổng quan
  const stats = useMemo(() => {
    let totalConfirmedResults = 0
    let visitsWithResults = 0
    let visitsWithNewResults = 0

    visits.forEach((v) => {
      const meta = visitMetaMap[v.visitId]
      if (meta) {
        totalConfirmedResults += meta.count
        if (meta.hasResults) visitsWithResults += 1
        if (meta.isNew) visitsWithNewResults += 1
      }
    })

    return {
      totalVisits: visits.length,
      totalConfirmedResults,
      visitsWithResults,
      visitsWithNewResults,
    }
  }, [visits, visitMetaMap])

  // 1-Click Tải trọn bộ kết quả của lượt khám (PDF)
  const handleDownloadVisitPdf = async () => {
    if (!selectedVisitId) return
    setDownloadingVisitId(selectedVisitId)
    try {
      const res = await patientPortalClinicalResultApi.downloadVisitResultsPdf(selectedVisitId)
      const filename = `phieu-can-lam-sang-${formatDate(currentVisit?.visitAt)}.pdf`
      downloadPdfBlob(res.data, filename)
      message.success('Đã tải phiếu kết quả cận lâm sàng tổng hợp của lượt khám!')
    } catch (err) {
      const msg = getSecuritySafeErrorMessage(err)
      message.error(msg)
    } finally {
      setDownloadingVisitId(null)
    }
  }

  // 1-Click Tải kết quả lẻ (PDF)
  const handleDownloadSinglePdf = async (result) => {
    if (!result?.clinicalResultId) return
    setDownloadingResultId(result.clinicalResultId)
    try {
      const res = await patientPortalClinicalResultApi.downloadResultPdf(result.clinicalResultId)
      const filename = `ket-qua-${result.serviceCode || 'CLS'}-${formatDate(result.enteredAt)}.pdf`
      downloadPdfBlob(res.data, filename)
      message.success(`Đã tải phiếu kết quả: ${result.serviceName}!`)
    } catch (err) {
      const msg = getSecuritySafeErrorMessage(err)
      message.error(msg)
    } finally {
      setDownloadingResultId(null)
    }
  }

  // Mở modal xem chi tiết
  const handleOpenDetailModal = (result) => {
    setSelectedResultId(result.clinicalResultId)
    setSelectedResultSummary(result)
    setModalOpen(true)
  }

  return (
    <div className="portal-clinical-results-page">
      {/* Top Header */}
      <header className="portal-clinical-results-header">
        <div className="portal-clinical-results-header-inner">
          <Link className="portal-dashboard-brand" to="/portal/dashboard">
            <span className="portal-dashboard-brand-icon">
              <MedicineBoxOutlined />
            </span>
            <span>
              <strong>BỆNH ÁN SỐ</strong>
              <small>Cổng thông tin bệnh nhân</small>
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PatientNotificationBell />
            <div className="portal-user-chip">
              <div className="portal-user-avatar">
                <UserOutlined />
              </div>
              <div className="portal-user-meta">
                <span className="portal-user-phone-name">
                  {user?.fullName && user.fullName !== user.username
                    ? user.fullName
                    : (user?.username || 'Bệnh nhân')}
                </span>
                <span className="portal-user-role-badge">
                  <span className="portal-role-dot" />
                  Bệnh nhân
                </span>
              </div>
            </div>

            <Button
              className="portal-logout-btn"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="portal-clinical-results-main">
        {/* Breadcrumb Navigation */}
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            {
              title: (
                <Link to="/portal/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <HomeOutlined /> Trang chủ Cổng bệnh nhân
                </Link>
              ),
            },
            {
              title: (
                <Link to="/portal/medical-history" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileDoneOutlined /> Lịch sử khám
                </Link>
              ),
            },
            {
              title: 'Kết quả cận lâm sàng của tôi',
            },
          ]}
        />

        {/* Page Title & Quick Actions */}
        <div className="portal-page-title-box">
          <div className="portal-page-title-row">
            <div>
              <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>
                🔬 Kết quả cận lâm sàng của tôi
              </Title>
              <Text type="secondary" style={{ fontSize: 13.5 }}>
                Xem và tải các kết quả xét nghiệm, chẩn đoán hình ảnh chính thức đã được bác sĩ xác nhận
              </Text>
            </div>

            <Space size={8} wrap>
              <Link to="/portal/medical-history">
                <Button icon={<ArrowLeftOutlined />} style={{ borderRadius: 8 }}>
                  Về lịch sử khám
                </Button>
              </Link>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchVisits()
                  if (selectedVisitId) fetchResultsForVisit(selectedVisitId)
                }}
                loading={loadingVisits || loadingResults}
                style={{ borderRadius: 8 }}
              >
                Làm mới
              </Button>
            </Space>
          </div>
        </div>

        {/* Thông báo bảo mật thân thiện (nếu có lỗi truy cập) */}
        {securityError && (
          <Alert
            type="warning"
            showIcon
            message="Thông báo bảo mật"
            description={securityError}
            closable
            onClose={() => setSecurityError('')}
            style={{ marginBottom: 20, borderRadius: 12 }}
          />
        )}

        {/* Stats Overview Banner */}
        <div className="portal-cr-stats-grid">
          <div className="portal-cr-stat-card">
            <div className="portal-cr-stat-icon blue">
              <ExperimentOutlined />
            </div>
            <div className="portal-cr-stat-info">
              <span className="portal-cr-stat-label">Tổng kết quả đã xác nhận</span>
              <span className="portal-cr-stat-value">{stats.totalConfirmedResults}</span>
            </div>
          </div>

          <div className="portal-cr-stat-card">
            <div className="portal-cr-stat-icon green">
              <FileProtectOutlined />
            </div>
            <div className="portal-cr-stat-info">
              <span className="portal-cr-stat-label">Lượt khám có kết quả CLS</span>
              <span className="portal-cr-stat-value">{stats.visitsWithResults} / {stats.totalVisits}</span>
            </div>
          </div>

          <div className="portal-cr-stat-card">
            <div className="portal-cr-stat-icon orange">
              <ClockCircleOutlined />
            </div>
            <div className="portal-cr-stat-info">
              <span className="portal-cr-stat-label">Lượt khám vừa có kết quả mới</span>
              <span className="portal-cr-stat-value">{stats.visitsWithNewResults}</span>
            </div>
          </div>
        </div>

        {/* Kiểm tra trường hợp bệnh nhân chưa từng có lượt khám nào */}
        {loadingVisits ? (
          <Card style={{ borderRadius: 14 }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        ) : visits.length === 0 ? (
          <Card style={{ borderRadius: 14, textAlign: 'center', padding: '40px 20px' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Title level={4} style={{ color: '#1e293b' }}>
                    Chưa có kết quả cận lâm sàng nào
                  </Title>
                  <Paragraph type="secondary" style={{ maxWidth: 460, margin: '0 auto' }}>
                    Bạn chưa có lượt khám hoặc kết quả xét nghiệm / chẩn đoán hình ảnh nào được lưu trữ trong hệ thống.
                  </Paragraph>
                </div>
              }
            >
              <Link to="/portal/dashboard">
                <Button type="primary" style={{ borderRadius: 8, background: '#2563eb' }}>
                  Quay lại trang chủ Cổng bệnh nhân
                </Button>
              </Link>
            </Empty>
          </Card>
        ) : (
          /* Cấu trúc phân cấp: Danh sách lượt khám (trái) → Chi tiết kết quả của lượt khám (phải) */
          <div className="portal-cr-layout">
            {/* CỘT TRÁI: DANH SÁCH LƯỢT KHÁM */}
            <div className="portal-visits-sidebar">
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    📅 Lượt khám của bạn ({visits.length})
                  </span>
                </div>

                {/* Ô tìm kiếm lượt khám */}
                <Input
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Tìm bác sĩ, chuyên khoa, chẩn đoán..."
                  allowClear
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  style={{ borderRadius: 8, marginBottom: 10 }}
                />

                {/* Bộ lọc loại kết quả */}
                <Radio.Group
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  size="small"
                  style={{ width: '100%', display: 'flex' }}
                  buttonStyle="solid"
                >
                  <Radio.Button value="ALL" style={{ flex: 1, textAlign: 'center', fontSize: 11.5 }}>
                    Tất cả
                  </Radio.Button>
                  <Radio.Button value="RECENT" style={{ flex: 1.2, textAlign: 'center', fontSize: 11.5 }}>
                    🔥 Có kết quả mới
                  </Radio.Button>
                  <Radio.Button value="HAS_RESULTS" style={{ flex: 1.1, textAlign: 'center', fontSize: 11.5 }}>
                    Đã có CLS
                  </Radio.Button>
                </Radio.Group>
              </div>

              {/* Danh sách các lượt khám */}
              <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
                {filteredVisits.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Không tìm thấy lượt khám phù hợp"
                    style={{ padding: '20px 0' }}
                  />
                ) : (
                  filteredVisits.map((item) => {
                    const isSelected = item.visitId === selectedVisitId
                    const meta = visitMetaMap[item.visitId] || { count: 0, isNew: false, hasResults: false }

                    return (
                      <div
                        key={item.visitId}
                        className={`portal-visit-item ${isSelected ? 'active' : ''}`}
                        onClick={() => handleSelectVisit(item.visitId)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                            <CalendarOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                            {formatDate(item.visitAt)}
                            <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginLeft: 6 }}>
                              {formatTime(item.visitAt)}
                            </span>
                          </span>

                          {meta.isNew && (
                            <Badge
                              count="Vừa có kết quả mới"
                              style={{
                                backgroundColor: '#ea580c',
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 700,
                                boxShadow: '0 0 0 1px #fff',
                              }}
                            />
                          )}
                        </div>

                        <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 3 }}>
                          <strong>BS:</strong> {item.doctorName || 'Bác sĩ phụ trách'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                          <strong>Khoa:</strong> {item.specialtyName || 'Đa khoa'}
                        </div>

                        {item.diagnosisSummary && (
                          <div
                            style={{
                              fontSize: 12,
                              color: '#475569',
                              background: isSelected ? '#dbeafe' : '#f1f5f9',
                              padding: '4px 8px',
                              borderRadius: 6,
                              marginBottom: 8,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.diagnosisSummary}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          {meta.hasResults ? (
                            <Tag color="cyan" style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, margin: 0 }}>
                              <ExperimentOutlined style={{ marginRight: 4 }} />
                              {meta.count} chỉ định có kết quả
                            </Tag>
                          ) : (
                            <Tag color="default" style={{ fontSize: 11, borderRadius: 6, margin: 0 }}>
                              Chưa có kết quả CLS
                            </Tag>
                          )}

                          {meta.hasPostVisit && (
                            <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>
                              Trả sau
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* CỘT PHẢI: KẾT QUẢ CẬN LÂM SÀNG CỦA LƯỢT KHÁM ĐANG CHỌN */}
            <div className="portal-results-content">
              {currentVisit ? (
                <div>
                  {/* Header của lượt khám đang xem */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '16px 20px',
                      marginBottom: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                          Lượt khám ngày {formatDate(currentVisit.visitAt)} ({formatTime(currentVisit.visitAt)})
                        </span>
                        <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, margin: 0 }}>
                          {currentVisit.specialtyName || 'Khám chuyên khoa'}
                        </Tag>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                        Bác sĩ khám: <strong>{currentVisit.doctorName}</strong>
                        {currentVisit.diagnosisSummary && (
                          <span> • Chẩn đoán: <em>{currentVisit.diagnosisSummary}</em></span>
                        )}
                      </div>
                    </div>

                    {/* Nút 1-Click tải trọn bộ kết quả của lượt khám */}
                    {currentResults.length > 0 && (
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        loading={downloadingVisitId === currentVisit.visitId}
                        onClick={handleDownloadVisitPdf}
                        style={{
                          background: '#2563eb',
                          borderColor: '#2563eb',
                          borderRadius: 8,
                          fontWeight: 600,
                          height: 38,
                        }}
                      >
                        Tải trọn bộ kết quả (PDF)
                      </Button>
                    )}
                  </div>

                  {/* Danh sách các kết quả chi tiết của lượt khám */}
                  {loadingResults ? (
                    <div style={{ padding: '20px 0' }}>
                      <Skeleton active paragraph={{ rows: 6 }} />
                    </div>
                  ) : currentResults.length === 0 ? (
                    /* RÀNG BUỘC NGHIỆP VỤ: Nếu chưa có kết quả xác nhận nào -> hiển thị như chưa có kết quả */
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
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                              Chưa có kết quả cận lâm sàng cho lượt khám này
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', maxWidth: 440, margin: '0 auto' }}>
                              Lượt khám này chưa có chỉ định cận lâm sàng nào được bác sĩ xác nhận kết quả chính thức.
                              Nếu bạn vừa thực hiện xét nghiệm, kết quả sẽ tự động hiển thị tại đây ngay khi bác sĩ hoàn tất xét duyệt.
                            </div>
                          </div>
                        }
                      />
                    </Card>
                  ) : (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 14,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>
                          📋 DANH SÁCH CHỈ ĐỊNH CẬN LÂM SÀNG ({currentResults.length})
                        </span>
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                          <CheckCircleOutlined style={{ marginRight: 4 }} />
                          100% kết quả đã xác nhận (FINAL)
                        </span>
                      </div>

                      {/* Danh sách từng chỉ định kết quả */}
                      {currentResults.map((result, idx) => {
                        const cat = getServiceCategory(result.serviceCode, result.serviceName)
                        const abnormal = getAbnormalFlagInfo(result.abnormalFlag)
                        const isPost = isPostVisitResult(result.enteredAt, currentVisit.visitAt)

                        return (
                          <div
                            key={result.clinicalResultId || idx}
                            className={`portal-result-card ${abnormal.isAbnormal ? 'abnormal' : 'normal'}`}
                          >
                            {/* Tiêu đề chỉ định */}
                            <div className="portal-result-card-header">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: cat.color === 'purple' ? '#faf5ff' : '#eff6ff',
                                    color: cat.color === 'purple' ? '#9333ea' : '#2563eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 16,
                                  }}
                                >
                                  <ExperimentOutlined />
                                </div>
                                <div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                                    {result.serviceName}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#64748b' }}>
                                    Mã: <strong>{result.serviceCode || 'CLS'}</strong> • Ngày có kết quả:{' '}
                                    <strong>{formatDateTime(result.enteredAt)}</strong>
                                  </div>
                                </div>
                              </div>

                              <Space size={6} wrap>
                                {isPost && (
                                  <Tag color="orange" style={{ fontWeight: 600, borderRadius: 6, margin: 0 }}>
                                    <ClockCircleOutlined style={{ marginRight: 4 }} /> Kết quả trả sau
                                  </Tag>
                                )}
                                <Tag color={cat.color} style={{ fontWeight: 600, borderRadius: 6, margin: 0 }}>
                                  {cat.label}
                                </Tag>
                                <Tag
                                  color="green"
                                  icon={<SafetyCertificateOutlined />}
                                  style={{ fontWeight: 600, borderRadius: 6, margin: 0 }}
                                >
                                  Đã duyệt (FINAL)
                                </Tag>
                              </Space>
                            </div>

                            {/* Chi tiết nội dung / chỉ số kết quả */}
                            {result.resultType === 'NUMBER' ? (
                              <div className="portal-result-value-box">
                                <div>
                                  <div style={{ fontSize: 12, color: '#64748b' }}>Giá trị đo được:</div>
                                  <div className="portal-result-value-big" style={{ color: abnormal.textColor }}>
                                    {result.numericValue != null ? result.numericValue : '—'}
                                    <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b', marginLeft: 4 }}>
                                      {result.unit || ''}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 12, color: '#64748b' }}>Khoảng tham chiếu chuẩn:</div>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                                    {result.referenceRange ||
                                      `${result.lowerBound ?? '—'} - ${result.upperBound ?? '—'}`}{' '}
                                    {result.unit || ''}
                                  </div>
                                </div>

                                <div>
                                  <Tag color={abnormal.color} style={{ fontSize: 12, fontWeight: 600, borderRadius: 6 }}>
                                    {abnormal.text}
                                  </Tag>
                                </div>
                              </div>
                            ) : (
                              <div className="portal-result-value-box">
                                <div>
                                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Kết quả định tính:</div>
                                  <div style={{ fontSize: 14, color: '#1e293b', fontWeight: 500 }}>
                                    {result.textValue || 'Đã ghi nhận kết quả theo chuyên môn'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Kết luận của bác sĩ */}
                            {result.conclusion && (
                              <div className="portal-result-conclusion-box">
                                <strong>Kết luận: </strong>
                                <span>{result.conclusion}</span>
                              </div>
                            )}

                            {/* Bác sĩ thực hiện & Các nút hành động */}
                            <div className="portal-result-actions">
                              <div style={{ fontSize: 12.5, color: '#64748b' }}>
                                Bác sĩ / Kỹ thuật viên: <strong style={{ color: '#1e293b' }}>{result.doctorName || 'BS chuyên khoa'}</strong>
                              </div>

                              <Space size={8} wrap>
                                <Button
                                  size="small"
                                  icon={<EyeOutlined />}
                                  onClick={() => handleOpenDetailModal(result)}
                                  style={{ borderRadius: 6 }}
                                >
                                  Xem chi tiết & chỉ số
                                </Button>
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<FilePdfOutlined />}
                                  loading={downloadingResultId === result.clinicalResultId}
                                  onClick={() => handleDownloadSinglePdf(result)}
                                  style={{
                                    background: '#2563eb',
                                    borderColor: '#2563eb',
                                    borderRadius: 6,
                                    fontWeight: 600,
                                  }}
                                >
                                  Tải bản đọc được (PDF)
                                </Button>
                              </Space>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Empty description="Vui lòng chọn một lượt khám từ danh sách bên trái để xem kết quả" />
              )}
            </div>
          </div>
        )}

        {/* Khung hướng dẫn y khoa thân thiện */}
        <div className="portal-medical-guide-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#0369a1', fontWeight: 700 }}>
            <InfoCircleOutlined />
            <span>Hướng dẫn dành cho bệnh nhân khi đọc kết quả cận lâm sàng</span>
          </div>
          <Row gutter={[16, 8]}>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 12.5, color: '#475569' }}>
                <strong style={{ color: '#0f172a' }}>1. Khoảng tham chiếu là gì?</strong>
                <div>
                  Là khoảng giá trị bình thường được đo trên 95% người khỏe mạnh. Chỉ số nằm ngoài khoảng này chưa chắc là bệnh lý nguy hiểm.
                </div>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 12.5, color: '#475569' }}>
                <strong style={{ color: '#0f172a' }}>2. Kết quả trả sau là gì?</strong>
                <div>
                  Một số xét nghiệm chuyên sâu cần thời gian nuôi cấy hoặc phân tích phòng Lab. Kết quả sẽ được cập nhật đúng lượt khám khi có duyệt của bác sĩ.
                </div>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 12.5, color: '#475569' }}>
                <strong style={{ color: '#0f172a' }}>3. Tư vấn bác sĩ</strong>
                <div>
                  Mọi kết luận và chỉ định dùng thuốc luôn phải dựa trên tư vấn trực tiếp của bác sĩ khám bệnh. Không tự ý thay đổi liều lượng thuốc.
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </main>

      {/* Modal xem chi tiết chỉ số */}
      <PatientClinicalResultDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        resultId={selectedResultId}
        initialSummary={selectedResultSummary}
      />
    </div>
  )
}

export default PatientMyClinicalResultsPage
