import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Rate,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FrownOutlined,
  MehOutlined,
  SendOutlined,
  SmileOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import satisfactionSurveyApi from '../../api/satisfactionSurveyApi.js'
import {
  SCORE_COLORS,
  SCORE_LABELS,
  validateSurveySubmission,
} from '../../utils/satisfactionSurveyHelpers.js'
import '../../styles/satisfactionSurvey.css'

const { TextArea } = Input
const { Text } = Typography

/**
 * Modal đánh giá chất lượng phục vụ lượt khám (Dành cho Bệnh nhân qua Cổng)
 */
function SatisfactionSurveyModal({
  open,
  onClose,
  visit,
  existingSurvey = null,
  onSuccess,
}) {
  const [score, setScore] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isEditing = Boolean(existingSurvey && existingSurvey.id)

  // Populate form when modal opens or existingSurvey changes
  useEffect(() => {
    if (open) {
      if (existingSurvey) {
        setScore(Number(existingSurvey.score) || 5)
        setComment(existingSurvey.comment || '')
      } else {
        setScore(5)
        setComment('')
      }
      setErrorMessage('')
    }
  }, [open, existingSurvey])

  const visitDateStr = visit?.visitAt || visit?.startTime || visit?.appointmentTime
  const formattedDate = visitDateStr ? dayjs(visitDateStr).format('DD/MM/YYYY HH:mm') : 'Lượt khám gần đây'
  const doctorName = visit?.doctorName || visit?.doctor?.fullName || visit?.doctor?.username || 'Bác sĩ phụ trách'
  const specialty = visit?.specialtyName || visit?.specialty?.name

  const handleSubmit = async () => {
    setErrorMessage('')

    const validation = validateSurveySubmission(score, comment)
    if (!validation.isValid) {
      setErrorMessage(validation.error)
      return
    }

    const visitId = visit?.visitId || visit?.id
    if (!visitId && !isEditing) {
      setErrorMessage('Không xác định được mã lượt khám cần đánh giá.')
      return
    }

    setSubmitting(true)
    try {
      let res
      if (isEditing) {
        // Cập nhật đánh giá cũ
        res = await satisfactionSurveyApi.updateSurvey(existingSurvey.id, {
          score,
          comment: comment.trim(),
        })
        message.success('Đã cập nhật đánh giá chất lượng dịch vụ thành công!')
      } else {
        // Gửi mới
        res = await satisfactionSurveyApi.submitSurvey({
          visitId,
          score,
          comment: comment.trim(),
        })
        message.success('Cảm ơn bạn đã gửi đánh giá! Ý kiến của bạn giúp phòng khám phục vụ tốt hơn.')
      }

      if (onSuccess) {
        onSuccess(res.data)
      }
      onClose()
    } catch (err) {
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Không thể gửi đánh giá. Vui lòng kiểm tra lại lượt khám hoặc thử lại sau.'
      setErrorMessage(serverMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const emotionIcon = () => {
    if (score >= 4) return <SmileOutlined style={{ color: SCORE_COLORS[score] }} />
    if (score === 3) return <MehOutlined style={{ color: SCORE_COLORS[score] }} />
    return <FrownOutlined style={{ color: SCORE_COLORS[score] }} />
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      centered
      width={520}
      className="portal-survey-modal"
      title={
        <Space>
          {isEditing ? (
            <EditOutlined style={{ color: '#0284c7' }} />
          ) : (
            <StarFilled style={{ color: '#eab308' }} />
          )}
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1e3a8a' }}>
            {isEditing ? 'Chỉnh sửa đánh giá lượt khám' : 'Đánh giá chất lượng phục vụ'}
          </span>
        </Space>
      }
    >
      {/* Visit Info Context Card */}
      <div className="survey-visit-info-banner">
        <div className="survey-visit-info-row">
          <CalendarOutlined style={{ color: '#0284c7' }} />
          <span>Thời gian khám: <strong>{formattedDate}</strong></span>
        </div>
        <div className="survey-visit-info-row">
          <UserOutlined style={{ color: '#0284c7' }} />
          <span>Bác sĩ phụ trách: <strong>BS. {doctorName}</strong></span>
        </div>
        {specialty && (
          <div className="survey-visit-info-row">
            <Tag color="blue" style={{ fontSize: 12 }}>
              {specialty}
            </Tag>
            {visit?.visitCode && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                (Mã lượt khám: {visit.visitCode})
              </Text>
            )}
          </div>
        )}
      </div>

      {isEditing && (
        <Alert
          type="info"
          showIcon
          message="Bạn đã đánh giá lượt khám này trước đó"
          description="Nội dung đánh giá cũ đã được nạp sẵn. Bạn có thể cập nhật lại số sao và nhận xét bất kỳ lúc nào."
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <Form layout="vertical">
        {/* Rating Block */}
        <div className="survey-rating-container">
          <div style={{ fontSize: 14, color: '#475569', marginBottom: 8, fontWeight: 500 }}>
            Bạn đánh giá mức độ hài lòng đối với lượt khám này như thế nào?
          </div>

          <div className="survey-stars-large">
            <Rate
              value={score}
              onChange={(val) => setScore(val)}
              allowClear={false}
              id="survey-star-rating"
            />
          </div>

          <div
            className="survey-score-label"
            style={{ color: SCORE_COLORS[score] || '#334155' }}
          >
            <Space>
              {emotionIcon()}
              <span>{score} sao — {SCORE_LABELS[score]}</span>
            </Space>
          </div>

          {/* Quick Number Selectors for Mobile */}
          <div className="survey-quick-numbers" aria-label="Chọn điểm nhanh">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                type="button"
                key={num}
                className={`survey-num-btn ${score === num ? 'active' : ''}`}
                onClick={() => setScore(num)}
                title={`${num} sao - ${SCORE_LABELS[num]}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Free text comment */}
        <Form.Item
          label={
            <span style={{ fontWeight: 600, color: '#334155' }}>
              Ý kiến đóng góp hoặc nhận xét thêm (không bắt buộc):
            </span>
          }
        >
          <TextArea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            showCount
            placeholder="Chia sẻ cảm nhận của bạn về sự tận tâm của bác sĩ, thời gian chờ đợi hoặc cơ sở vật chất phòng khám..."
            className="survey-comment-area"
            id="survey-comment-input"
          />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <Button onClick={onClose} disabled={submitting}>
            Đóng
          </Button>
          <Button
            type="primary"
            icon={isEditing ? <CheckCircleOutlined /> : <SendOutlined />}
            loading={submitting}
            onClick={handleSubmit}
            id="btn-submit-survey"
            style={{
              background: '#16a34a',
              borderColor: '#16a34a',
              fontWeight: 600,
              padding: '0 20px',
            }}
          >
            {isEditing ? 'Lưu cập nhật đánh giá' : 'Gửi đánh giá'}
          </Button>
        </div>
      </Form>
    </Modal>
  )
}

export default SatisfactionSurveyModal
