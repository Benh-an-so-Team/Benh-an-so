import React from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Typography,
} from 'antd'
import {
  CalendarOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { focusFirstErrorField } from '../../utils/serviceCatalogValidation'
import { showNotice } from '../common/notice/index.js'

const { Title, Text } = Typography

function ServiceCreateModal({
  open,
  onCancel,
  onFinish,
  form,
  loading,
  formError,
  formErrorDescription,
  onClearError,
  canSubmit = true,
}) {
  const handleValuesChange = (changedValues) => {
    if (onClearError) onClearError()
    const changedField = Object.keys(changedValues)[0]
    if (changedField && form) {
      form.setFields([{ name: changedField, errors: [] }])
    }
  }

  const handleFinishFailed = (errorInfo) => {
    const errorFields = errorInfo?.errorFields || []
    if (errorFields.length > 0) {
      const firstField = errorFields[0]
      const fieldName = Array.isArray(firstField.name) ? firstField.name[0] : firstField.name
      if (form?.scrollToField) {
        form.scrollToField(fieldName, { behavior: 'smooth', block: 'center' })
      }
      setTimeout(() => {
        focusFirstErrorField(fieldName)
      }, 100)
      showNotice.validationSummary({ errorCount: errorFields.length })
    }
  }

  const isFieldLevelError = Boolean(
    formError && (
      formError.includes('Tên dịch vụ') ||
      formError.includes('Mã dịch vụ') ||
      formError.includes('Giá dịch vụ') ||
      formError.includes('Đơn giá') ||
      formError.includes('ngày hiệu lực') ||
      formError.includes('mức giá')
    )
  )

  const computedDescription =
    formErrorDescription ||
    (formError?.includes('không có quyền')
      ? 'Chỉ tài khoản Quản trị viên (Admin) hoặc Quản lý phòng khám (Manager) mới có quyền tạo dịch vụ mới.'
      : formError?.includes('Không tìm thấy')
        ? 'Đường dẫn dịch vụ không tồn tại (Lỗi 404). Vui lòng kiểm tra lại cấu hình hệ thống.'
        : undefined)

  return (
    <Modal
      className="service-form-modal"
      width={620}
      title={
        <div className="service-modal-title">
          <span className="service-name-icon">
            <PlusOutlined />
          </span>
          <div>
            <Title level={4} style={{ margin: 0 }}>Thêm dịch vụ khám mới</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Nhập mã dịch vụ, tên dịch vụ và thiết lập mức giá niêm yết ban đầu.
            </Text>
          </div>
        </div>
      }
      open={open}
      footer={null}
      centered
      destroyOnClose
      maskClosable={!loading}
      closable={!loading}
      onCancel={onCancel}
    >
      <Form
        className="service-form"
        form={form}
        layout="vertical"
        validateTrigger={['onBlur', 'onChange']}
        scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
        onFinish={onFinish}
        onFinishFailed={handleFinishFailed}
        onValuesChange={handleValuesChange}
      >
        {!canSubmit && (
          <Alert
            type="warning"
            showIcon
            message="Chế độ chỉ xem"
            description="Tài khoản hiện tại chỉ có quyền xem danh mục. Thao tác tạo dịch vụ bị khóa do thiếu quyền SERVICE_CATALOG_CREATE."
            style={{ marginBottom: 16 }}
          />
        )}

        {formError && !isFieldLevelError && (
          <Alert
            className="service-modal-alert"
            type="error"
            showIcon
            message={<span style={{ fontWeight: 600 }}>{formError}</span>}
            description={computedDescription}
            closable
            onClose={onClearError}
            style={{ marginBottom: 16 }}
          />
        )}

        <div className="service-form-grid">
          <Form.Item
            name="serviceCode"
            label="Mã dịch vụ"
            normalize={(val) => (val ? String(val).toUpperCase() : val)}
            validateTrigger={['onBlur', 'onChange']}
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập mã dịch vụ' },
              { max: 50, message: 'Mã dịch vụ không được vượt quá 50 ký tự' },
              {
                pattern: /^[A-Za-z0-9_.-]+$/,
                message: 'Mã dịch vụ chỉ gồm chữ cái, chữ số, gạch ngang (-) hoặc gạch dưới (_)',
              },
            ]}
          >
            <Input id="serviceCode" size="large" placeholder="VD: DV-KHAM-NOI, XQ-TIM-PHOI..." />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên dịch vụ khám / thủ thuật"
            validateTrigger={['onBlur', 'onChange']}
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập tên dịch vụ' },
              { max: 255, message: 'Tên dịch vụ không được vượt quá 255 ký tự' },
            ]}
          >
            <Input id="name" size="large" placeholder="Nhập tên dịch vụ y tế" />
          </Form.Item>

          <Form.Item
            name="price"
            label="Đơn giá niêm yết ban đầu"
            validateTrigger={['onBlur', 'onChange']}
            rules={[
              {
                validator: (_, value) => {
                  if (value === null || value === undefined || value === '') {
                    return Promise.reject(new Error('Vui lòng nhập giá dịch vụ'))
                  }
                  const numeric = Number(value)
                  if (Number.isNaN(numeric)) {
                    return Promise.reject(new Error('Giá dịch vụ phải là số'))
                  }
                  if (numeric < 0) {
                    return Promise.reject(new Error('Giá dịch vụ không được là số âm'))
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <InputNumber
              id="price"
              size="large"
              step={10000}
              controls={false}
              formatter={(val) => `${val || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(val) => val?.replace(/\./g, '') || ''}
              addonAfter="₫"
              placeholder="0"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="effectiveFrom"
            label="Ngày bắt đầu hiệu lực"
            validateTrigger={['onBlur', 'onChange']}
            rules={[{ required: true, message: 'Vui lòng chọn ngày hiệu lực' }]}
          >
            <div>
              <DatePicker
                id="effectiveFrom"
                size="large"
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                placeholder="Chọn ngày áp dụng"
              />
              <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Chọn nhanh:</Text>
                <Button
                  size="small"
                  type="dashed"
                  icon={<CalendarOutlined />}
                  onClick={() => {
                    form.setFieldsValue({ effectiveFrom: dayjs() })
                    if (onClearError) onClearError()
                    form.setFields([{ name: 'effectiveFrom', errors: [] }])
                  }}
                  style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                >
                  Hôm nay
                </Button>
                <Button
                  size="small"
                  type="dashed"
                  onClick={() => {
                    form.setFieldsValue({ effectiveFrom: dayjs().add(1, 'day') })
                    if (onClearError) onClearError()
                    form.setFields([{ name: 'effectiveFrom', errors: [] }])
                  }}
                  style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                >
                  Ngày mai
                </Button>
              </div>
            </div>
          </Form.Item>
        </div>

        <div className="service-modal-hint" style={{ marginTop: 8 }}>
          <InfoCircleOutlined />
          <span>
            Đơn giá này sẽ tự động có hiệu lực kể từ ngày được chỉ định và áp dụng trực tiếp khi lập hóa đơn thu phí cho bệnh nhân.
          </span>
        </div>

        <div className="service-modal-actions">
          <Button onClick={onCancel} disabled={loading}>
            Hủy bỏ
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            disabled={loading || !canSubmit}
            style={{ background: '#2563eb' }}
          >
            Lưu dịch vụ
          </Button>
        </div>
      </Form>
    </Modal>
  )
}

export default ServiceCreateModal
