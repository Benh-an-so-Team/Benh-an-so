import React, { useEffect, useState } from 'react'
import {
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  Button,
  message,
  Space,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import patientApi from '../../api/patientApi.js'
import personalDataRequestApi from '../../api/personalDataRequestApi.js'
import {
  REQUEST_TYPE_OPTIONS,
  validateCreateForm,
  mapPersonalDataRequestError,
} from '../../utils/personalDataRequestHelpers.js'

const { Option } = Select
const { TextArea } = Input

/**
 * Modal Tiếp nhận yêu cầu về dữ liệu cá nhân mới (Quản trị viên)
 */
const CreatePersonalDataRequestModal = ({
  open,
  onClose,
  onSuccess,
  initialPatientId = null,
}) => {
  const [form] = Form.useForm()
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Nạp danh sách bệnh nhân khi modal mở ra
  useEffect(() => {
    if (!open) {
      form.resetFields()
      return
    }

    let active = true
    const fetchPatients = async () => {
      setPatientsLoading(true)
      try {
        const res = await patientApi.getAll({ page: 0, size: 500 })
        if (!active) return
        const list = Array.isArray(res.data?.content)
          ? res.data.content
          : Array.isArray(res.data)
          ? res.data
          : []
        setPatients(list)
      } catch (err) {
        if (active) {
          message.error('Không thể tải danh sách bệnh nhân. Vui lòng thử lại.')
        }
      } finally {
        if (active) setPatientsLoading(false)
      }
    }

    fetchPatients()

    // Giá trị khởi tạo mặc định: hạn xử lý là 3 ngày sau vào lúc 17:00
    const defaultDue = dayjs().add(3, 'day').hour(17).minute(0).second(0)
    form.setFieldsValue({
      patientId: initialPatientId || undefined,
      requestType: 'MEDICAL_RECORD_COPY',
      dueAt: defaultDue,
      reason: '',
    })

    return () => {
      active = false
    }
  }, [open, initialPatientId, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const now = new Date()
      const dueAtIso = values.dueAt ? values.dueAt.toISOString() : null

      // Validate nghiệp vụ client-side
      const validation = validateCreateForm(
        values.patientId,
        values.requestType,
        values.reason,
        dueAtIso,
        now
      )

      if (!validation.isValid) {
        const firstErrorKey = Object.keys(validation.errors)[0]
        message.warning(validation.errors[firstErrorKey])
        return
      }

      setSubmitting(true)
      const payload = {
        patientId: values.patientId,
        requestType: values.requestType,
        reason: values.reason.trim(),
        dueAt: dueAtIso,
      }

      await personalDataRequestApi.create(payload)
      message.success('Đã ghi nhận yêu cầu dữ liệu cá nhân thành công!')
      form.resetFields()
      onSuccess?.()
      onClose?.()
    } catch (err) {
      if (err?.errorFields) {
        // Ant Design validation failure
        return
      }
      const errorMsg = mapPersonalDataRequestError(err, 'Không thể tạo yêu cầu dữ liệu cá nhân.')
      message.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // Chặn chọn ngày trong quá khứ
  const disabledDate = (current) => {
    return current && current < dayjs().startOf('day')
  }

  return (
    <Modal
      title={
        <Space>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Tiếp nhận yêu cầu về dữ liệu cá nhân</span>
        </Space>
      }
      open={open}
      onCancel={() => !submitting && onClose?.()}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Hủy bỏ
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          Ghi nhận yêu cầu
        </Button>,
      ]}
      maskClosable={!submitting}
      destroyOnClose
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        disabled={submitting}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="patientId"
          label={<span style={{ fontWeight: 500 }}>Chọn người bệnh</span>}
          rules={[{ required: true, message: 'Vui lòng chọn bệnh nhân.' }]}
        >
          <Select
            showSearch
            placeholder="Tìm theo mã hoặc tên bệnh nhân..."
            loading={patientsLoading}
            filterOption={(input, option) =>
              String(option?.children || '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            {patients.map((p) => (
              <Option key={p.id} value={p.id}>
                {p.patientCode ? `[${p.patientCode}] ` : ''}
                {p.fullName} {p.phone ? `(${p.phone})` : ''}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="requestType"
          label={<span style={{ fontWeight: 500 }}>Loại yêu cầu</span>}
          rules={[{ required: true, message: 'Vui lòng chọn loại yêu cầu.' }]}
        >
          <Select placeholder="Chọn loại yêu cầu dữ liệu...">
            {Object.entries(REQUEST_TYPE_OPTIONS).map(([val, label]) => (
              <Option key={val} value={val}>
                {label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="dueAt"
          label={<span style={{ fontWeight: 500 }}>Hạn xử lý</span>}
          rules={[{ required: true, message: 'Vui lòng chọn hạn xử lý.' }]}
          extra="Hạn giải quyết không được trước thời điểm tiếp nhận hiện tại."
        >
          <DatePicker
            showTime={{ format: 'HH:mm' }}
            format="DD/MM/YYYY HH:mm"
            disabledDate={disabledDate}
            style={{ width: '100%' }}
            placeholder="Chọn ngày và giờ hạn xử lý"
          />
        </Form.Item>

        <Form.Item
          name="reason"
          label={<span style={{ fontWeight: 500 }}>Lý do yêu cầu</span>}
          rules={[
            { required: true, message: 'Vui lòng nhập lý do yêu cầu.' },
            { max: 2000, message: 'Lý do yêu cầu không được vượt quá 2000 ký tự.' },
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Nhập lý do hoặc căn cứ người bệnh gửi yêu cầu..."
            maxLength={2000}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CreatePersonalDataRequestModal
