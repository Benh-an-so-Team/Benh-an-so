import React, { useEffect, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  List,
  Modal,
  Rate,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  MedicineBoxOutlined,
  PrinterOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import patientPortalMedicalHistoryApi from '../../api/patientPortalMedicalHistoryApi'
import satisfactionSurveyApi from '../../api/satisfactionSurveyApi.js'
import { SCORE_LABELS } from '../../utils/satisfactionSurveyHelpers.js'
import { getApiErrorMessage } from '../../utils/apiError'

const { Text, Title, Paragraph } = Typography

function MedicalHistoryDetailModal({
  open,
  onClose,
  visitId,
  initialSummary = null,
  survey = null,
  onOpenSurvey = null,
}) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [currentSurvey, setCurrentSurvey] = useState(survey)

  useEffect(() => {
    setCurrentSurvey(survey)
  }, [survey])

  useEffect(() => {
    if (!open || !visitId) {
      setDetail(null)
      setCurrentSurvey(null)
      return
    }

    let isMounted = true

    // Tải chi tiết hồ sơ y tế thật từ backend
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const res = await patientPortalMedicalHistoryApi.getMedicalHistoryDetail(visitId)
        if (isMounted) {
          setDetail(res.data)
        }
      } catch (err) {
        const status = err?.response?.status
        if (status === 403 || status === 404) {
          message.error('Không tìm thấy hồ sơ khám bệnh này.')
        } else {
          message.error(getApiErrorMessage(err, 'Không thể tải chi tiết hồ sơ khám bệnh.'))
        }
        if (isMounted) {
          onClose()
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Tải đồng thời thông tin khảo sát thực tế từ database
    const fetchSurvey = async () => {
      try {
        const sRes = await satisfactionSurveyApi.getByVisitId(visitId)
        if (isMounted && sRes.data) {
          setCurrentSurvey(sRes.data)
        }
      } catch {
        // Chưa đánh giá hoặc bỏ qua
      }
    }

    fetchDetail()
    fetchSurvey()

    return () => {
      isMounted = false
    }
  }, [open, visitId, onClose])

  const visitDate = detail?.visitAt || initialSummary?.visitAt
  const formattedDate = visitDate ? dayjs(visitDate).format('DD/MM/YYYY') : '---'
  const formattedTime = visitDate ? dayjs(visitDate).format('HH:mm') : '---'
  const doctorName = detail?.doctorName || initialSummary?.doctorName || '—'
  const specialtyName = detail?.specialtyName || initialSummary?.specialtyName || '—'

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={760}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1e3a8a' }}>
          <FileDoneOutlined style={{ fontSize: 20, color: '#2563eb' }} />
          <span>Chi tiết hồ sơ khám bệnh & Đơn thuốc</span>
        </div>
      }
      footer={[
        <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>
          In hồ sơ
        </Button>,
        <Button key="close" type="primary" onClick={onClose} style={{ background: '#2563eb', borderColor: '#2563eb' }}>
          Đóng
        </Button>,
      ]}
      destroyOnClose
    >
      {loading ? (
        <div style={{ padding: '24px 0' }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : detail ? (
        <div className="medical-history-modal-content" style={{ maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
            }}
          >
            <Row gutter={[16, 12]} align="middle">
              <Col xs={24} sm={16}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar
                    size={46}
                    style={{ background: '#dbeafe', color: '#1d4ed8' }}
                    icon={<UserOutlined />}
                  >
                    {doctorName.charAt(0).toUpperCase()}
                  </Avatar>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                      BS. {doctorName}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      Chuyên khoa: <strong style={{ color: '#2563eb' }}>{specialtyName}</strong>
                    </div>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8} style={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  <CalendarOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                  Ngày khám: <strong>{formattedDate}</strong>
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                  <ClockCircleOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                  Giờ khám: <strong>{formattedTime}</strong>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 15,
                fontWeight: 700,
                color: '#1e3a8a',
                marginBottom: 10,
              }}
            >
              <MedicineBoxOutlined style={{ color: '#2563eb' }} />
              <span>1. Kết quả chẩn đoán y khoa</span>
            </div>

            {detail.diagnoses && detail.diagnoses.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.diagnoses.map((diag, idx) => (
                  <div
                    key={diag.icd10Code || idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        {diag.name}
                      </span>
                    </div>
                    {diag.icd10Code && (
                      <Tag color="cyan" style={{ fontSize: 12, fontWeight: 500, margin: 0 }}>
                        Mã ICD-10: {diag.icd10Code}
                      </Tag>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
                <Text type="secondary">Chưa có chẩn đoán chi tiết được ghi nhận.</Text>
              </Card>
            )}
          </div>

          <div style={{ marginBottom: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                <FileTextOutlined style={{ color: '#2563eb' }} />
                <span>2. Đơn thuốc điều trị</span>
              </div>
              <Tag color="blue" style={{ fontSize: 12, fontWeight: 600 }}>
                {detail.prescriptionItems?.length || 0} loại thuốc
              </Tag>
            </div>

            {detail.prescriptionItems && detail.prescriptionItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {detail.prescriptionItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '12px 16px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <strong style={{ fontSize: 15, color: '#1e293b' }}>
                          {item.medicineName}
                        </strong>
                      </div>
                      <Tag color="geekblue" style={{ fontSize: 12, fontWeight: 600 }}>
                        Số lượng: {item.quantity}
                      </Tag>
                    </div>

                    <div style={{ paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
                      {item.dosage && (
                        <div style={{ color: '#475569' }}>
                          • Liều dùng: <strong style={{ color: '#0f172a' }}>{item.dosage}</strong>
                        </div>
                      )}
                      {item.instructions && (
                        <div style={{ color: '#475569' }}>
                          • Hướng dẫn sử dụng: <strong style={{ color: '#0f172a' }}>{item.instructions}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
                <Text type="secondary">Lượt khám này không có đơn thuốc kèm theo.</Text>
              </Card>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                <InfoCircleOutlined style={{ color: '#d97706' }} />
                <span>3. Kế hoạch điều trị & Lời dặn của Bác sĩ</span>
              </div>
              {(detail.revisitDate || detail.revisitDateFormatted) && (
                <Tag color="geekblue" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
                  <CalendarOutlined style={{ marginRight: 6 }} />
                  Hẹn tái khám: <b>{detail.revisitDateFormatted || dayjs(detail.revisitDate).format('DD/MM/YYYY')}</b>
                </Tag>
              )}
            </div>

            {detail.treatmentPlan && (
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 12,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontWeight: 600, color: '#0284c7', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileDoneOutlined /> Kế hoạch điều trị:
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: '#0f172a' }}>
                  {detail.treatmentPlan}
                </div>
              </div>
            )}

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: 12,
                padding: '14px 18px',
                color: '#92400e',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600, color: '#b45309', marginBottom: 4 }}>
                Lời dặn dò & Chế độ sinh hoạt:
              </div>
              {detail.doctorAdvice ? (
                <div style={{ whiteSpace: 'pre-wrap', color: '#78350f' }}>
                  {detail.doctorAdvice}
                </div>
              ) : (
                <div style={{ fontStyle: 'italic', color: '#b45309' }}>
                  Uống thuốc đầy đủ theo đơn, chú ý nghỉ ngơi và tái khám ngay khi có triệu chứng bất thường.
                </div>
              )}
            </div>

            {/* 4. Đánh giá chất lượng dịch vụ sau khám (NCL-10-CN-005) */}
            <div
              style={{
                marginTop: 20,
                borderTop: '1px dashed #cbd5e1',
                paddingTop: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#1e3a8a',
                  }}
                >
                  <StarFilled style={{ color: '#f59e0b' }} />
                  <span>4. Đánh giá chất lượng dịch vụ sau khám</span>
                </div>
                {currentSurvey ? (
                  <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontWeight: 600 }}>
                    Đã gửi đánh giá
                  </Tag>
                ) : (
                  <Tag color="warning" icon={<ClockCircleOutlined />} style={{ fontWeight: 600 }}>
                    Chưa đánh giá
                  </Tag>
                )}
              </div>

              {currentSurvey ? (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '16px 18px',
                  }}
                >
                  <Row gutter={[16, 12]} align="middle" justify="space-between">
                    <Col xs={24} sm={16}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                        <Rate disabled value={currentSurvey.score} style={{ fontSize: 18, color: '#f59e0b' }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                          {currentSurvey.score}/5 sao — {SCORE_LABELS[currentSurvey.score] || 'Hài lòng'}
                        </span>
                      </div>
                      {currentSurvey.comment ? (
                        <div
                          style={{
                            fontSize: 13.5,
                            color: '#334155',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '10px 14px',
                            fontStyle: 'italic',
                            lineHeight: 1.5,
                            marginTop: 6,
                          }}
                        >
                          &ldquo;{currentSurvey.comment}&rdquo;
                        </div>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          (Không có nhận xét chi tiết)
                        </Text>
                      )}
                      {currentSurvey.submittedAt && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                          Thời gian đánh giá: {dayjs(currentSurvey.submittedAt).format('HH:mm DD/MM/YYYY')}
                        </div>
                      )}
                    </Col>
                    <Col xs={24} sm={8} style={{ textAlign: { xs: 'left', sm: 'right' } }}>
                      <Button
                        icon={<EditOutlined />}
                        style={{
                          borderRadius: 8,
                          fontWeight: 600,
                          borderColor: '#86efac',
                          color: '#15803d',
                          background: '#f0fdf4',
                        }}
                        onClick={() => {
                          if (onOpenSurvey) {
                            onOpenSurvey(detail || initialSummary, currentSurvey)
                          }
                        }}
                      >
                        Chỉnh sửa đánh giá
                      </Button>
                    </Col>
                  </Row>
                </div>
              ) : (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 12,
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ maxWidth: 480 }}>
                    <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
                      Bạn chưa gửi đánh giá cho lượt khám này
                    </div>
                    <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
                      Đóng góp ý kiến của bạn về bác sĩ và trải nghiệm khám giúp phòng khám không ngừng cải thiện chất lượng điều trị và dịch vụ.
                    </div>
                  </div>
                  <Button
                    type="primary"
                    icon={<StarOutlined />}
                    style={{
                      background: '#f59e0b',
                      borderColor: '#f59e0b',
                      fontWeight: 600,
                      borderRadius: 8,
                      boxShadow: '0 2px 6px rgba(245, 158, 11, 0.25)',
                    }}
                    onClick={() => {
                      if (onOpenSurvey) {
                        onOpenSurvey(detail || initialSummary, null)
                      }
                    }}
                  >
                    Đánh giá ca khám ngay
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Empty description="Không tìm thấy thông tin hồ sơ khám bệnh." />
      )}
    </Modal>
  )
}

export default MedicalHistoryDetailModal
