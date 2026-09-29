import React, { useEffect, useState } from 'react'
import {
  Modal,
  Form,
  Input,
  Button,
  Descriptions,
  message,
  Typography,
  Space,
} from 'antd'
import dayjs from 'dayjs'
import personalDataRequestApi from '../../api/personalDataRequestApi.js'
import {
  getRequestTypeLabel,
  validateCompleteForm,
  mapPersonalDataRequestError,
} from '../../utils/personalDataRequestHelpers.js'

const { TextArea } = Input
const { Text } = Typography

/**
 * Modal Hoàn tất xử lý yêu cầu dữ liệu cá nhân (Quản trị viên)
 */
const CompletePersonalDataRequestModal = ({
  open,
  onClose,
  onSuccess,
  request,
  patientName = '',
}) => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      form.resetFields()
    }
  }, [open, form])

  const handleConfirmSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        const validation = validateCompleteForm(values.result)
        if (!validation.isValid) {
          message.warning(validation.errors.result)
          return
        }

        Modal.confirm({
          title: 'Xác nhận hoàn tất xử lý yêu cầu?',
          content:
            'Hành động này sẽ cập nhật trạng thái yêu cầu sang "ĐÃ HOÀN TẤT" và lưu bằng chứng xử lý. Sau khi hoàn tất, yêu cầu sẽ không thể chỉnh sửa tiếp.',
          okText: 'Xác nhận hoàn tất',
          cancelText: 'Quay lại',
          okButtonProps: { type: 'primary' },
          onOk: async () => {
            await executeComplete(values.result.trim())
          },
        })
      })
      .catch(() => {
        // Form field errors handled by Ant Design
      })
  }

  const executeComplete = async (resultText) => {
    if (!request?.id) return

    setSubmitting(true)
    try {
      await personalDataRequestApi.complete(request.id, resultText)
      message.success('Đã hoàn tất xử lý yêu cầu dữ liệu cá nhân!')
      form.resetFields()
      onSuccess?.()
      onClose?.()
    } catch (err) {
      const errorMsg = mapPersonalDataRequestError(err, 'Không thể hoàn tất xử lý yêu cầu.')
      message.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Hoàn tất xử lý yêu cầu</span>
        </Space>
      }
      open={open}
      onCancel={() => !submitting && onClose?.()}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Đóng
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          disabled={submitting}
          onClick={handleConfirmSubmit}
        >
          Hoàn tất xử lý
        </Button>,
      ]}
      maskClosable={!submitting}
      destroyOnClose
      width={600}
    >
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Người bệnh">
            <Text strong>{patientName || request?.patientName || request?.patientId || '---'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Loại yêu cầu">
            {getRequestTypeLabel(request?.requestType)}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày tiếp nhận">
            {request?.receivedAt ? dayjs(request.receivedAt).format('DD/MM/YYYY HH:mm') : '---'}
          </Descriptions.Item>
          <Descriptions.Item label="Hạn xử lý">
            {request?.dueAt ? dayjs(request.dueAt).format('DD/MM/YYYY HH:mm') : '---'}
          </Descriptions.Item>
          {request?.reason && (
            <Descriptions.Item label="Lý do gửi">
              <span style={{ whiteSpace: 'pre-wrap' }}>{request.reason}</span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>

      <Form form={form} layout="vertical" disabled={submitting}>
        <Form.Item
          name="result"
          label={<span style={{ fontWeight: 500 }}>Kết quả / Bằng chứng xử lý</span>}
          rules={[
            { required: true, message: 'Vui lòng nhập kết quả hoặc bằng chứng đã xử lý.' },
            { max: 2000, message: 'Kết quả xử lý không được vượt quá 2000 ký tự.' },
          ]}
          extra="Ghi rõ hành động đã thực hiện (ví dụ: đã bàn giao bản sao HSBA, đã cung cấp dữ liệu, v.v.) làm căn cứ lưu vết."
        >
          <TextArea
            rows={5}
            placeholder="Nhập chi tiết kết quả xử lý và bằng chứng giải quyết yêu cầu..."
            maxLength={2000}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CompletePersonalDataRequestModal
