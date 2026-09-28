import React, { useState } from 'react'
import {
  Modal,
  Typography,
  Input,
  Button,
  Alert,
  Card,
  Space,
  Tag,
  Divider,
  message,
} from 'antd'
import {
  AuditOutlined,
  ExclamationCircleOutlined,
  BookOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  LockOutlined,
} from '@ant-design/icons'

import patientConsentApi from '../../api/patientConsentApi'
import { QTN19_PLAIN_EXPLANATION } from '../../utils/patientConsentHelpers'
import './patientConsent.css'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

export default function DataErasureRequestModal({
  open,
  onClose,
  patient,
  onSuccess,
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resultData, setResultData] = useState(null)

  React.useEffect(() => {
    if (open) {
      setReason('')
      setResultData(null)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      message.warning('Vui lòng nhập lý do người bệnh yêu cầu xóa dữ liệu.')
      return
    }

    setSubmitting(true)
    try {
      const res = await patientConsentApi.requestDataErasure(patient.id, {
        reason: reason.trim(),
      })

      setResultData(res.data)
      message.success('Đã tiếp nhận và ghi nhận yêu cầu xóa dữ liệu vào hệ thống kiểm toán!')
      if (onSuccess) onSuccess()
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể ghi nhận yêu cầu. Vui lòng thử lại.'
      message.error(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
              fontSize: 20,
            }}
          >
            <AuditOutlined />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Tiếp nhận yêu cầu xóa dữ liệu cá nhân
            </div>
            <Text type="secondary" style={{ fontSize: 12.5 }}>
              Người bệnh: <strong>{patient?.fullName}</strong> ({patient?.patientCode})
            </Text>
          </div>
        </div>
      }
      footer={
        resultData
          ? [
              <Button key="close" type="primary" onClick={onClose} style={{ borderRadius: 8 }}>
                Đã hoàn tất & Đóng
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose} disabled={submitting}>
                Hủy bỏ
              </Button>,
              <Button
                key="submit"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                disabled={!reason.trim()}
                style={{ background: '#d97706', borderColor: '#d97706', borderRadius: 8, fontWeight: 600 }}
              >
                Ghi nhận yêu cầu & Thu hồi quyền ngoài khám chữa bệnh
              </Button>,
            ]
      }
      style={{ top: 24 }}
    >
      {/* THÔNG ĐIỆP GIẢI THÍCH DỄ HIỂU ĐỂ LỄ TÂN TRUYỀN ĐẠT TRỰC TIẾP CHO BỆNH NHÂN */}
      <div className="qtn19-explainer-card" style={{ marginBottom: 18 }}>
        <div className="qtn19-explainer-title">
          <BookOutlined /> {QTN19_PLAIN_EXPLANATION.title}
        </div>
        <div className="qtn19-explainer-body">
          <p style={{ margin: '0 0 10px', fontWeight: 500, color: '#1e293b' }}>
            💬 <strong>Lời giải thích chuẩn cho Lễ tân truyền đạt đến Người bệnh:</strong>
          </p>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '12px 16px',
              fontStyle: 'italic',
              color: '#334155',
              lineHeight: 1.6,
              marginBottom: 10,
            }}
          >
            "{QTN19_PLAIN_EXPLANATION.summaryForPatient}"
          </div>
          <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>
            🛡️ <strong>Hành động hệ thống thực hiện:</strong> {QTN19_PLAIN_EXPLANATION.actionTakenText}
          </p>
        </div>
      </div>

      {!resultData ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 13.5, color: '#1e293b' }}>
              Nội dung / Lý do người bệnh yêu cầu xóa dữ liệu <span style={{ color: '#dc2626' }}>*</span>:
            </Text>
            <TextArea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập chi tiết yêu cầu của người bệnh (ví dụ: Người bệnh muốn xóa toàn bộ thông tin tài khoản và dữ liệu cá nhân tại phòng khám...)"
              style={{ marginTop: 6, borderRadius: 8 }}
            />
          </div>

          <Alert
            type="warning"
            showIcon
            icon={<LockOutlined />}
            message="Xác nhận tiếp nhận và bảo lưu chứng cứ kiểm toán"
            description="Khi bấm ghi nhận, hệ thống sẽ lưu vết yêu cầu của người bệnh vào nhật ký kiểm toán (Audit Log), đồng thời thiết lập trạng thái thu hồi sự đồng ý và ngưng tất cả các hoạt động xử lý phi y tế. Hồ sơ bệnh án chuyên môn vẫn được bảo quản an toàn theo đúng thời hạn luật định (10 năm)."
            style={{ borderRadius: 8 }}
          />
        </>
      ) : (
        /* KẾT QUẢ TIẾP NHẬN THÀNH CÔNG */
        <Card
          size="small"
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 10,
            marginTop: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 24 }} />
            <div>
              <Text strong style={{ fontSize: 15, color: '#15803d' }}>
                Đã tiếp nhận và xử lý yêu cầu thành công
              </Text>
              <div style={{ fontSize: 12.5, color: '#166534' }}>
                Mã người bệnh: {resultData.patientId}
              </div>
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #dcfce7' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#1e293b', fontWeight: 500 }}>
              {resultData.message}
            </p>
            <Space size={8} wrap>
              <Tag color="green">Thời gian lưu trữ bắt buộc: {resultData.retentionYears} năm</Tag>
              <Tag color="orange">Đã thu hồi quyền phi điều trị</Tag>
              <Tag color="blue">Đã lưu vết kiểm toán (Audit Trail)</Tag>
            </Space>
          </div>
        </Card>
      )}
    </Modal>
  )
}
