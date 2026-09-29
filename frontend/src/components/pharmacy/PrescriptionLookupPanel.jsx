import React, { useState, useRef, useCallback } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  BarcodeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import pharmacyApi from '../../api/pharmacyApi.js'
import {
  normalizeCode,
  getPrescriptionStatusLabel,
  isDispensable,
  getDispenseBlockedReason,
  getStatusBadgeConfig,
  PRESCRIPTION_STATUS,
} from '../../utils/prescriptionLookupHelpers.js'
import { fixMojibake } from '../../utils/workflowContract.js'
import { getApiErrorMessage } from '../../utils/apiError.js'

const { Text, Title } = Typography

const formatDateTime = (value) =>
  value && dayjs(value).isValid() ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—'

export default function PrescriptionLookupPanel({ canDispense = true, onDispenseSuccess }) {
  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [dispensing, setDispensing] = useState(false)
  const [prescription, setPrescription] = useState(null)
  const [validationError, setValidationError] = useState('')
  const [apiErrorState, setApiErrorState] = useState(null) // { type: '400'|'403'|'404'|'5xx', message: string, code: string }
  const [isInputFocused, setIsInputFocused] = useState(false)

  const abortControllerRef = useRef(null)

  const handleLookup = useCallback(async (codeToLookup) => {
    const rawInput = typeof codeToLookup === 'string' ? codeToLookup : inputCode
    const normalized = normalizeCode(rawInput)

    if (!normalized) {
      setValidationError('Mã đơn không hợp lệ hoặc chưa được nhập')
      setApiErrorState(null)
      return
    }

    setValidationError('')
    setApiErrorState(null)

    // Abort previous pending lookup request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    try {
      const response = await pharmacyApi.lookupPrescriptionByCode(normalized, controller.signal)
      setPrescription(response.data)
      setApiErrorState(null)
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return // Ignored canceled requests
      }

      setPrescription(null)
      const status = err.response?.status
      if (status === 400) {
        setApiErrorState({
          type: '400',
          message: 'Mã đơn không hợp lệ hoặc chưa được nhập',
          code: normalized,
        })
      } else if (status === 403) {
        setApiErrorState({
          type: '403',
          message: 'Bạn không có quyền tra cứu đơn thuốc này',
          code: normalized,
        })
      } else if (status === 404) {
        setApiErrorState({
          type: '404',
          message: 'Không tìm thấy đơn thuốc với mã đã nhập',
          code: normalized,
        })
      } else {
        setApiErrorState({
          type: '5xx',
          message: getApiErrorMessage(err, 'Lỗi kết nối máy chủ khi tra cứu đơn thuốc.'),
          code: normalized,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [inputCode])

  const handleDispense = async () => {
    if (!prescription) return
    if (!canDispense) {
      message.error('Bạn không có quyền cấp phát đơn thuốc.')
      return
    }

    if (!isDispensable(prescription.status)) {
      message.error(getDispenseBlockedReason(prescription.status) || 'Đơn thuốc không thể cấp phát.')
      return
    }

    setDispensing(true)
    try {
      await pharmacyApi.dispense(prescription.id)
      message.success(`Đã cấp phát thành công đơn thuốc ${prescription.prescriptionCode || prescription.id}`)
      
      // Update local state to DISPENSED
      setPrescription((prev) => (prev ? { ...prev, status: PRESCRIPTION_STATUS.DISPENSED } : null))
      
      // Notify parent page to refresh queue/inventory if prescription was in queue
      if (typeof onDispenseSuccess === 'function') {
        onDispenseSuccess(prescription)
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể cấp phát đơn thuốc. Vui lòng thử lại.'))
    } finally {
      setDispensing(false)
    }
  }

  const columns = [
    {
      title: 'Tên thuốc & Hoạt chất',
      key: 'medicine',
      render: (_, item) => (
        <Space direction="vertical" size={2}>
          <Text strong>{item.medicineName || '—'}</Text>
          <Text orientation="horizontal" type="secondary" style={{ fontSize: 12 }}>
            {[item.activeIngredient, item.strength].filter(Boolean).join(' · ')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Đường dùng / Cách dùng',
      key: 'usage',
      render: (_, item) => (
        <Space direction="vertical" size={1}>
          {item.route && <Tag color="blue">{item.route}</Tag>}
          <Text style={{ fontSize: 13 }}>{item.instructions || item.dosage || '—'}</Text>
        </Space>
      ),
    },
    {
      title: 'Số lượng kê',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      width: 120,
      render: (qty, item) => (
        <Text strong>
          {qty} {item.unit || ''}
        </Text>
      ),
    },
    {
      title: 'Đã cấp',
      dataIndex: 'dispensedQuantity',
      key: 'dispensedQuantity',
      align: 'center',
      width: 100,
      render: (dispensed, item) => (
        <Text style={{ color: Number(dispensed) > 0 ? '#16a34a' : '#64748b' }}>
          {dispensed ?? 0} {item.unit || ''}
        </Text>
      ),
    },
    {
      title: 'Còn lại',
      dataIndex: 'remainingQuantity',
      key: 'remainingQuantity',
      align: 'center',
      width: 100,
      render: (remaining, item) => {
        const val = remaining !== undefined ? remaining : Math.max(0, (item.quantity || 0) - (item.dispensedQuantity || 0))
        return (
          <Text strong style={{ color: val > 0 ? '#d97706' : '#64748b' }}>
            {val} {item.unit || ''}
          </Text>
        )
      },
    },
  ]

  const statusConfig = prescription ? getStatusBadgeConfig(prescription.status) : null
  const dispensable = prescription ? isDispensable(prescription.status) : false
  const blockedReason = prescription ? getDispenseBlockedReason(prescription.status) : null

  return (
    <Card
      title={(
        <Space align="center" size={8}>
          <BarcodeOutlined style={{ color: '#1677ff', fontSize: 18 }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Tra cứu đơn thuốc bằng mã đơn khi cấp phát</span>
        </Space>
      )}
      style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      <div style={{ maxWidth: 680, marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: isInputFocused ? '1.5px solid #1677ff' : '1.5px solid #d9d9d9',
            borderRadius: 8,
            padding: '3px 4px 3px 12px',
            boxShadow: isInputFocused
              ? '0 0 0 3px rgba(22, 119, 255, 0.12)'
              : '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.2s ease',
          }}
        >
          <BarcodeOutlined
            style={{
              color: isInputFocused ? '#1677ff' : '#64748b',
              fontSize: 18,
              marginRight: 8,
              transition: 'color 0.2s ease',
            }}
          />
          <Input
            bordered={false}
            placeholder="Nhập mã đơn thuốc điện tử trên bản in (ví dụ: RX000001)"
            value={inputCode}
            onChange={(e) => {
              setInputCode(e.target.value)
              if (validationError) setValidationError('')
            }}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onPressEnter={() => handleLookup()}
            allowClear
            disabled={loading}
            style={{
              flex: 1,
              fontSize: 14.5,
              fontWeight: 500,
              padding: '6px 4px',
            }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => handleLookup()}
            style={{
              height: 38,
              padding: '0 20px',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 4px rgba(22, 119, 255, 0.2)',
            }}
          >
            Tra cứu
          </Button>
        </div>

        {validationError && (
          <div style={{ color: '#dc2626', fontSize: 13, marginTop: 6, fontWeight: 500 }}>
            {validationError}
          </div>
        )}

        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Gợi ý mã thử nhanh:</Text>
          <Tag
            color="blue"
            style={{ cursor: 'pointer', fontSize: 12, borderRadius: 4 }}
            onClick={() => {
              setInputCode('RX000003')
              setValidationError('')
              handleLookup('RX000003')
            }}
          >
            RX000003 (Chưa cấp)
          </Tag>
          <Tag
            color="default"
            style={{ cursor: 'pointer', fontSize: 12, borderRadius: 4 }}
            onClick={() => {
              setInputCode('RX000007')
              setValidationError('')
              handleLookup('RX000007')
            }}
          >
            RX000007 (Đơn cũ 11/08)
          </Tag>
          <Tag
            color="red"
            style={{ cursor: 'pointer', fontSize: 12, borderRadius: 4 }}
            onClick={() => {
              setInputCode('RX000004')
              setValidationError('')
              handleLookup('RX000004')
            }}
          >
            RX000004 (Đã hủy)
          </Tag>
        </div>
      </div>

      {/* Error Displays */}
      {apiErrorState && (
        <div style={{ marginBottom: 16 }}>
          {apiErrorState.type === '400' && (
            <Alert
              type="warning"
              showIcon
              message={apiErrorState.message}
              description={`Mã đơn "${apiErrorState.code}" không đúng định dạng quy chuẩn điện tử (ví dụ: RX000001).`}
            />
          )}

          {apiErrorState.type === '403' && (
            <Alert
              type="warning"
              showIcon
              message={apiErrorState.message}
              description="Tài khoản hiện tại không có quyền xem thông tin đơn thuốc này (Bác sĩ chỉ có quyền tra cứu đơn thuộc ca khám do mình phụ trách)."
            />
          )}

          {apiErrorState.type === '404' && (
            <Alert
              type="info"
              showIcon
              icon={<InfoCircleOutlined style={{ color: '#0ea5e9' }} />}
              message={apiErrorState.message}
              description={`Không tìm thấy đơn thuốc khớp với mã "${apiErrorState.code}". Vui lòng kiểm tra lại bản in hoặc liên hệ bộ phận tiếp đón.`}
              style={{ backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }}
            />
          )}

          {apiErrorState.type === '5xx' && (
            <Alert
              type="error"
              showIcon
              message="Lỗi hệ thống khi tra cứu đơn thuốc"
              description={apiErrorState.message}
              action={
                <Button
                  size="small"
                  danger
                  icon={<ReloadOutlined />}
                  onClick={() => handleLookup(apiErrorState.code)}
                >
                  Thử lại
                </Button>
              }
            />
          )}
        </div>
      )}

      {/* Results Card */}
      {prescription && (
        <div style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <Space align="center" wrap size={8}>
              <Tag
                color="blue"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  padding: '3px 12px',
                  letterSpacing: 0.5,
                  backgroundColor: '#eff6ff',
                  borderColor: '#93c5fd',
                  color: '#1d4ed8',
                }}
              >
                <BarcodeOutlined style={{ marginRight: 6 }} />
                {prescription.prescriptionCode || prescription.id}
              </Tag>

              <Tooltip title="Sao chép mã đơn">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined style={{ color: '#2563eb' }} />}
                  onClick={() => {
                    const code = prescription.prescriptionCode || prescription.id
                    navigator.clipboard.writeText(code)
                    message.success(`Đã sao chép mã đơn: ${code}`)
                  }}
                />
              </Tooltip>

              <Tag color={statusConfig.color} style={{ fontSize: 13, fontWeight: 600, padding: '2px 8px' }}>
                {statusConfig.label}
              </Tag>
            </Space>

            {dispensable ? (
              <Popconfirm
                title="Xác nhận cấp phát đơn thuốc"
                description={(
                  <div style={{ maxWidth: 350, marginTop: 4 }}>
                    <div>Bạn có chắc chắn muốn thực hiện cấp phát cho đơn thuốc <strong>{prescription.prescriptionCode}</strong>?</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>
                      Bệnh nhân: <strong>{fixMojibake(prescription.patientName)}</strong> ({prescription.patientCode})
                    </div>
                  </div>
                )}
                okText="Xác nhận cấp phát"
                cancelText="Hủy"
                onConfirm={handleDispense}
                okButtonProps={{ loading: dispensing, type: 'primary' }}
                disabled={!canDispense}
              >
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  loading={dispensing}
                  disabled={!canDispense}
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
                >
                  Cấp phát thuốc
                </Button>
              </Popconfirm>
            ) : (
              <Alert
                type={prescription.status === PRESCRIPTION_STATUS.CANCELLED ? 'error' : 'info'}
                showIcon
                message={blockedReason}
                style={{ padding: '4px 12px', margin: 0 }}
              />
            )}
          </div>

          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 16, backgroundColor: '#ffffff' }}>
            <Descriptions.Item label="Bệnh nhân">
              <strong>{fixMojibake(prescription.patientName) || '—'}</strong> ({prescription.patientCode || '—'})
            </Descriptions.Item>
            <Descriptions.Item label="Lượt khám">
              {prescription.visitCode || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Bác sĩ kê đơn">
              {prescription.doctorName || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày kê đơn">
              {formatDateTime(prescription.prescribedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái cấp phát">
              <Tag color={statusConfig.color} style={{ fontWeight: 600 }}>{statusConfig.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú">
              {prescription.note || 'Không có'}
            </Descriptions.Item>
            {prescription.cancelReason && (
              <Descriptions.Item label="Lý do hủy" span={3}>
                <Text type="danger">{prescription.cancelReason}</Text>
              </Descriptions.Item>
            )}
            {prescription.replacedByPrescriptionCode && (
              <Descriptions.Item label="Đơn thay thế" span={3}>
                <Text type="warning">Đã được thay thế bởi đơn: {prescription.replacedByPrescriptionCode}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
              Danh mục thuốc trong đơn ({prescription.items?.length || 0} loại):
            </div>
            <Table
              rowKey={(record, idx) => record.id || record.medicineId || idx}
              columns={columns}
              dataSource={prescription.items || []}
              pagination={false}
              size="small"
              locale={{ emptyText: 'Đơn thuốc không có danh mục thuốc.' }}
              style={{ backgroundColor: '#ffffff' }}
            />
          </div>
        </div>
      )}
    </Card>
  )
}
