import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Descriptions, Tag, Tooltip, message, Row, Col, Space } from 'antd'
import {
  MedicineBoxOutlined,
  LogoutOutlined,
  SearchOutlined,
  FileTextOutlined,
  UserOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ArrowRightOutlined,
  HeartFilled,
  BarcodeOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  ExperimentOutlined,
  TeamOutlined,
  InfoCircleOutlined,
  StarFilled,
  StarOutlined,
  EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthContext } from '../context/AuthContext'
import PatientNotificationBell from '../components/portal/PatientNotificationBell.jsx'
import patientPortalAppointmentApi from '../api/patientPortalAppointmentApi.js'
import patientPortalMedicalHistoryApi from '../api/patientPortalMedicalHistoryApi'
import satisfactionSurveyApi from '../api/satisfactionSurveyApi.js'
import SatisfactionSurveyModal from '../components/portal/SatisfactionSurveyModal.jsx'
import { SCORE_LABELS } from '../utils/satisfactionSurveyHelpers.js'
import {
  createDefaultFallbackProfiles,
  formatProfileAge,
  formatProfileRelationship,
  getAvatarColor,
  getProfileInitials,
} from '../utils/familyAppointmentHelpers.js'
import './styles/portalDashboard.css'

function PortalDashboard() {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()
  const [linkedProfiles, setLinkedProfiles] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(false)

  // Khảo sát hài lòng sau khám (NCL-10-CN-005)
  const [surveyVisit, setSurveyVisit] = useState(null)
  const [surveyRecord, setSurveyRecord] = useState(null)
  const [surveyModalOpen, setSurveyModalOpen] = useState(false)
  const [surveyInitialScore, setSurveyInitialScore] = useState(null)

  useEffect(() => {
    let isMounted = true
    setProfilesLoading(true)

    let unlinkedIds = []
    try {
      unlinkedIds = JSON.parse(localStorage.getItem('portal_unlinked_guardian_profiles') || '[]')
    } catch {
      unlinkedIds = []
    }

    patientPortalAppointmentApi
      .getLinkedProfiles()
      .then((res) => {
        if (!isMounted) return
        let list = Array.isArray(res.data) && res.data.length > 0 ? res.data : []
        if (list.length === 0) {
          list = createDefaultFallbackProfiles(user)
        }
        setLinkedProfiles(list.filter((p) => !unlinkedIds.includes(String(p.patientId || p.id))))
      })
      .catch(() => {
        if (!isMounted) return
        const fallback = createDefaultFallbackProfiles(user).filter(
          (p) => !unlinkedIds.includes(String(p.patientId || p.id))
        )
        setLinkedProfiles(fallback)
      })
      .finally(() => {
        if (isMounted) setProfilesLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    let isMounted = true

    const loadDashboardSurvey = async () => {
      try {
        const res = await patientPortalMedicalHistoryApi.getMedicalHistory()
        const data = res.data
        const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []
        if (list.length > 0) {
          const latest = list[0]
          if (!isMounted) return
          setSurveyVisit(latest)

          if (latest.visitId) {
            try {
              const sRes = await satisfactionSurveyApi.getByVisitId(latest.visitId)
              if (isMounted && sRes.data) {
                setSurveyRecord(sRes.data)
              }
            } catch {
              // not rated yet
            }
          }
        } else {
          if (!isMounted) return
          setSurveyVisit(null)
          setSurveyRecord(null)
        }
      } catch {
        if (!isMounted) return
        setSurveyVisit(null)
        setSurveyRecord(null)
      }
    }

    loadDashboardSurvey()

    return () => {
      isMounted = false
    }
  }, [user])

  const handleOpenSurvey = (starScore = null) => {
    setSurveyInitialScore(starScore)
    setSurveyModalOpen(true)
  }

  const handleSurveySuccess = (saved) => {
    if (saved) {
      setSurveyRecord(saved)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/portal/login', { replace: true })
  }

  const handleCopy = (text, label) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    message.success(`Đã sao chép ${label}!`)
  }

  const greetingName = user?.fullName && user.fullName !== user.username
    ? user.fullName
    : (user?.username || '')

  const patientIdStr = user?.patientId ? String(user.patientId) : ''

  return (
    <div className="portal-dashboard-page">
      <header className="portal-dashboard-header">
        <div className="portal-dashboard-header-inner">
          <Link className="portal-dashboard-brand" to="/portal/dashboard">
            <span className="portal-dashboard-brand-icon">
              <MedicineBoxOutlined />
            </span>
            <span>
              <strong>BỆNH ÁN SỐ</strong>
              <small>Cổng thông tin bệnh nhân</small>
            </span>
          </Link>

          <div className="portal-dashboard-user-bar" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

      <main className="portal-dashboard-main">
        <div className="portal-dashboard-welcome-card">
          <div className="portal-welcome-decoration-circle" aria-hidden="true" />
          <svg className="portal-welcome-pulse" viewBox="0 0 400 40" aria-hidden="true">
            <path
              d="M0 20 L80 20 L95 20 L105 5 L115 35 L125 20 L145 20 L400 20"
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="portal-welcome-content">
            <div className="portal-welcome-pill">
              <HeartFilled style={{ color: '#ff7875', marginRight: 6 }} /> Cổng thông tin y tế trực tuyến
            </div>
            <h1 className="portal-welcome-title">Xin chào{greetingName ? `, ${greetingName}` : ''}! 👋</h1>
            <p className="portal-welcome-desc">
              Theo dõi kết quả khám bệnh, lịch sử dùng thuốc và thông tin điều trị cá nhân nhanh chóng và an toàn.
            </p>
          </div>
        </div>

        {/* Banner Khảo sát mức độ hài lòng sau khám (NCL-10-CN-005) */}
        {surveyVisit && (
          <div
            className="portal-dashboard-survey-banner"
            style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 45%, #fef9c3 100%)',
              border: '1px solid #fde68a',
              borderRadius: 16,
              padding: '18px 24px',
              marginBottom: 24,
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.09)',
            }}
          >
            <Row gutter={[16, 16]} align="middle" justify="space-between">
              <Col xs={24} md={15} lg={16}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: '#fff',
                      border: '2px solid #f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: '#d97706',
                      fontSize: 22,
                      boxShadow: '0 2px 6px rgba(245, 158, 11, 0.2)',
                    }}
                  >
                    <StarFilled />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                        Khảo sát mức độ hài lòng sau khám
                      </span>
                      <Tag color="gold" style={{ fontWeight: 600, borderRadius: 12 }}>
                        Chăm sóc sau khám
                      </Tag>
                      {surveyRecord && (
                        <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontWeight: 600, borderRadius: 12 }}>
                          Đã gửi đánh giá ({surveyRecord.score} ⭐)
                        </Tag>
                      )}
                    </div>

                    <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#78350f', lineHeight: 1.5 }}>
                      Lượt khám ngày{' '}
                      <strong>
                        {surveyVisit.visitAt ? dayjs(surveyVisit.visitAt).format('DD/MM/YYYY') : 'gần đây'}
                      </strong>{' '}
                      với <strong>BS. {surveyVisit.doctorName}</strong>{' '}
                      {surveyVisit.specialtyName ? `(${surveyVisit.specialtyName})` : ''} đã hoàn tất.
                      {surveyRecord ? (
                        <>
                          {' '}Ý kiến của bạn:{' '}
                          <strong style={{ color: '#15803d' }}>
                            {surveyRecord.score} sao ({SCORE_LABELS[surveyRecord.score] || 'Hài lòng'})
                          </strong>
                          {surveyRecord.comment && (
                            <em>
                              {' '}- &ldquo;
                              {surveyRecord.comment.length > 60
                                ? `${surveyRecord.comment.slice(0, 60)}...`
                                : surveyRecord.comment}
                              &rdquo;
                            </em>
                          )}
                          .
                        </>
                      ) : (
                        ' Bạn có hài lòng với chất lượng phục vụ và sự tận tình của bác sĩ không?'
                      )}
                    </p>
                  </div>
                </div>
              </Col>

              <Col xs={24} md={9} lg={8} style={{ textAlign: { xs: 'left', md: 'right' } }}>
                {surveyRecord ? (
                  <Space wrap style={{ justifyContent: { xs: 'flex-start', md: 'flex-end' }, width: '100%' }}>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => handleOpenSurvey()}
                      style={{
                        borderColor: '#d97706',
                        color: '#92400e',
                        fontWeight: 600,
                        borderRadius: 8,
                        background: '#ffffff',
                      }}
                    >
                      Đã đánh giá — Sửa
                    </Button>
                    <Link to="/portal/medical-history">
                      <Button type="link" style={{ color: '#b45309', fontWeight: 600 }}>
                        Lịch sử khám <ArrowRightOutlined />
                      </Button>
                    </Link>
                  </Space>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: { xs: 'flex-start', md: 'flex-end' },
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 12.5, color: '#92400e', fontWeight: 600, marginRight: 2 }}>
                        Chọn nhanh:
                      </span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleOpenSurvey(star)}
                          title={`${star} sao - ${SCORE_LABELS[star]}`}
                          style={{
                            background: '#fff',
                            border: '1px solid #fde68a',
                            borderRadius: 6,
                            width: 30,
                            height: 30,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f59e0b',
                            fontWeight: 700,
                            fontSize: 13,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.15)'
                            e.currentTarget.style.borderColor = '#f59e0b'
                            e.currentTarget.style.background = '#fef3c7'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                            e.currentTarget.style.borderColor = '#fde68a'
                            e.currentTarget.style.background = '#fff'
                          }}
                        >
                          {star}★
                        </button>
                      ))}
                    </div>
                    <Space wrap>
                      <Button
                        type="primary"
                        icon={<StarFilled />}
                        onClick={() => handleOpenSurvey()}
                        style={{
                          background: '#d97706',
                          borderColor: '#d97706',
                          fontWeight: 600,
                          borderRadius: 8,
                          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
                        }}
                      >
                        Đánh giá ngay
                      </Button>
                    </Space>
                  </div>
                )}
              </Col>
            </Row>
          </div>
        )}

        <div className="portal-dashboard-grid">
          <div className="portal-dashboard-card portal-card-booking" style={{ borderColor: '#bfdbfe' }}>
            <div className="portal-dashboard-card-top">
              <div className="portal-dashboard-card-icon blue">
                <CalendarOutlined />
              </div>
              <div className="portal-card-header-text">
                <h3>Đặt lịch khám trực tuyến</h3>
                <span className="portal-card-tag blue">Chủ động</span>
              </div>
            </div>
            <p className="portal-card-desc">
              Chọn chuyên khoa, bác sĩ và khung giờ khám còn trống thuận tiện mà không cần chờ đợi.
            </p>
            <div className="portal-card-action">
              <Link to="/portal/book-appointment" style={{ width: '100%', display: 'block' }}>
                <Button type="primary" className="portal-btn-primary" block>
                  Đặt lịch khám ngay <ArrowRightOutlined />
                </Button>
              </Link>
            </div>
          </div>

          <div className="portal-dashboard-card portal-card-appointments">
            <div className="portal-dashboard-card-top">
              <div className="portal-dashboard-card-icon blue" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                <ScheduleOutlined />
              </div>
              <div className="portal-card-header-text">
                <h3>Lịch hẹn của tôi</h3>
                <span className="portal-card-tag green">Theo dõi</span>
              </div>
            </div>
            <p className="portal-card-desc">
              Xem danh sách lịch hẹn khám đã đặt, trạng thái tiếp nhận và hủy lịch khi có nhu cầu.
            </p>
            <div className="portal-card-action">
              <Link to="/portal/my-appointments" style={{ width: '100%', display: 'block' }}>
                <Button className="portal-btn-outline" block>
                  Xem danh sách lịch hẹn <ArrowRightOutlined />
                </Button>
              </Link>
            </div>
          </div>

          <div className="portal-dashboard-card portal-card-patient">
            <div className="portal-dashboard-card-top">
              <div className="portal-dashboard-card-icon green">
                <FileDoneOutlined />
              </div>
              <div className="portal-card-header-text">
                <h3>Lịch sử khám & Đơn thuốc</h3>
                <span className="portal-card-tag green">Đã hoàn tất</span>
              </div>
            </div>
            <p className="portal-card-desc">
              Xem lại toàn bộ kết quả chẩn đoán y khoa, đơn thuốc và lời dặn của bác sĩ qua các lần khám.
            </p>
            <div className="portal-card-action">
              <Link to="/portal/medical-history" style={{ width: '100%', display: 'block' }}>
                <Button className="portal-btn-outline" block>
                  Xem lịch sử khám <ArrowRightOutlined />
                </Button>
              </Link>
            </div>
          </div>

          <div className="portal-dashboard-card portal-card-survey" style={{ borderColor: '#fde68a' }}>
            <div className="portal-dashboard-card-top">
              <div className="portal-dashboard-card-icon amber">
                <StarFilled />
              </div>
              <div className="portal-card-header-text">
                <h3>Đánh giá sau khám</h3>
                <span className="portal-card-tag amber">Ý kiến của bạn</span>
              </div>
            </div>
            <p className="portal-card-desc">
              {surveyVisit && !surveyRecord
                ? `Lượt khám ngày ${surveyVisit.visitAt ? dayjs(surveyVisit.visitAt).format('DD/MM/YYYY') : 'gần nhất'} với BS. ${surveyVisit.doctorName} đang chờ bạn đánh giá chất lượng.`
                : surveyVisit && surveyRecord
                ? `Bạn đã gửi đánh giá (${surveyRecord.score}★) cho ca khám gần nhất. Bạn có thể xem lại hoặc gửi đánh giá cho các ca khám khác.`
                : 'Đóng góp ý kiến và đánh giá mức độ hài lòng về chất lượng khám, sự tận tình của bác sĩ sau mỗi lượt khám bệnh.'}
            </p>
            <div className="portal-card-action">
              {surveyVisit && !surveyRecord ? (
                <Button
                  type="primary"
                  className="portal-btn-survey"
                  block
                  icon={<StarFilled />}
                  onClick={() => handleOpenSurvey()}
                  id="btn-portal-dashboard-survey-action"
                >
                  Đánh giá lượt khám ngay <ArrowRightOutlined />
                </Button>
              ) : surveyVisit && surveyRecord ? (
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  <Button
                    className="portal-btn-outline"
                    block
                    icon={<EditOutlined />}
                    style={{ borderColor: '#fde68a', color: '#b45309', background: '#fffbeb' }}
                    onClick={() => handleOpenSurvey()}
                  >
                    Xem / Sửa đánh giá gần nhất
                  </Button>
                  <Link to="/portal/medical-history" style={{ width: '100%', display: 'block', textAlign: 'center' }}>
                    <Button type="link" className="portal-btn-link" style={{ padding: 0, fontSize: 13, color: '#b45309' }}>
                      Xem tất cả đánh giá & Lịch sử khám <ArrowRightOutlined />
                    </Button>
                  </Link>
                </Space>
              ) : (
                <Link to="/portal/medical-history" style={{ width: '100%', display: 'block' }}>
                  <Button className="portal-btn-outline" block icon={<StarOutlined />}>
                    Xem lịch sử khám & Đánh giá <ArrowRightOutlined />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="portal-dashboard-card portal-card-clinical-results" style={{ borderColor: '#bfdbfe' }}>
            <div className="portal-dashboard-card-top">
              <div className="portal-dashboard-card-icon blue" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                <ExperimentOutlined />
              </div>
              <div className="portal-card-header-text">
                <h3>Kết quả cận lâm sàng</h3>
                <span className="portal-card-tag green">Đã xác nhận</span>
              </div>
            </div>
            <p className="portal-card-desc">
              Xem lại kết quả xét nghiệm, chẩn đoán hình ảnh chính thức và tải bản đọc được (PDF) khi cần lưu trữ hoặc tái khám.
            </p>
            <div className="portal-card-action">
              <Link to="/portal/my-clinical-results" style={{ width: '100%', display: 'block' }}>
                <Button className="portal-btn-outline" block>
                  Xem kết quả cận lâm sàng <ArrowRightOutlined />
                </Button>
              </Link>
            </div>
          </div>

          <div className="portal-dashboard-card portal-card-invoices" style={{ borderColor: '#bfdbfe' }}>
            <div className="portal-dashboard-card-top">
              <div className="portal-dashboard-card-icon blue" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <FileProtectOutlined />
              </div>
              <div className="portal-card-header-text">
                <h3>Hóa đơn của tôi</h3>
                <span className="portal-card-tag blue">Chứng từ</span>
              </div>
            </div>
            <p className="portal-card-desc">
              Xem lại danh sách hóa đơn viện phí các lượt khám và tải về bản in PDF phục vụ bảo hiểm hoặc quyết toán.
            </p>
            <div className="portal-card-action">
              <Link to="/portal/my-invoices" style={{ width: '100%', display: 'block' }}>
                <Button className="portal-btn-outline" block>
                  Xem danh sách hóa đơn <ArrowRightOutlined />
                </Button>
              </Link>
            </div>
          </div>

          <div className="portal-dashboard-card portal-card-lookup portal-card-full-width">
            <div className="portal-dashboard-card-top">
              <div className="portal-dashboard-card-icon blue">
                <SearchOutlined />
              </div>
              <div className="portal-card-header-text">
                <h3>Tra cứu kết quả khám</h3>
                <span className="portal-card-tag blue">Nhanh chóng</span>
              </div>
            </div>
            <p className="portal-card-desc">
              Tra cứu trực tuyến kết quả cận lâm sàng, xét nghiệm và chẩn đoán theo mã lịch hẹn.
            </p>
            <div className="portal-card-action">
              <Link to="/portal" style={{ width: '100%', display: 'block' }}>
                <Button type="link" className="portal-btn-link">
                  Đến trang tra cứu <ArrowRightOutlined />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Khối Hồ sơ gia đình liên kết (NCL-14-CN-010) */}
        <Card
          className="portal-family-dashboard-card"
          loading={profilesLoading}
          style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#1e3a8a', fontWeight: 700 }}>
                <TeamOutlined style={{ color: '#2563eb' }} />
                <span>Hồ sơ người khám trong tài khoản</span>
                <Tag color="blue" style={{ marginLeft: 4 }}>
                  {linkedProfiles.length} hồ sơ
                </Tag>
              </div>
              <Link to="/portal/book-appointment">
                <Button type="primary" size="small" style={{ background: '#2563eb', borderColor: '#2563eb' }}>
                  <CalendarOutlined /> Đặt lịch khám
                </Button>
              </Link>
            </div>
          }
        >
          <p style={{ color: '#64748b', fontSize: 13, marginTop: -4, marginBottom: 16 }}>
            Đặt lịch khám và theo dõi lịch hẹn cho chính bạn và các người thân (con nhỏ, người được giám hộ) đã liên kết.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {linkedProfiles.map((prof, idx) => {
              const avatarColor = getAvatarColor(prof, idx)
              const initials = getProfileInitials(prof.fullName)
              const relationshipText = formatProfileRelationship(prof.relationship, prof.self)
              const ageText = formatProfileAge(prof.age, prof.dateOfBirth)

              return (
                <div
                  key={prof.patientId || prof.id || idx}
                  style={{
                    background: prof.self ? '#f8fafc' : '#f0fdf4',
                    border: prof.self ? '1px solid #e2e8f0' : '1px solid #bbf7d0',
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: avatarColor.bg,
                        color: avatarColor.text,
                        border: `2px solid ${avatarColor.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prof.fullName}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                        <Tag color={prof.self ? 'blue' : 'green'} style={{ margin: 0, fontSize: 11.5, padding: '1px 6px' }}>
                          {relationshipText}
                        </Tag>
                        {ageText && <span style={{ fontSize: 11, color: '#64748b' }}>{ageText}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link
                      to={prof.self ? '/portal/book-appointment' : `/portal/book-appointment?profileId=${prof.patientId}`}
                      style={{ flex: 1 }}
                    >
                      <Button size="small" type="primary" block style={{ background: '#2563eb', borderColor: '#2563eb', fontSize: 12 }}>
                        Đặt lịch
                      </Button>
                    </Link>
                    <Link
                      to={prof.self ? '/portal/my-appointments' : `/portal/my-appointments?profileId=${prof.patientId}`}
                      style={{ flex: 1 }}
                    >
                      <Button size="small" block style={{ fontSize: 12 }}>
                        Xem lịch
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {!linkedProfiles.some((p) => !p.self) && (
            <div style={{ marginTop: 14, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, fontSize: 12.5, color: '#475569', display: 'flex', alignItems: 'center', gap: 8, border: '1px dashed #cbd5e1' }}>
              <InfoCircleOutlined style={{ color: '#0284c7', flexShrink: 0 }} />
              <span>
                Bạn muốn đặt lịch khám cho người thân? Hãy liên hệ quầy tiếp đón của phòng khám để được hỗ trợ xác minh và tạo liên kết bảo mật.
              </span>
            </div>
          )}
        </Card>

        <Card
          className="portal-account-card"
          title={
            <div className="portal-account-card-title">
              <SafetyCertificateOutlined style={{ color: '#1677ff', fontSize: 18, marginRight: 8 }} />
              <span>Thông tin tài khoản</span>
            </div>
          }
        >
          <Descriptions
            bordered
            column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
            className="portal-descriptions"
          >
            <Descriptions.Item
              label={
                <span className="portal-desc-label">
                  <UserOutlined style={{ color: '#64748b', marginRight: 6 }} /> Tên đăng nhập
                </span>
              }
            >
              <strong style={{ color: '#0f172a', fontSize: 14 }}>{user?.username || '—'}</strong>
            </Descriptions.Item>

            <Descriptions.Item
              label={
                <span className="portal-desc-label">
                  <SafetyCertificateOutlined style={{ color: '#10b981', marginRight: 6 }} /> Vai trò
                </span>
              }
            >
              <span className="portal-status-pill green">
                <span className="portal-status-dot green" />
                Bệnh nhân (PATIENT)
              </span>
            </Descriptions.Item>

            {user?.patientCode && (
              <Descriptions.Item
                label={
                  <span className="portal-desc-label">
                    <BarcodeOutlined style={{ color: '#096dd9', marginRight: 6 }} /> Mã y tế (Mã BN)
                  </span>
                }
              >
                <span className="portal-status-pill blue">
                  {user.patientCode}
                </span>
              </Descriptions.Item>
            )}

            <Descriptions.Item
              label={
                <span className="portal-desc-label">
                  <IdcardOutlined style={{ color: '#6366f1', marginRight: 6 }} /> Mã bệnh nhân (Patient ID)
                </span>
              }
            >
              <div className="portal-copyable-code-row">
                <code className="portal-code-text">{user?.patientId || 'Đã liên kết'}</code>
                {patientIdStr && (
                  <Tooltip title="Sao chép">
                    <CopyOutlined
                      className="portal-inline-copy"
                      onClick={() => handleCopy(patientIdStr, 'mã bệnh nhân')}
                    />
                  </Tooltip>
                )}
              </div>
            </Descriptions.Item>

            <Descriptions.Item
              label={
                <span className="portal-desc-label">
                  <CheckCircleOutlined style={{ color: '#06b6d4', marginRight: 6 }} /> Trạng thái phiên
                </span>
              }
            >
              <span className="portal-status-pill cyan">
                <span className="portal-status-dot cyan pulse" />
                Đang hoạt động
              </span>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </main>

      <SatisfactionSurveyModal
        open={surveyModalOpen}
        onClose={() => {
          setSurveyModalOpen(false)
          setSurveyInitialScore(null)
        }}
        visit={surveyVisit}
        existingSurvey={surveyRecord}
        initialScore={surveyInitialScore}
        onSuccess={handleSurveySuccess}
      />
    </div>
  )
}

export default PortalDashboard
