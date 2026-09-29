import React, { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Result,
  Tag,
  Typography,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  formatProfileAge,
  formatProfileRelationship,
} from '../../utils/familyAppointmentHelpers.js'
import { showNotice, NOTICE_LEVELS } from '../common/notice/index.js'

const { Text, Paragraph } = Typography

function BookingConfirmationModal({
  open,
  onClose,
  specialty,
  doctor,
  selectedDate,
  selectedSlot,
  patient,
  targetProfile,
  onSubmit,
  loading = false,
  onSuccessNavigate,
}) {
  const [form] = Form.useForm()
  const [bookingSuccess, setBookingSuccess] = useState(null)
  const [conflictError, setConflictError] = useState('')

  const handleConfirm = async () => {
    setConflictError('')
    try {
      const values = await form.validateFields()
      const startDayjs = dayjs(selectedSlot.startTime)
      const startTimeStr = startDayjs.format('HH:mm')

      const payload = {
        doctorId: doctor.id,
        appointmentDate: selectedDate,
        startTime: startTimeStr,
        reason: values.reason?.trim() || 'Đặt lịch hẹn khám trực tuyến',
      }

      // NCL-14-CN-010: Chỉ gửi patientId khi đặt cho người thân phụ thuộc (self = false)
      if (targetProfile && !targetProfile.self && targetProfile.patientId) {
        payload.patientId = targetProfile.patientId
      }

      const result = await onSubmit(payload)
      if (result) {
        try {
          const cached = JSON.parse(localStorage.getItem('portal_booked_appointments') || '[]')
          const effectivePatientId = targetProfile?.patientId || result.patientId || patient?.patientId || patient?.id
          const effectivePatientName = targetProfile?.fullName || patient?.fullName || 'Bệnh nhân'
          const item = {
            id: result.id || String(Date.now()),
            appointmentCode: result.appointmentCode || result.id || `AP-${dayjs().format('YYYYMMDD')}-${Math.floor(100 + Math.random() * 900)}`,
            status: result.status || 'SCHEDULED',
            bookingChannel: 'ONLINE_PORTAL',
            patientId: effectivePatientId,
            patientName: effectivePatientName,
            patientRelationship: targetProfile?.relationship || 'SELF',
            isDependent: Boolean(targetProfile && !targetProfile.self),
            doctor: doctor || { fullName: 'Bác sĩ phụ trách' },
            doctorName: doctor?.fullName || doctor?.username,
            specialtyName: specialty?.name,
            startTime: selectedSlot?.startTime,
            endTime: selectedSlot?.endTime,
            reason: payload.reason,
            createdAt: new Date().toISOString(),
          }
          localStorage.setItem('portal_booked_appointments', JSON.stringify([item, ...cached]))
        } catch {
          // ignore storage error
        }
        setBookingSuccess(result)
        showNotice({
          level: NOTICE_LEVELS.SUCCESS,
          title: 'Đặt lịch thành công',
          message: 'Đã đặt lịch cho hồ sơ đang chọn',
        })
      }
    } catch (err) {
      if (err.errorFields) return
      const status = err?.response?.status
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Có lỗi xảy ra khi đặt lịch hẹn.'

      if (status === 409 || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('đã có người đặt') || msg.toLowerCase().includes('trùng')) {
        const errorText = 'Khung giờ này vừa có người đặt. Vui lòng chọn khung giờ khác.'
        setConflictError(
          'Khung giờ này vừa có người đặt trước. Bác sĩ và hồ sơ đã chọn được giữ nguyên, vui lòng đóng hộp thoại để chọn khung giờ khác.'
        )
        showNotice({
          level: NOTICE_LEVELS.ERROR,
          title: 'Khung giờ không khả dụng',
          message: errorText,
        })
      } else {
        setConflictError(msg)
        showNotice({
          level: NOTICE_LEVELS.ERROR,
          title: 'Không thể đặt lịch',
          message: msg,
        })
      }
    }
  }

  const handleModalClose = () => {
    setBookingSuccess(null)
    setConflictError('')
    form.resetFields()
    onClose()
  }

  if (bookingSuccess) {
    return (
      <Modal
        open={open}
        footer={null}
        onCancel={handleModalClose}
        width={560}
        destroyOnClose
        centered
      >
        <Result
          status="success"
          title="Đặt lịch khám thành công!"
          subTitle={
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 15, color: '#1e293b' }}>
                Mã lịch hẹn của bạn là:{' '}
                <strong style={{ color: '#2563eb', fontSize: 17 }}>
                  {bookingSuccess.appointmentCode || bookingSuccess.id}
                </strong>
              </div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>
                Trạng thái: <Tag color="blue">Đã đặt lịch (SCHEDULED)</Tag>
              </Text>
            </div>
          }
          extra={[
            <Button
              type="primary"
              key="view"
              onClick={() => {
                handleModalClose()
                onSuccessNavigate('/portal/my-appointments')
              }}
              style={{ background: '#2563eb', borderColor: '#2563eb' }}
            >
              Xem danh sách lịch hẹn của tôi
            </Button>,
            <Button
              key="home"
              onClick={() => {
                handleModalClose()
                onSuccessNavigate('/portal/dashboard')
              }}
            >
              Về trang chủ Portal
            </Button>,
          ]}
        >
          <div
            style={{
              background: '#f8fafc',
              padding: 16,
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              fontSize: 13,
            }}
          >
            <Paragraph style={{ margin: 0 }}>
              ● <strong>Hồ sơ người khám:</strong> {targetProfile?.fullName || patient?.fullName || patient?.username}{' '}
              <Tag color={targetProfile?.self ? 'blue' : 'green'} style={{ marginLeft: 6 }}>
                {formatProfileRelationship(targetProfile?.relationship, targetProfile?.self)}
              </Tag>
            </Paragraph>
            <Paragraph style={{ margin: '4px 0 0' }}>
              ● <strong>Bác sĩ khám:</strong> BS. {doctor?.fullName || doctor?.username} ({specialty?.name})
            </Paragraph>
            <Paragraph style={{ margin: '4px 0 0' }}>
              ● <strong>Thời gian:</strong> {selectedSlot?.label} ngày {dayjs(selectedDate).format('DD/MM/YYYY')}
            </Paragraph>
            <Paragraph style={{ margin: '6px 0 0', color: '#64748b', fontSize: 12 }}>
              * Vui lòng có mặt tại phòng khám trước giờ hẹn 10-15 phút để làm thủ tục tiếp đón.
            </Paragraph>
          </div>
        </Result>
      </Modal>
    )
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#1e3a8a' }}>
          <CheckCircleFilled style={{ color: '#2563eb' }} />
          <span>Xác nhận thông tin đặt lịch khám</span>
        </div>
      }
      open={open}
      onCancel={handleModalClose}
      onOk={handleConfirm}
      confirmLoading={loading}
      okText="Xác nhận đặt lịch"
      cancelText="Quay lại"
      width={620}
      destroyOnClose
      centered
    >
      {conflictError && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Không thể đặt khung giờ này"
          description={conflictError}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Summary Card */}
      <Card
        size="small"
        style={{
          background: '#f0fdf4',
          borderColor: '#bbf7d0',
          borderRadius: 10,
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '14px 18px' }}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label={<span style={{ color: '#166534', fontWeight: 600 }}><TeamOutlined /> Hồ sơ khám</span>}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <strong style={{ color: '#14532d', fontSize: 14 }}>
                {targetProfile?.fullName || patient?.fullName || patient?.username}
              </strong>
              <Tag color={targetProfile?.self ? 'blue' : 'green'} style={{ fontWeight: 600 }}>
                {formatProfileRelationship(targetProfile?.relationship, targetProfile?.self)}
              </Tag>
              {targetProfile?.age != null && (
                <span style={{ fontSize: 12, color: '#475569' }}>
                  ({formatProfileAge(targetProfile?.age, targetProfile?.dateOfBirth)})
                </span>
              )}
              {targetProfile?.patientCode && (
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  - Mã HS: {targetProfile.patientCode}
                </span>
              )}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ color: '#166534', fontWeight: 600 }}><MedicineBoxOutlined /> Chuyên khoa</span>}>
            <strong style={{ color: '#14532d' }}>{specialty?.name}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ color: '#166534', fontWeight: 600 }}><UserOutlined /> Bác sĩ khám</span>}>
            <strong style={{ color: '#14532d' }}>BS. {doctor?.fullName || doctor?.username}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ color: '#166534', fontWeight: 600 }}><CalendarOutlined /> Ngày khám</span>}>
            <span style={{ fontWeight: 600, color: '#14532d' }}>
              {dayjs(selectedDate).format('dddd, DD/MM/YYYY')}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label={<span style={{ color: '#166534', fontWeight: 600 }}><ClockCircleOutlined /> Khung giờ</span>}>
            <Tag color="blue" style={{ fontSize: 14, fontWeight: 700, padding: '2px 10px' }}>
              {selectedSlot?.label}
            </Tag>
          </Descriptions.Item>
          {patient && targetProfile && !targetProfile.self && (
            <Descriptions.Item label={<span style={{ color: '#166534', fontWeight: 600 }}><IdcardOutlined /> Người giám hộ đặt</span>}>
              <span>{patient.fullName || patient.username} {patient.phoneNumber ? `(${patient.phoneNumber})` : ''}</span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Form Input Reason */}
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label={<span style={{ fontWeight: 600, fontSize: 13 }}>Lý do khám / Triệu chứng hiện tại</span>}
          rules={[
            { max: 500, message: 'Lý do khám không vượt quá 500 ký tự' },
          ]}
          initialValue="Đặt lịch hẹn khám trực tuyến"
        >
          <Input.TextArea
            rows={3}
            placeholder="Mô tả ngắn gọn triệu chứng hoặc lý do bạn muốn đi khám (ví dụ: Đau họng 2 ngày, kiểm tra định kỳ...)"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default BookingConfirmationModal
