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
  Row,
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
} from '@ant-design/icons'
import dayjs from 'dayjs'

import patientPortalMedicalHistoryApi from '../api/patientPortalMedicalHistoryApi'
import MedicalHistoryDetailModal from '../components/portal/MedicalHistoryDetailModal'
import PatientNotificationBell from '../components/portal/PatientNotificationBell.jsx'
import { getApiErrorMessage } from '../utils/apiError'
import './styles/patientMedicalHistory.css'

const { Title, Text } = Typography

function PatientMedicalHistoryPage() {
  const [historyList, setHistoryList] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedVisitId, setSelectedVisitId] = useState(null)
  const [selectedSummary, setSelectedSummary] = useState(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const res = await patientPortalMedicalHistoryApi.getMedicalHistory()
      const data = res.data
      const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []
      setHistoryList(list)
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Không thể tải lịch sử khám bệnh. Vui lòng thử lại sau.')
      setErrorMessage(msg)
      setHistoryList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const filteredHistory = useMemo(() => {
    if (!searchKeyword.trim()) return historyList
    const kw = searchKeyword.trim().toLowerCase()
    return historyList.filter((item) => {
      const doc = item.doctorName?.toLowerCase() || ''
      const spec = item.specialtyName?.toLowerCase() || ''
      const diag = item.diagnosisSummary?.toLowerCase() || ''
      return doc.includes(kw) || spec.includes(kw) || diag.includes(kw)
    })
  }, [historyList, searchKeyword])

  const handleOpenDetail = (item) => {
    setSelectedVisitId(item.visitId)
    setSelectedSummary(item)
    setDetailModalOpen(true)
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
                      Chưa có lịch sử khám nào được ghi nhận.
                    </strong>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Hồ sơ các ca khám sau khi hoàn tất và được bác sĩ ký duyệt sẽ hiển thị tại đây.
                    </Text>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Link to="/portal/book-appointment">
                  <Button type="primary" icon={<PlusOutlined />} style={{ background: '#2563eb', marginTop: 8 }}>
                    Đặt lịch khám ngay
                  </Button>
                </Link>
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
      />
    </div>
  )
}

export default PatientMedicalHistoryPage
