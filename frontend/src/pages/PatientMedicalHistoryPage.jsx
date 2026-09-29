import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Rate,
  Row,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  HomeOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  SearchOutlined,
  UserOutlined,
  ExperimentOutlined,
  StarFilled,
  StarOutlined,
  EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import patientPortalMedicalHistoryApi from '../api/patientPortalMedicalHistoryApi'
import satisfactionSurveyApi from '../api/satisfactionSurveyApi.js'
import SatisfactionSurveyModal from '../components/portal/SatisfactionSurveyModal.jsx'
import { SCORE_LABELS } from '../utils/satisfactionSurveyHelpers.js'
import MedicalHistoryDetailModal from '../components/portal/MedicalHistoryDetailModal'
import PatientNotificationBell from '../components/portal/PatientNotificationBell.jsx'
import './styles/patientMedicalHistory.css'

const { Title, Text } = Typography

function PatientMedicalHistoryPage() {
  const [historyList, setHistoryList] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [surveyFilter, setSurveyFilter] = useState('ALL') // 'ALL' | 'UNREVIEWED' | 'REVIEWED'

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedVisitId, setSelectedVisitId] = useState(null)
  const [selectedSummary, setSelectedSummary] = useState(null)

  // Khảo sát hài lòng sau khám (NCL-10-CN-005)
  const [surveyMap, setSurveyMap] = useState({})
  const [surveyModalOpen, setSurveyModalOpen] = useState(false)
  const [surveyTargetVisit, setSurveyTargetVisit] = useState(null)
  const [surveyTargetExisting, setSurveyTargetExisting] = useState(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const res = await patientPortalMedicalHistoryApi.getMedicalHistory()
      const data = res.data
      let list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []

      setHistoryList(list)

      if (list.length > 0) {
        // Tải trạng thái khảo sát đã gửi của từng lượt khám từ CSDL
        const results = await Promise.allSettled(
          list.map(async (item) => {
            if (!item.visitId) return null
            try {
              const sRes = await satisfactionSurveyApi.getByVisitId(item.visitId)
              if (sRes.data) {
                return { visitId: item.visitId, survey: sRes.data }
              }
            } catch {
              // Bỏ qua nếu chưa đánh giá
            }
            return null
          })
        )
        const map = {}
        results.forEach((r) => {
          if (r.status === 'fulfilled' && r.value) {
            map[r.value.visitId] = r.value.survey
          }
        })
        setSurveyMap(map)
      } else {
        setSurveyMap({})
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không thể tải lịch sử khám bệnh. Vui lòng thử lại sau.'
      setErrorMessage(msg)
      setHistoryList([])
      setSurveyMap({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const unreviewedCount = useMemo(() => {
    return historyList.filter((item) => !surveyMap[item.visitId]).length
  }, [historyList, surveyMap])

  const reviewedCount = useMemo(() => {
    return historyList.filter((item) => !!surveyMap[item.visitId]).length
  }, [historyList, surveyMap])

  const filteredHistory = useMemo(() => {
    let list = historyList
    if (surveyFilter === 'UNREVIEWED') {
      list = list.filter((item) => !surveyMap[item.visitId])
    } else if (surveyFilter === 'REVIEWED') {
      list = list.filter((item) => !!surveyMap[item.visitId])
    }

    if (!searchKeyword.trim()) return list
    const kw = searchKeyword.trim().toLowerCase()
    return list.filter((item) => {
      const doc = item.doctorName?.toLowerCase() || ''
      const spec = item.specialtyName?.toLowerCase() || ''
      const diag = item.diagnosisSummary?.toLowerCase() || ''
      return doc.includes(kw) || spec.includes(kw) || diag.includes(kw)
    })
  }, [historyList, searchKeyword, surveyFilter, surveyMap])

  const handleOpenDetail = (item) => {
    setSelectedVisitId(item.visitId)
    setSelectedSummary(item)
    setDetailModalOpen(true)
  }

  const handleOpenSurvey = (item, existing = null) => {
    setSurveyTargetVisit(item)
    setSurveyTargetExisting(existing)
    setSurveyModalOpen(true)
  }

  const handleSurveySuccess = (savedSurvey) => {
    if (savedSurvey && (savedSurvey.visitId || surveyTargetVisit?.visitId)) {
      const vid = savedSurvey.visitId || surveyTargetVisit.visitId
      setSurveyMap((prev) => ({
        ...prev,
        [vid]: savedSurvey,
      }))
    }
  }

  return (
    <div className="portal-medical-history-page">
      <header className="portal-medical-history-header">
        <div className="portal-medical-history-header-inner">
          <Link className="portal-booking-brand" to="/portal/dashboard">
            <span className="portal-booking-brand-icon">
              <MedicineBoxOutlined />
            </span>
            <span>
              <strong>BỆNH ÁN SỐ</strong>
              <small>Cổng thông tin bệnh nhân</small>
            </span>
          </Link>

          <Space size={10} wrap align="center">
            <PatientNotificationBell />
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
            <Link to="/portal/my-invoices">
              <Button className="portal-header-btn" icon={<FileTextOutlined style={{ color: '#2563eb' }} />}>
                Hóa đơn của tôi
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

      <main className="portal-medical-history-main">
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
                title: 'Lịch sử khám & Đơn thuốc',
              },
            ]}
          />
        </div>

        <div className="portal-history-card-wrapper">
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
                <FileDoneOutlined style={{ marginRight: 8 }} />
                Lịch sử khám bệnh & Đơn thuốc của tôi
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Xem lại chẩn đoán y khoa, đơn thuốc và lời dặn của bác sĩ từ các lượt khám đã hoàn tất
              </Text>
            </div>

            <Space size={8}>
              <Input
                placeholder="Tìm theo bác sĩ, chuyên khoa, chẩn đoán..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                style={{ width: 260, borderRadius: 8 }}
              />
              <Button icon={<ReloadOutlined />} onClick={fetchHistory} loading={loading}>
                Làm mới
              </Button>
            </Space>
          </div>

          {/* Bộ lọc theo trạng thái Đánh giá chất lượng sau khám */}
          {!loading && historyList.length > 0 && (
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Lọc theo đánh giá:</span>
              <Segmented
                value={surveyFilter}
                onChange={setSurveyFilter}
                options={[
                  {
                    label: (
                      <span style={{ padding: '0 4px' }}>
                        Tất cả lượt khám <b>({historyList.length})</b>
                      </span>
                    ),
                    value: 'ALL',
                  },
                  {
                    label: (
                      <span style={{ padding: '0 4px', color: unreviewedCount > 0 ? '#b45309' : undefined }}>
                        <StarOutlined style={{ marginRight: 4, color: '#f59e0b' }} />
                        Chờ đánh giá <b>({unreviewedCount})</b>
                      </span>
                    ),
                    value: 'UNREVIEWED',
                  },
                  {
                    label: (
                      <span style={{ padding: '0 4px', color: '#15803d' }}>
                        <CheckCircleOutlined style={{ marginRight: 4, color: '#16a34a' }} />
                        Đã gửi đánh giá <b>({reviewedCount})</b>
                      </span>
                    ),
                    value: 'REVIEWED',
                  },
                ]}
              />
            </div>
          )}

          {loading ? (
            <div style={{ padding: '24px 0' }}>
              {[1, 2, 3].map((k) => (
                <Card key={k} style={{ marginBottom: 12, borderRadius: 12 }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              ))}
            </div>
          ) : errorMessage ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <Alert
                type="error"
                message="Không thể tải lịch sử khám bệnh"
                description={
                  errorMessage.includes('Resource not found') || errorMessage.includes('404')
                    ? 'Không tìm thấy API trên máy chủ. Bạn vui lòng Restart lại Backend (Ctrl+C rồi chạy lại "mvn clean compile" và "mvn spring-boot:run") để hệ thống nạp các Endpoint mới.'
                    : errorMessage
                }
                showIcon
                action={
                  <Button type="primary" danger onClick={fetchHistory} style={{ marginTop: 4 }}>
                    Thử lại
                  </Button>
                }
                style={{ maxWidth: 640, margin: '0 auto', textAlign: 'left', borderRadius: 10 }}
              />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <Empty
                description={
                  <div>
                    <strong style={{ fontSize: 15, color: '#334155', display: 'block', marginBottom: 4 }}>
                      {surveyFilter !== 'ALL'
                        ? 'Không tìm thấy lượt khám nào phù hợp bộ lọc đánh giá đã chọn.'
                        : 'Chưa có lịch sử khám nào được ghi nhận.'}
                    </strong>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {surveyFilter !== 'ALL'
                        ? 'Bạn có thể chọn lại "Tất cả lượt khám" để xem danh sách đầy đủ.'
                        : 'Hồ sơ các ca khám sau khi hoàn tất và được bác sĩ ký duyệt sẽ hiển thị tại đây.'}
                    </Text>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                {surveyFilter !== 'ALL' ? (
                  <Button type="default" onClick={() => setSurveyFilter('ALL')} style={{ marginTop: 8 }}>
                    Xem tất cả lượt khám
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
            <div>
              {filteredHistory.map((item) => {
                const visitDayjs = item.visitAt ? dayjs(item.visitAt) : null
                const formattedDate = visitDayjs ? visitDayjs.format('DD/MM/YYYY') : '---'
                const formattedTime = visitDayjs ? visitDayjs.format('HH:mm') : '---'

                return (
                  <Card
                    key={item.visitId}
                    className="history-item-card"
                    bodyStyle={{ padding: '18px 20px' }}
                  >
                    <Row gutter={[16, 12]} align="middle">
                      <Col xs={24} md={16}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '3px 10px',
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <CalendarOutlined />
                            <span>{formattedDate}</span>
                            <span style={{ fontWeight: 400, color: '#3b82f6' }}>• {formattedTime}</span>
                          </div>

                          {item.specialtyName && (
                            <Tag color="blue" style={{ fontWeight: 600, fontSize: 12 }}>
                              {item.specialtyName}
                            </Tag>
                          )}

                          <Tag color="green" icon={<CheckCircleOutlined />}>
                            Đã hoàn tất khám
                          </Tag>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            fontSize: 13.5,
                            color: '#475569',
                          }}
                        >
                          <div>
                            <UserOutlined style={{ color: '#2563eb', marginRight: 6 }} />
                            <span>
                              Bác sĩ phụ trách:{' '}
                              <strong style={{ color: '#1e293b' }}>
                                {item.doctorName ? `BS. ${item.doctorName}` : '—'}
                              </strong>
                            </span>
                          </div>

                          <div style={{ marginTop: 2 }}>
                            <MedicineBoxOutlined style={{ color: '#2563eb', marginRight: 6 }} />
                            <span>
                              Chẩn đoán:{' '}
                              <strong style={{ color: '#0f172a' }}>
                                {item.diagnosisSummary || 'Chưa ghi nhận tóm tắt chẩn đoán'}
                              </strong>
                            </span>
                          </div>

                          <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileTextOutlined style={{ color: '#2563eb', marginRight: 2 }} />
                            <span>
                              Đơn thuốc:{' '}
                              <Tag color="geekblue" style={{ fontWeight: 600 }}>
                                {item.prescriptionCount || 0} loại thuốc
                              </Tag>
                            </span>
                          </div>
                        </div>
                      </Col>

                      <Col xs={24} md={8} style={{ textAlign: { xs: 'left', md: 'right' } }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Button
                            type="primary"
                            className="history-view-detail-btn"
                            icon={<EyeOutlined />}
                            onClick={() => handleOpenDetail(item)}
                            block
                          >
                            Xem chi tiết hồ sơ & đơn thuốc
                          </Button>
                          <Link to={`/portal/my-clinical-results?visitId=${item.visitId}`} style={{ display: 'block' }}>
                            <Button
                              icon={<ExperimentOutlined />}
                              style={{
                                borderRadius: 8,
                                borderColor: '#93c5fd',
                                color: '#1d4ed8',
                                background: '#eff6ff',
                                fontWeight: 600,
                              }}
                              block
                            >
                              Xem kết quả cận lâm sàng
                            </Button>
                          </Link>
                        </Space>
                      </Col>
                    </Row>

                    {/* Banner nhắc đánh giá gắn với lượt khám tương ứng (NCL-10-CN-005) */}
                    <div className="survey-banner-container" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #e2e8f0' }}>
                      {surveyMap[item.visitId] ? (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12,
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: 10,
                            padding: '10px 16px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontWeight: 600, margin: 0 }}>
                              Đã đánh giá
                            </Tag>
                            <Rate disabled value={surveyMap[item.visitId].score} style={{ fontSize: 15, color: '#f59e0b' }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
                              {surveyMap[item.visitId].score}/5 sao ({SCORE_LABELS[surveyMap[item.visitId].score] || 'Hài lòng'})
                            </span>
                            {surveyMap[item.visitId].comment && (
                              <span
                                style={{
                                  fontSize: 13,
                                  color: '#334155',
                                  fontStyle: 'italic',
                                  background: '#ffffff',
                                  padding: '2px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                &ldquo;{surveyMap[item.visitId].comment.length > 60
                                  ? `${surveyMap[item.visitId].comment.substring(0, 60)}...`
                                  : surveyMap[item.visitId].comment}&rdquo;
                              </span>
                            )}
                          </div>

                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            style={{ color: '#15803d', borderColor: '#86efac', fontWeight: 600, background: '#ffffff', borderRadius: 6 }}
                            onClick={() => handleOpenSurvey(item, surveyMap[item.visitId])}
                            id={`btn-edit-survey-${item.visitId}`}
                          >
                            Đã đánh giá — Sửa
                          </Button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12,
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: 10,
                            padding: '10px 16px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <StarFilled style={{ color: '#f59e0b', fontSize: 18 }} />
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginRight: 6 }}>
                                Khảo sát chất lượng phục vụ ca khám này
                              </span>
                              <span style={{ fontSize: 12, color: '#78350f' }}>
                                (Ý kiến của bạn giúp phòng khám không ngừng nâng cao chất lượng điều trị)
                              </span>
                            </div>
                          </div>

                          <Button
                            size="small"
                            type="primary"
                            icon={<StarOutlined />}
                            style={{
                              background: '#f59e0b',
                              borderColor: '#f59e0b',
                              fontWeight: 600,
                              borderRadius: 6,
                              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.25)',
                            }}
                            onClick={() => handleOpenSurvey(item, null)}
                            id={`btn-survey-${item.visitId}`}
                          >
                            Đánh giá lượt khám này
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <MedicalHistoryDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedVisitId(null)
          setSelectedSummary(null)
        }}
        visitId={selectedVisitId}
        initialSummary={selectedSummary}
        survey={selectedVisitId ? surveyMap[selectedVisitId] : null}
        onOpenSurvey={(visit, existing) => handleOpenSurvey(visit, existing)}
      />

      <SatisfactionSurveyModal
        open={surveyModalOpen}
        onClose={() => {
          setSurveyModalOpen(false)
          setSurveyTargetVisit(null)
          setSurveyTargetExisting(null)
        }}
        visit={surveyTargetVisit}
        existingSurvey={surveyTargetExisting}
        onSuccess={handleSurveySuccess}
      />
    </div>
  )
}

export default PatientMedicalHistoryPage
