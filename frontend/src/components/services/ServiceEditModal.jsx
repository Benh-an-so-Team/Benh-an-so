import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Typography,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  EditOutlined,
  InfoCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  suggestNextEffectiveDate,
  formatDateDisplay,
  focusFirstErrorField,
} from '../../utils/serviceCatalogValidation'
import { showNotice } from '../common/notice/index.js'

const { Title, Text } = Typography

function ServiceEditModal({
  open,
  onCancel,
  onFinish,
  form,
  loading,
  formError,
  formErrorDescription,
  onClearError,
  editingService,
  priceHistory = [],
  canSubmit = true,
}) {
  const [priceChanged, setPriceChanged] = useState(false)

  useEffect(() => {
    if (open) {
      setPriceChanged(false)
    }
  }, [open])

  const handleValuesChange = (changedValues) => {
    if (onClearError) onClearError()

    const changedField = Object.keys(changedValues)[0]
    if (changedField && form) {
      form.setFields([{ name: changedField, errors: [] }])
    }

    if (changedValues.price !== undefined) {
      const origPrice = editingService?.price !== null && editingService?.price !== undefined
        ? Number(editingService.price)
        : null
      const currentPrice = changedValues.price !== null && changedValues.price !== undefined
        ? Number(changedValues.price)
        : null

      const isDiff = origPrice !== null && currentPrice !== null && origPrice !== currentPrice
      setPriceChanged(isDiff)

      if (isDiff) {
        const currentDate = form.getFieldValue('effectiveFrom')
        const oldDateStr = editingService?.effectiveFrom
          ? dayjs(editingService.effectiveFrom).format('YYYY-MM-DD')
          : null
        const currentDateStr = currentDate && dayjs(currentDate).isValid()
          ? dayjs(currentDate).format('YYYY-MM-DD')
          : null

        if (oldDateStr && currentDateStr === oldDateStr) {
          const nextDate = suggestNextEffectiveDate(priceHistory)
          form.setFieldsValue({ effectiveFrom: dayjs(nextDate) })
        }
      }
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

  const handleApplySuggestedDate = () => {
    const nextDate = suggestNextEffectiveDate(priceHistory)
    form.setFieldsValue({ effectiveFrom: dayjs(nextDate) })
    if (onClearError) onClearError()
    if (form) {
      form.setFields([{ name: 'effectiveFrom', errors: [] }])
    }
  }

  const suggestedDateStr = suggestNextEffectiveDate(priceHistory)

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
      ? 'Chỉ tài khoản Quản trị viên (Admin) hoặc Quản lý phòng khám (Manager) mới có quyền cập nhật thông tin và điều chỉnh giá dịch vụ.'
      : formError?.includes('Không tìm thấy')
        ? 'Dịch vụ không tồn tại trên hệ thống hoặc đã bị xóa (Lỗi 404). Vui lòng đóng modal và tải lại danh sách dịch vụ.'
        : undefined)

  return (
    <Modal
      className="service-form-modal"
      width={620}
      title={
        <div className="service-modal-title">
          <span className="service-name-icon">
            <EditOutlined />
          </span>
          <div>
            <Title level={4} style={{ margin: 0 }}>Cập nhật dịch vụ & Điều chỉnh giá</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Điều chỉnh tên dịch vụ, đơn giá áp dụng hoặc ngày hiệu lực mới.
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
            description="Tài khoản hiện tại chỉ có quyền xem thông tin. Thao tác lưu thay đổi bị khóa do thiếu quyền SERVICE_CATALOG_UPDATE."
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

        {priceChanged && (
          <Alert
            type="info"
            showIcon
            message="Đơn giá niêm yết đã thay đổi"
            description={
              <span>
                Hệ thống sẽ lưu đơn giá mới vào lịch sử giá. Vui lòng kiểm tra ngày áp dụng bên dưới để mốc giá có hiệu lực đúng thời điểm mong muốn.
              </span>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        <div className="service-form-grid">
          <Form.Item name="serviceCode" label="Mã dịch vụ">
            <Input id="serviceCode" size="large" disabled style={{ background: '#f8fafc', color: '#0f172a', fontWeight: 600 }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên dịch vụ"
            validateTrigger={['onBlur', 'onChange']}
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập tên dịch vụ' },
              { max: 255, message: 'Tên dịch vụ không được vượt quá 255 ký tự' },
            ]}
          >
            <Input id="name" size="large" placeholder="Nhập tên dịch vụ" />
          </Form.Item>

          <Form.Item
            name="price"
            label="Đơn giá niêm yết"
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
            label="Ngày hiệu lực giá"
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
              <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
                <Button
                  size="small"
                  type="dashed"
                  onClick={handleApplySuggestedDate}
                  style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                >
                  Gợi ý ngày hợp lệ ({formatDateDisplay(suggestedDateStr)})
                </Button>
              </div>
            </div>
          </Form.Item>

          <Form.Item className="service-form-full" name="active" label="Trạng thái áp dụng">
            <Radio.Group size="large" buttonStyle="solid">
              <Radio.Button value={true}>
                <CheckCircleOutlined style={{ color: '#10b981', marginRight: 6 }} />
                Đang hiệu lực
              </Radio.Button>
              <Radio.Button value={false}>
                <StopOutlined style={{ color: '#ef4444', marginRight: 6 }} />
                Ngừng áp dụng
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
        </div>

        <div className="service-modal-hint" style={{ marginTop: 8 }}>
          <InfoCircleOutlined />
          <span>
            Khi cập nhật đơn giá kèm ngày hiệu lực mới, hệ thống sẽ tự động lưu phiên bản giá mới vào lịch sử giá mà không ảnh hưởng đến các hóa đơn đã lập trước đó.
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
            Lưu thay đổi
          </Button>
        </div>
      </Form>
    </Modal>
  )
}

export default ServiceEditModal
