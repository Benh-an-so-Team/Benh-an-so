import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  RedoOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import appointmentApi from '../../api/appointmentApi.js'
import {
  validateSeriesForm,
  canSubmitSeries,
  buildCreateSeriesPayload,
  mapSeriesErrorMessage,
  getSeriesWarningLabel,
  getSeriesWarningColor,
} from '../../utils/appointmentSeriesHelpers.js'

const { Text, Title } = Typography

export default function CreateAppointmentSeriesModal({
  open,
  onCancel,
  patients = [],
  doctorList = [],
  initialPatientId,
  initialDoctorId,
  initialMedicalRecordId,
  onOpenQuickPatient,
  onSuccess,
}) {
  const [form] = Form.useForm()
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [previewResult, setPreviewResult] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [isScheduleDirty, setIsScheduleDirty] = useState(false)

  const previewDebounceRef = useRef(null)
  const previewReqIdRef = useRef(0)
  const lastPreviewParamsRef = useRef(null)

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current)
      }
    }
  }, [])

  const getFormPayloadValues = useCallback(() => {
    const rawValues = form.getFieldsValue()
    const startDate = rawValues.startDate ? dayjs(rawValues.startDate) : null
    const startTime = rawValues.startTime ? dayjs(rawValues.startTime) : null

    let firstSessionStartTime = null
    if (startDate && startTime) {
      firstSessionStartTime = startDate
        .hour(startTime.hour())
        .minute(startTime.minute())
        .second(0)
        .millisecond(0)
        .toISOString()
    }

    return {
      ...rawValues,
      firstSessionStartTime,
    }
  }, [form])

  const executePreview = useCallback(
    async (isManual = false) => {
      const values = getFormPayloadValues()
      const validation = validateSeriesForm(values)

      if (!validation.isValid) {
        setIsScheduleDirty(false)
        if (isManual) {
          setFormErrors(validation.errors)
          const firstError = Object.values(validation.errors)[0]
          message.warning(firstError || 'Vui lòng kiểm tra lại thông tin trên form.')
        }
        return
      }

      if (isManual) {
        setFormErrors({})
      }

      const currentReqId = ++previewReqIdRef.current
      setPreviewing(true)
      setIsScheduleDirty(false)

      try {
        const payload = {
          patientId: values.patientId,
          doctorId: values.doctorId,
          firstSessionStartTime: values.firstSessionStartTime,
          sessionDurationMinutes: Number(values.sessionDurationMinutes || 30),
          totalSessions: Number(values.totalSessions),
          intervalDays: Number(values.intervalDays),
        }

        const res = await appointmentApi.previewSeries(payload)
        if (currentReqId !== previewReqIdRef.current) {
          return
        }

        const data = res.data || res
        setPreviewResult(data)
        lastPreviewParamsRef.current = {
          patientId: values.patientId,
          doctorId: values.doctorId,
          firstSessionStartTime: values.firstSessionStartTime,
          sessionDurationMinutes: Number(values.sessionDurationMinutes || 30),
          totalSessions: Number(values.totalSessions),
          intervalDays: Number(values.intervalDays),
        }

        if (isManual) {
          if (data.allAvailable || data.conflictCount === 0) {
            message.success(
              `Đã xem trước ${data.totalSessions} buổi. Đã tự động bỏ qua ngày nghỉ và tất cả buổi đều khả dụng!`
            )
          } else {
            message.warning(
              `Có ${data.conflictCount} buổi bị trùng lịch hẹn với bệnh nhân khác. Vui lòng kiểm tra lại khung giờ.`
            )
          }
        }
      } catch (err) {
        if (currentReqId !== previewReqIdRef.current) {
          return
        }
        const errorMsg = mapSeriesErrorMessage(err)
        if (isManual) {
          message.error(errorMsg)
        } else {
          console.warn('Auto preview error:', errorMsg)
        }
        // Giữ nguyên previewResult hiện tại, không xóa mất bảng khi gặp lỗi chỉnh sửa
      } finally {
        if (currentReqId === previewReqIdRef.current) {
          setPreviewing(false)
        }
      }
    },
    [getFormPayloadValues]
  )

  // Reset or pre-fill form when opened, and trigger auto preview if patient and doctor are set
  useEffect(() => {
    if (open) {
      setPreviewResult(null)
      setFormErrors({})
      setIsScheduleDirty(false)
      lastPreviewParamsRef.current = null

      form.setFieldsValue({
        patientId: initialPatientId || undefined,
        doctorId: initialDoctorId || undefined,
        medicalRecordId: initialMedicalRecordId || undefined,
        startDate: dayjs().add(1, 'day'),
        startTime: dayjs().hour(9).minute(0).second(0),
        sessionDurationMinutes: 30,
        totalSessions: 3,
        intervalDays: 7,
        title: '',
        notes: '',
      })

      if (initialPatientId && initialDoctorId) {
        if (previewDebounceRef.current) {
          clearTimeout(previewDebounceRef.current)
        }
        previewDebounceRef.current = setTimeout(() => {
          executePreview(false)
        }, 150)
      }
    } else {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current)
      }
      setPreviewResult(null)
      setFormErrors({})
      setIsScheduleDirty(false)
      lastPreviewParamsRef.current = null
    }
  }, [open, initialPatientId, initialDoctorId, initialMedicalRecordId, form, executePreview])

  const handlePreview = () => {
    executePreview(true)
  }

  const handleValuesChange = (changedValues) => {
    if (Object.keys(formErrors).length > 0) {
      const updatedErrors = { ...formErrors }
      let hasErrorChanges = false
      Object.keys(changedValues).forEach((key) => {
        if (updatedErrors[key]) {
          delete updatedErrors[key]
          hasErrorChanges = true
        }
        if ((key === 'startDate' || key === 'startTime') && updatedErrors.firstSessionStartTime) {
          delete updatedErrors.firstSessionStartTime
          hasErrorChanges = true
        }
      })
      if (hasErrorChanges) {
        setFormErrors(updatedErrors)
      }
    }

    const scheduleFields = [
      'patientId',
      'doctorId',
      'startDate',
      'startTime',
      'sessionDurationMinutes',
      'totalSessions',
      'intervalDays',
    ]
    const hasScheduleFieldChanged = Object.keys(changedValues).some((key) =>
      scheduleFields.includes(key)
    )

    if (hasScheduleFieldChanged) {
      // Không xóa previewResult để UI không bị giật hoặc biến mất bảng xem trước
      setIsScheduleDirty(true)
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current)
      }
      previewDebounceRef.current = setTimeout(() => {
        executePreview(false)
      }, 350)
    }
  }

  const isFormInSync = useCallback(() => {
    if (!previewResult || !lastPreviewParamsRef.current) return false
    const values = getFormPayloadValues()
    return (
      String(values.patientId || '') === String(lastPreviewParamsRef.current.patientId || '') &&
      String(values.doctorId || '') === String(lastPreviewParamsRef.current.doctorId || '') &&
      values.firstSessionStartTime === lastPreviewParamsRef.current.firstSessionStartTime &&
      Number(values.sessionDurationMinutes || 30) === Number(lastPreviewParamsRef.current.sessionDurationMinutes) &&
      Number(values.totalSessions) === Number(lastPreviewParamsRef.current.totalSessions) &&
      Number(values.intervalDays) === Number(lastPreviewParamsRef.current.intervalDays)
    )
  }, [getFormPayloadValues, previewResult])

  const handleConfirmAndSubmit = async () => {
    const values = getFormPayloadValues()
    const validation = validateSeriesForm(values)
    if (!validation.isValid) {
      setFormErrors(validation.errors)
      message.error('Vui lòng kiểm tra lại các trường thông tin.')
      return
    }

    if (!isFormInSync()) {
      message.warning('Dữ liệu lịch khám đã thay đổi, hệ thống đang cập nhật xem trước...')
      await executePreview(true)
      return
    }

    if (!canSubmitSeries(previewResult)) {
      message.error('Không thể tạo liệu trình khi vẫn còn buổi khám bị xung đột hoặc chưa xem trước.')
      return
    }

    const patient = patients.find((p) => String(p.id) === String(values.patientId))
    const doctor = doctorList.find((d) => String(d.id) === String(values.doctorId))
    const patientDisplayName = patient ? `${patient.fullName || patient.name} (${patient.patientCode || 'BN'})` : values.patientId
    const doctorDisplayName = doctor ? `${doctor.fullName || doctor.username}` : values.doctorId

    Modal.confirm({
      title: 'Xác nhận tạo liệu trình khám',
      icon: <ExclamationCircleOutlined style={{ color: '#7c3aed' }} />,
      content: (
        <div style={{ marginTop: 8 }}>
          <p>
            Bạn có chắc chắn muốn đặt trọn bộ liệu trình gồm <strong>{previewResult.totalSessions} buổi</strong> không?
          </p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', fontSize: 13, lineHeight: '1.7' }}>
            <li><strong>Bệnh nhân:</strong> {patientDisplayName}</li>
            <li><strong>Bác sĩ phụ trách:</strong> {doctorDisplayName}</li>
            <li><strong>Khoảng cách:</strong> {previewResult.intervalDays} ngày / buổi</li>
            <li><strong>Thời lượng:</strong> {values.sessionDurationMinutes || 30} phút / buổi</li>
          </ul>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Hệ thống sẽ tạo mã liệu trình và tự động sinh {previewResult.totalSessions} lịch hẹn liên kết trong 1 giao dịch.
          </Text>
        </div>
      ),
      okText: 'Xác nhận tạo loạt lịch',
      cancelText: 'Xem lại',
      okButtonProps: { className: 'series-btn-primary' },
      onOk: async () => {
        setSubmitting(true)
        try {
          const createPayload = buildCreateSeriesPayload(values, previewResult.sessions)
          const res = await appointmentApi.createSeries(createPayload)
          const createdSeries = res.data || res

          message.success({
            content: `Đặt liệu trình thành công! Mã liệu trình: ${createdSeries.seriesCode || 'Thành công'}`,
            duration: 4,
          })

          if (onSuccess) {
            onSuccess(createdSeries)
          }
          onCancel()
        } catch (err) {
          const errorMsg = mapSeriesErrorMessage(err)
          message.error(errorMsg)
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  const isCreateEnabled =
    canSubmitSeries(previewResult) &&
    isFormInSync() &&
    !isScheduleDirty &&
    !submitting &&
    !previewing

  const previewColumns = [
    {
      title: 'Buổi #',
      dataIndex: 'sequenceNumber',
      key: 'sequenceNumber',
      width: 90,
      render: (seq) => <span className="series-seq-badge">Buổi {seq}</span>,
    },
    {
      title: 'Khung giờ khám dự kiến',
      key: 'time',
      width: 260,
      render: (_, record) => {
        const start = record.startTime ? dayjs(record.startTime) : null
        const end = record.endTime ? dayjs(record.endTime) : null
        if (!start || !end) return '—'
        return (
          <Space direction="vertical" size={1}>
            <Text strong style={{ color: '#0f172a', fontSize: 14 }}>
              {start.format('HH:mm')} - {end.format('HH:mm')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {start.format('dddd, DD/MM/YYYY')}
            </Text>
          </Space>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (st) => {
        if (st === 'AVAILABLE') {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ padding: '2px 8px' }}>
              Khả dụng
            </Tag>
          )
        }
        return (
          <Tag color={getSeriesWarningColor(st)} icon={<CloseCircleOutlined />} style={{ padding: '2px 8px' }}>
            {getSeriesWarningLabel(st)}
          </Tag>
        )
      },
    },
    {
      title: 'Chi tiết & Cảnh báo ca trực',
      dataIndex: 'conflictReason',
      key: 'conflictReason',
      render: (reason, record) => {
        if (record.status === 'AVAILABLE') {
          return (
            <span style={{ color: '#16a34a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleOutlined /> Bác sĩ trống lịch trong ca làm việc, sẵn sàng tiếp nhận
            </span>
          )
        }
        return (
          <span style={{ color: '#dc2626', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ExclamationCircleOutlined /> {reason || getSeriesWarningLabel(record.status)}
          </span>
        )
      },
    },
  ]

  return (
    <Modal
      title={
        <div className="series-modal-header">
          <div className="series-modal-header-icon">
            <CalendarOutlined />
          </div>
          <div>
            <div className="series-modal-header-title">Đặt Lịch Hẹn Theo Liệu Trình Nhiều Buổi</div>
          </div>
        </div>
      }
      open={open}
      onCancel={submitting ? undefined : onCancel}
      maskClosable={!submitting}
      destroyOnClose
      width={920}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', gap: 12 }}>
          <div style={{ minWidth: 0, flexShrink: 1 }}>
            {previewing || isScheduleDirty ? (
              <div className="series-footer-status info">
                <LoadingOutlined spin style={{ color: '#7c3aed', fontSize: 14 }} />
                <span>Đang tự động cập nhật lịch xem trước...</span>
              </div>
            ) : !previewResult ? (
              <div className="series-footer-status info">
                <InfoCircleOutlined style={{ color: '#7c3aed', fontSize: 14 }} />
                <span>
                  Chọn thông tin hoặc bấm <strong>"Xem trước các buổi"</strong> để kiểm tra ca trực
                </span>
              </div>
            ) : previewResult.conflictCount === 0 ? (
              <div className="series-footer-status success">
                <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 14 }} />
                <span>
                  Sẵn sàng tạo <strong>{previewResult.totalSessions} buổi khám</strong> (Đã tự động tránh ngày nghỉ)
                </span>
              </div>
            ) : (
              <div className="series-footer-status error">
                <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 14 }} />
                <span>
                  Còn <strong>{previewResult.conflictCount} buổi</strong> trùng lịch hẹn khác
                </span>
              </div>
            )}
          </div>
          <Space size={10} style={{ flexShrink: 0 }}>
            <Button onClick={onCancel} disabled={submitting} className="series-btn-close">
              Đóng
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={previewing}
              disabled={submitting}
              className="series-btn-preview"
            >
              Xem trước các buổi
            </Button>
            <Tooltip
              title={
                !isCreateEnabled && previewResult
                  ? isScheduleDirty || previewing
                    ? 'Đang tự động cập nhật lịch xem trước...'
                    : !isFormInSync()
                    ? 'Dữ liệu form đã thay đổi, vui lòng đợi cập nhật'
                    : 'Vui lòng chọn lại ngày/giờ để không còn buổi xung đột'
                  : ''
              }
            >
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleConfirmAndSubmit}
                loading={submitting}
                disabled={!isCreateEnabled}
                className="series-btn-primary"
              >
                Tạo liệu trình ({previewResult?.totalSessions || 0} buổi)
              </Button>
            </Tooltip>
          </Space>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        disabled={submitting}
        style={{ marginTop: 12 }}
      >
        {/* Phần 1: Thông tin người bệnh & bác sĩ */}
        <Row gutter={16}>
          <Col span={13}>
            <Form.Item
              label={<strong>Bệnh nhân</strong>}
              required
              validateStatus={formErrors.patientId ? 'error' : undefined}
              help={formErrors.patientId}
              style={{ marginBottom: 14 }}
            >
              <Row gutter={8}>
                <Col flex="auto">
                  <Form.Item name="patientId" noStyle>
                    <Select
                      showSearch
                      placeholder="Tìm và chọn bệnh nhân tiếp nhận..."
                      optionFilterProp="children"
                      size="middle"
                      options={patients.map((p) => ({
                        value: p.id,
                        label: `${p.fullName || p.name} (${p.patientCode || 'BN'} - ${p.phone || p.phoneNumber || 'Không SĐT'})`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                {onOpenQuickPatient && (
                  <Col flex="85px">
                    <Button
                      icon={<UserAddOutlined />}
                      onClick={onOpenQuickPatient}
                      className="series-btn-quick-patient"
                      style={{ width: '100%' }}
                    >
                      Mới
                    </Button>
                  </Col>
                )}
              </Row>
            </Form.Item>
          </Col>

          <Col span={11}>
            <Form.Item
              name="doctorId"
              label={<strong>Bác sĩ điều trị / phụ trách</strong>}
              required
              validateStatus={formErrors.doctorId ? 'error' : undefined}
              help={formErrors.doctorId}
              style={{ marginBottom: 14 }}
            >
              <Select
                placeholder="Chọn bác sĩ điều trị..."
                size="middle"
                options={doctorList.map((d) => ({
                  value: d.id,
                  label: `${d.fullName || d.username} — ${d.department || 'Chuyên khoa'}`,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Phần 2: Cấu hình chu kỳ & khung giờ khám */}
        <div className="series-form-section">
          <div className="series-section-title">
            <ClockCircleOutlined style={{ color: '#7c3aed' }} /> Cấu hình chu kỳ & thời gian khám
          </div>
          <Row gutter={12}>
            <Col span={5}>
              <Form.Item
                name="startDate"
                label="Ngày bắt đầu"
                required
                style={{ marginBottom: 12 }}
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
                />
              </Form.Item>
            </Col>

            <Col span={5}>
              <Form.Item
                name="startTime"
                label="Giờ bắt đầu"
                required
                validateStatus={formErrors.firstSessionStartTime ? 'error' : undefined}
                help={formErrors.firstSessionStartTime}
                style={{ marginBottom: 12 }}
              >
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={4}>
              <Form.Item
                name="sessionDurationMinutes"
                label="Thời lượng"
                validateStatus={formErrors.sessionDurationMinutes ? 'error' : undefined}
                help={formErrors.sessionDurationMinutes}
                style={{ marginBottom: 12 }}
              >
                <InputNumber min={1} max={480} addonAfter="phút" style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={5}>
              <Form.Item
                name="totalSessions"
                label="Số buổi"
                required
                validateStatus={formErrors.totalSessions ? 'error' : undefined}
                help={formErrors.totalSessions}
                style={{ marginBottom: 12 }}
              >
                <InputNumber min={2} max={30} addonAfter="buổi" style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={5}>
              <Form.Item
                name="intervalDays"
                label="Khoảng cách"
                required
                validateStatus={formErrors.intervalDays ? 'error' : undefined}
                help={formErrors.intervalDays}
                style={{ marginBottom: 12 }}
              >
                <InputNumber min={1} max={90} addonAfter="ngày" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ marginTop: 4, marginBottom: 4, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <InfoCircleOutlined style={{ color: '#7c3aed' }} />
            <span>Hệ thống tự động bỏ qua các ngày nghỉ và ngày nghỉ phép của bác sĩ để đảm bảo xếp đủ số buổi đã chọn.</span>
          </div>
        </div>

        {/* Phần 3: Tiêu đề & Ghi chú */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="title"
              label="Tên / Tiêu đề liệu trình (tùy chọn)"
              validateStatus={formErrors.title ? 'error' : undefined}
              help={formErrors.title}
              style={{ marginBottom: 10 }}
            >
              <Input placeholder="Ví dụ: Liệu trình vật lý trị liệu khớp gối..." maxLength={255} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="notes"
              label="Ghi chú điều trị (tùy chọn)"
              validateStatus={formErrors.notes ? 'error' : undefined}
              help={formErrors.notes}
              style={{ marginBottom: 10 }}
            >
              <Input placeholder="Ghi chú thêm của bác sĩ..." maxLength={1000} />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Divider style={{ margin: '14px 0 10px' }} />

      {/* Phần 4: Danh sách xem trước */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Space size="small">
            <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
              Danh sách các buổi dự kiến ({previewResult?.totalSessions || 0} buổi)
            </Title>
            {previewing || isScheduleDirty ? (
              <Tag color="processing" icon={<LoadingOutlined spin />}>
                Đang cập nhật lịch...
              </Tag>
            ) : !previewResult ? (
              <Tag color="default">Chưa tạo bản xem trước</Tag>
            ) : previewResult.conflictCount === 0 ? (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                {previewResult.totalSessions} buổi sẵn sàng
              </Tag>
            ) : (
              <Tag color="error" icon={<ExclamationCircleOutlined />}>
                {previewResult.conflictCount} buổi bị xung đột lịch hẹn
              </Tag>
            )}
          </Space>
          <Button
            size="small"
            icon={<RedoOutlined />}
            onClick={handlePreview}
            loading={previewing}
            disabled={submitting}
            className="series-btn-refresh-preview"
          >
            Làm mới / Xem trước lại
          </Button>
        </div>

        {previewResult && previewResult.conflictCount > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12, borderRadius: 8 }}
            message="Phát hiện buổi khám bị trùng lịch hẹn với bệnh nhân khác"
            description="Bác sĩ đã có lịch hẹn trùng vào khung giờ này. Vui lòng điều chỉnh Giờ buổi đầu tiên hoặc các thông số phía trên để kiểm tra lại."
          />
        )}

        <div className="series-preview-table-container">
          <Table
            size="small"
            rowKey="sequenceNumber"
            columns={previewColumns}
            dataSource={previewResult?.sessions || []}
            pagination={false}
            loading={previewing}
            locale={{
              emptyText: (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#f5f3ff',
                      color: '#7c3aed',
                      fontSize: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 10px',
                    }}
                  >
                    <CalendarOutlined />
                  </div>
                  <Text strong style={{ fontSize: 14, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Chưa có dữ liệu xem trước các buổi khám
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13, maxWidth: 520, display: 'inline-block', lineHeight: 1.5 }}>
                    Điền thông tin bệnh nhân, bác sĩ và thời gian. Hệ thống sẽ{' '}
                    <strong style={{ color: '#7c3aed' }}>tự động hiển thị lịch xem trước</strong> và tự động tránh ngày nghỉ của bác sĩ.
                  </Text>
                </div>
              ),
            }}
            rowClassName={(record) => (record.status !== 'AVAILABLE' ? 'series-conflict-row' : 'series-available-row')}
            style={{ maxHeight: 280, overflowY: 'auto' }}
          />
        </div>
      </div>
    </Modal>
  )
}
