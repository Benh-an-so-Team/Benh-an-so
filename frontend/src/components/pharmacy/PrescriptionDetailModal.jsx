import React, { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  AlertOutlined,
  BarcodeOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  EditOutlined,
  FileTextOutlined,
  HistoryOutlined,
  MedicineBoxOutlined,
  PlusCircleOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  UserOutlined,
  WarningOutlined,
  FireOutlined,
  StopOutlined,
  BookOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import pharmacyApi from '../../api/pharmacyApi'
import { fixMojibake } from '../../utils/serviceCatalogValidation'
import {
  formatPrescriptionCode,
  getInterconnectionStatusInfo,
  isStandardRxCode,
} from '../../utils/electronicPrescriptionValidation'
import SpecialControlBadge from './SpecialControlBadge.jsx'
import { useAuthContext } from '../../context/AuthContext'
import { canSaveAsTemplate } from '../../utils/prescriptionTemplateHelpers.js'
import SaveAsTemplateModal from '../prescription/SaveAsTemplateModal.jsx'

const { Text, Paragraph, Title } = Typography

const ROUTE_LABELS = {
  ORAL: 'Uống',
  TOPICAL: 'Bôi ngoài da',
  INHALATION: 'Hít / Khí dung',
  OPHTHALMIC: 'Nhỏ / Tra mắt',
  NASAL: 'Xịt / Nhỏ mũi',
  OTIC: 'Nhỏ tai',
  SUBLINGUAL: 'Ngậm dưới lưỡi',
  RECTAL: 'Đặt hậu môn / Trực tràng',
  INTRAVENOUS: 'Tiêm tĩnh mạch',
  INTRAMUSCULAR: 'Tiêm bắp',
  SUBCUTANEOUS: 'Tiêm dưới da',
  TRANSDERMAL: 'Dán ngoài da',
  VAGINAL: 'Đặt âm đạo',
  OTHER: 'Cách dùng khác',
}

function PrescriptionDetailModal({
  open,
  onClose,
  prescription,
  medicines = [],
  onEditClick,
  onPrintClick,
  onInterconnectionUpdated,
  canEdit = false,
  canCancel = false,
  onCancelClick,
  canSendInterconnection = true,
  diagnoses = [],
  onTemplateSaved,
}) {
  const { user } = useAuthContext()
  const [sendingInterconnection, setSendingInterconnection] = useState(false)
  const [interconnectionState, setInterconnectionState] = useState(null)
  const [printing, setPrinting] = useState(false)
  const [allergyLogs, setAllergyLogs] = useState([])
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false)

  const currentUserId = user?.id
  const userRoles = user?.roles || []
  const canSaveTemplate = canSaveAsTemplate({
    prescription,
    currentUserId,
    userRoles,
  }).allowed

  useEffect(() => {
    if (prescription) {
      setInterconnectionState({
        status: prescription.interconnectionStatus || (prescription.receiptCode ? 'SUCCESS' : 'NOT_SENT'),
        receiptCode: prescription.interconnectionReceiptCode || prescription.receiptCode || '',
        failureReason: prescription.lastInterconnectionError || prescription.failureReason || '',
        completedAt: prescription.lastInterconnectionAt || prescription.completedAt || '',
      })

      if (prescription.id) {
        pharmacyApi
          .getAllergyWarningLogs({ prescriptionId: prescription.id })
          .then((res) => {
            const data = res?.data || {}
            const items = data.content || (Array.isArray(data) ? data : [])
            setAllergyLogs(items)
          })
          .catch(() => setAllergyLogs([]))
      }
    }
  }, [prescription])

  if (!prescription) return null

  const getMedicineName = (id, fallback) => {
    const found = medicines.find((m) => String(m.id) === String(id))
    return fixMojibake(found?.medicineName || found?.name || fallback || id || '—')
  }

  const items = prescription.items || []
  const warnings = prescription.warnings || []
  const historyLogs = prescription.amendments || prescription.historyLogs || []

  const currentInterconnection = interconnectionState || {
    status: prescription.interconnectionStatus || 'NOT_SENT',
    receiptCode: prescription.interconnectionReceiptCode || prescription.receiptCode || '',
    failureReason: prescription.lastInterconnectionError || prescription.failureReason || '',
    completedAt: prescription.lastInterconnectionAt || '',
  }

  const interInfo = getInterconnectionStatusInfo(
    currentInterconnection.status,
    currentInterconnection.receiptCode,
    currentInterconnection.failureReason,
  )

  const handleSendInterconnection = async () => {
    if (!prescription?.id || sendingInterconnection) return
    setSendingInterconnection(true)
    try {
      const res = await pharmacyApi.sendToInterconnection(prescription.id)
      const data = res.data || {}
      const newState = {
        status: data.status,
        receiptCode: data.receiptCode || '',
        failureReason: data.failureReason || '',
        completedAt: data.completedAt || new Date().toISOString(),
      }
      setInterconnectionState(newState)
      if (data.status === 'SUCCESS') {
        message.success(`Đã gửi đơn lên Cổng liên thông Quốc gia thành công! Mã tiếp nhận: ${data.receiptCode}`)
      } else {
        message.error(`Gửi liên thông thất bại: ${data.failureReason || 'Cổng liên thông từ chối tiếp nhận'}`)
      }
      if (onInterconnectionUpdated) {
        onInterconnectionUpdated(prescription.id, newState)
      }
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Không thể gửi đơn thuốc lên cổng liên thông.'
      message.error(msg)
    } finally {
      setSendingInterconnection(false)
    }
  }

  const itemColumns = [
    {
      title: 'STT',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Tên thuốc / Hàm lượng',
      key: 'medicineName',
      render: (_, item) => {
        const med = (medicines || []).find((m) => String(m.id) === String(item.medicineId))
        const isSpecial = Boolean(item.isSpecialControl || med?.isSpecialControl)
        const sGroup = item.specialControlGroup || med?.specialControlGroup
        return (
          <div>
            <Text strong style={{ color: '#1e40af' }}>
              {item.medicineName || getMedicineName(item.medicineId)}
            </Text>
            {item.strength && <Text type="secondary" style={{ marginLeft: 6 }}>({item.strength})</Text>}
            {isSpecial && (
              <div style={{ marginTop: 2 }}>
                <SpecialControlBadge isSpecialControl={true} group={sGroup} />
              </div>
            )}
            {item.activeIngredient && (
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Hoạt chất: {item.activeIngredient}
              </div>
            )}
            {item.specialControlReason && (
              <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 2 }}>
                <strong>Lý do chỉ định:</strong> {item.specialControlReason}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Cách dùng',
      dataIndex: 'route',
      key: 'route',
      width: 110,
      render: (route) => (
        <Tag color="cyan">{ROUTE_LABELS[route] || route || 'Mặc định'}</Tag>
      ),
    },
    {
      title: 'Liều & Tần suất',
      key: 'dosageFreq',
      render: (_, item) => (
        <div>
          <div><Text strong>{item.dosage || '—'}</Text></div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>
            {item.frequency != null && item.frequency !== ''
              ? typeof item.frequency === 'number' || !isNaN(Number(item.frequency))
                ? `${item.frequency} lần/ngày`
                : item.frequency
              : '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Số ngày',
      dataIndex: 'durationDays',
      key: 'durationDays',
      width: 80,
      align: 'center',
      render: (days) => (days ? `${days} ngày` : '—'),
    },
    {
      title: 'SL kê',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center',
      render: (qty, item) => (
        <Text strong style={{ fontSize: 14 }}>
          {qty} {item.unit || ''}
        </Text>
      ),
    },
    ...(items.some((it) => (it.dispensedQuantity != null && it.dispensedQuantity > 0) || it.remainingQuantity != null) || prescription.status === 'PARTIALLY_DISPENSED'
      ? [
          {
            title: 'Đã cấp',
            key: 'dispensedQuantity',
            width: 80,
            align: 'center',
            render: (_, item) => (
              <Tag color={Number(item.dispensedQuantity) > 0 ? 'blue' : 'default'}>
                {item.dispensedQuantity || 0} {item.unit || ''}
              </Tag>
            ),
          },
          {
            title: 'Còn lại',
            key: 'remainingQuantity',
            width: 80,
            align: 'center',
            render: (_, item) => {
              const remaining = item.remainingQuantity != null ? item.remainingQuantity : Math.max(0, Number(item.quantity || 0) - Number(item.dispensedQuantity || 0))
              return (
                <Tag color={remaining > 0 ? 'orange' : 'green'} style={{ fontWeight: 600 }}>
                  {remaining} {item.unit || ''}
                </Tag>
              )
            },
          },
        ]
      : []),
    {
      title: 'Hướng dẫn sử dụng',
      dataIndex: 'instructions',
      key: 'instructions',
      render: (text) => text ? <Text type="secondary">{text}</Text> : '—',
    },
  ]

  const statusTag = (
    <Tag
      color={
        prescription.status === 'DISPENSED'
          ? 'green'
          : prescription.status === 'PARTIALLY_DISPENSED'
            ? 'gold'
            : prescription.status === 'CANCELLED'
              ? 'default'
              : 'orange'
      }
      style={{ fontSize: 13, padding: '2px 8px', fontWeight: prescription.status === 'PARTIALLY_DISPENSED' ? 600 : undefined }}
    >
      {prescription.status === 'PENDING_DISPENSE'
        ? 'Chờ cấp phát (PENDING_DISPENSE)'
        : prescription.status === 'PARTIALLY_DISPENSED'
          ? 'Cấp phát một phần (PARTIALLY_DISPENSED)'
          : prescription.status === 'DISPENSED'
            ? 'Đã cấp phát (DISPENSED)'
            : prescription.status === 'CANCELLED'
              ? 'Đã hủy (CANCELLED)'
              : prescription.status}
    </Tag>
  )

  const isPending = prescription.status === 'PENDING_DISPENSE'
  const isCancelled = prescription.status === 'CANCELLED'
  const isPrintable = Boolean(
    prescription?.id &&
    prescription?.prescriptionCode &&
    (prescription?.status === 'PENDING_DISPENSE' || prescription?.status === 'DISPENSED')
  )

  const canSendNow = Boolean(
    canSendInterconnection &&
    !isCancelled &&
    prescription.id &&
    prescription.prescriptionCode &&
    !interInfo.isSuccess
  )

  const handlePrintPrescription = async () => {
    if (!isPrintable || printing) return
    setPrinting(true)
    try {
      const response = await pharmacyApi.printPrescription(prescription.id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)

      const disposition = response.headers?.['content-disposition']
      let filename = `prescription-${prescription.prescriptionCode || prescription.id}.pdf`
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) filename = match[1]
      }

      const newWindow = window.open(url, '_blank')
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link)
        }, 1000)
        message.info('Trình duyệt đang chặn cửa sổ xem bản in. Bản in đơn thuốc đã được tải về máy của bạn.')
      } else {
        message.success('Đã mở bản in đơn thuốc thành công.')
      }

      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 30000)
    } catch (error) {
      let backendMessage = ''
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text()
          const json = JSON.parse(text)
          backendMessage = json.message || json.error
        } catch {
          // ignore
        }
      } else if (error.response?.data?.message) {
        backendMessage = error.response.data.message
      }

      const status = error.response?.status
      if (status === 403) {
        message.error(backendMessage || 'Bạn không có quyền in đơn thuốc.')
      } else if (status === 404) {
        message.error(backendMessage || 'Không tìm thấy đơn thuốc cần in.')
      } else if (status === 400 || status === 409) {
        message.error(backendMessage || 'Đơn thuốc chưa đủ điều kiện để in.')
      } else if (status === 500) {
        message.error(backendMessage || 'Không thể tạo bản in đơn thuốc từ hệ thống. Vui lòng thử lại.')
      } else {
        message.error(backendMessage || error.message || 'Lỗi khi tạo bản in đơn thuốc.')
      }
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingRight: 24, flexWrap: 'wrap' }}>
          <Space>
            <MedicineBoxOutlined style={{ color: '#2563eb', fontSize: 20 }} />
            <span style={{ fontSize: 17, fontWeight: 600 }}>
              Đơn thuốc Điện tử: {formatPrescriptionCode(prescription.prescriptionCode || prescription.id)}
            </span>
          </Space>
          <Space>
            {interInfo.isSuccess && (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                Đã liên thông ({interInfo.receiptCode})
              </Tag>
            )}
            {interInfo.isFailed && (
              <Tag color="error" icon={<CloseCircleOutlined />}>
                Liên thông lỗi
              </Tag>
            )}
            {statusTag}
          </Space>
        </div>
      }
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            {canSendNow && (
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                loading={sendingInterconnection}
                onClick={handleSendInterconnection}
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
              >
                {interInfo.isFailed ? 'Gửi lại lên Cổng liên thông' : 'Gửi lên Cổng liên thông'}
              </Button>
            )}
            {interInfo.isSuccess && (
              <Tag color="success" icon={<CheckOutlined />} style={{ padding: '4px 10px', fontSize: 12 }}>
                Đã liên thông Quốc gia: <strong>{interInfo.receiptCode}</strong>
              </Tag>
            )}
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              loading={printing}
              disabled={!isPrintable || printing}
              onClick={() => {
                if (onPrintClick) {
                  onPrintClick(prescription)
                } else {
                  handlePrintPrescription()
                }
              }}
            >
              In đơn thuốc
            </Button>
            {canSaveTemplate && (
              <Button
                type="default"
                icon={<BookOutlined />}
                onClick={() => setSaveTemplateModalOpen(true)}
                id="btn-save-as-template"
                style={{ borderColor: '#2563eb', color: '#2563eb' }}
              >
                Lưu thành mẫu
              </Button>
            )}
            {canEdit && isPending && (
              <Button
                type="default"
                icon={<EditOutlined />}
                onClick={() => {
                  onClose()
                  if (onEditClick) onEditClick(prescription)
                }}
              >
                Điều chỉnh đơn này
              </Button>
            )}
            {canCancel && isPending && (
              <Button
                type="primary"
                danger
                icon={<StopOutlined />}
                onClick={() => {
                  onClose()
                  if (onCancelClick) onCancelClick(prescription)
                }}
                id="btn-detail-cancel-prescription"
              >
                Hủy đơn thuốc
              </Button>
            )}
            <Button onClick={onClose}>Đóng</Button>
          </Space>
        </div>
      }
      width={860}
      style={{ top: 20 }}
    >
      {isCancelled && (
        <Alert
          type="error"
          showIcon
          icon={<StopOutlined style={{ fontSize: 20, color: '#dc2626' }} />}
          message={
            <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b' }}>
              Đơn thuốc đã bị hủy (CANCELLED)
            </div>
          }
          description={
            <div style={{ fontSize: 13, marginTop: 4, color: '#7f1d1d' }}>
              <div>
                <strong>Lý do hủy:</strong>{' '}
                <span style={{ color: '#b91c1c' }}>{prescription.cancelReason || 'Không có lý do chi tiết ghi nhận'}</span>
              </div>
              {prescription.updatedAt && (
                <div style={{ marginTop: 2, color: '#64748b', fontSize: 12 }}>
                  Thời gian hủy: {dayjs(prescription.updatedAt).format('HH:mm DD/MM/YYYY')}
                </div>
              )}
            </div>
          }
          style={{ marginBottom: 14, backgroundColor: '#fef2f2', borderColor: '#fecaca', borderRadius: 8 }}
        />
      )}

      <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f8fafc' }}>
        {/* Banner mã định danh điện tử */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: '10px 14px', borderRadius: 8, marginBottom: 12, border: '1px solid #bfdbfe', flexWrap: 'wrap', gap: 8 }}>
          <Space size={8} align="center">
            <BarcodeOutlined style={{ fontSize: 22, color: '#1d4ed8' }} />
            <div>
              <div style={{ fontSize: 11, color: '#1e40af', textTransform: 'uppercase', fontWeight: 600 }}>
                Mã Đơn Thuốc Điện Tử (Định danh duy nhất)
              </div>
              <Space size={6} align="center">
                <Text code strong style={{ color: '#1d4ed8', fontSize: 18 }}>
                  {formatPrescriptionCode(prescription.prescriptionCode || prescription.id)}
                </Text>
                <Tooltip title="Sao chép mã đơn điện tử">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined style={{ color: '#2563eb' }} />}
                    onClick={() => {
                      const code = formatPrescriptionCode(prescription.prescriptionCode || prescription.id)
                      if (code && code !== '—') {
                        navigator.clipboard.writeText(code)
                        message.success(`Đã sao chép mã đơn điện tử: ${code}`)
                      }
                    }}
                  />
                </Tooltip>
                <Tag color="cyan" style={{ fontSize: 11 }}>
                  <SafetyCertificateOutlined /> Bất biến & Định danh
                </Tag>
              </Space>
            </div>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, maxWidth: 300, textAlign: 'right' }}>
            Mã được gắn cố định với đơn và không thay đổi trong suốt vòng đời của đơn.
          </Text>
        </div>

        {/* Banner trạng thái liên thông quốc gia */}
        <div
          style={{
            backgroundColor: interInfo.bgColor,
            borderColor: interInfo.borderColor,
            borderWidth: 1,
            borderStyle: 'solid',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Space size={10} align="center">
            <CloudServerOutlined style={{ fontSize: 20, color: interInfo.tagColor }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: interInfo.tagColor }}>
                  Cổng liên thông Quốc gia:
                </span>
                <Tag color={interInfo.color} style={{ fontWeight: 600, margin: 0 }}>
                  {interInfo.label}
                </Tag>
                {interInfo.receiptCode && (
                  <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 700, margin: 0 }}>
                    Mã biên nhận: {interInfo.receiptCode}
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                {interInfo.isSuccess ? (
                  <span>
                    ✓ Đơn thuốc đã được hệ thống liên thông mô phỏng tiếp nhận thành công lúc{' '}
                    <strong>{interInfo.completedAt ? dayjs(interInfo.completedAt).format('HH:mm DD/MM/YYYY') : 'vừa xong'}</strong>.
                  </span>
                ) : interInfo.isFailed ? (
                  <span style={{ color: '#b91c1c' }}>
                    ✕ Lý do thất bại: <strong>{interInfo.failureReason}</strong>
                  </span>
                ) : (
                  <span>
                    Đơn thuốc sẵn sàng gửi lên dịch vụ liên thông mô phỏng của phòng khám.
                  </span>
                )}
              </div>
            </div>
          </Space>

          {canSendNow && (
            <Button
              size="small"
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={sendingInterconnection}
              onClick={handleSendInterconnection}
              style={{ backgroundColor: interInfo.isFailed ? '#dc2626' : '#0284c7', borderColor: interInfo.isFailed ? '#dc2626' : '#0284c7' }}
            >
              {interInfo.isFailed ? 'Gửi lại liên thông' : 'Gửi liên thông ngay'}
            </Button>
          )}
        </div>

        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} bordered={false}>
          <Descriptions.Item label={<Text strong><UserOutlined /> Bệnh nhân</Text>}>
            {prescription.patientName ? (
              <span>
                <Text strong>{fixMojibake(prescription.patientName)}</Text> ({prescription.patientCode || '—'})
              </span>
            ) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label={<Text strong><ClockCircleOutlined /> Lượt khám</Text>}>
            <Text code>{prescription.visitCode || '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Bác sĩ kê đơn">
            <Text strong>{fixMojibake(prescription.doctorName) || '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Ngày kê">
            {prescription.prescribedAt ? dayjs(prescription.prescribedAt).format('HH:mm DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Cập nhật lần cuối">
            {prescription.updatedAt ? dayjs(prescription.updatedAt).format('HH:mm DD/MM/YYYY') : 'Chưa điều chỉnh'}
          </Descriptions.Item>
          <Descriptions.Item label="Mã biên nhận liên thông">
            {interInfo.receiptCode ? <Text code strong>{interInfo.receiptCode}</Text> : <Text type="secondary">Chưa có</Text>}
          </Descriptions.Item>
          {isCancelled && (
            <Descriptions.Item label={<Text strong style={{ color: '#dc2626' }}>Lý do hủy</Text>} span={2}>
              <Text type="danger" strong>{prescription.cancelReason || '—'}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
        {prescription.note && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0' }}>
            <Text type="secondary"><strong>Ghi chú bác sĩ:</strong> {fixMojibake(prescription.note)}</Text>
          </div>
        )}
      </Card>

      <Tabs
        defaultActiveKey="medicines"
        items={[
          {
            key: 'medicines',
            label: (
              <span>
                <MedicineBoxOutlined /> Danh sách thuốc ({items.length})
              </span>
            ),
            children: (
              <>
                <Table
                  size="small"
                  rowKey={(r, index) => r.id || r.medicineId || index}
                  dataSource={items}
                  columns={itemColumns}
                  pagination={false}
                  bordered
                />

                {warnings && warnings.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Alert
                      type="warning"
                      showIcon
                      icon={<WarningOutlined />}
                      message={<Text strong>Cảnh báo tương tác thuốc đã ghi nhận ({warnings.length})</Text>}
                      description={
                        <ul style={{ paddingLeft: 20, margin: '6px 0 0 0' }}>
                          {warnings.map((w, idx) => (
                            <li key={idx} style={{ marginBottom: 4 }}>
                              <Text strong color="warning">[{w.severity || 'CẢNH BÁO'}]</Text>{' '}
                              {w.warningMessage || w.description}
                              {w.overrideReason && (
                                <div style={{ fontSize: 12, color: '#2563eb' }}>
                                  Lý do bác sĩ chấp thuận: <em>{w.overrideReason}</em>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      }
                    />
                  </div>
                )}

                {allergyLogs && allergyLogs.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Alert
                      type="error"
                      showIcon
                      icon={<FireOutlined style={{ color: '#dc2626' }} />}
                      message={<Text strong style={{ color: '#991b1b' }}>Lưu vết vượt qua cảnh báo dị ứng thuốc ({allergyLogs.length})</Text>}
                      description={
                        <ul style={{ paddingLeft: 20, margin: '6px 0 0 0' }}>
                          {allergyLogs.map((log, idx) => (
                            <li key={idx} style={{ marginBottom: 6 }}>
                              <Text strong style={{ color: '#b91c1c' }}>[{log.severity || 'DỊ ỨNG'}]</Text>{' '}
                              Thuốc: <strong>{log.medicineName}</strong> (Hoạt chất: {log.activeIngredient}) trùng dị ứng với <strong>{log.allergenName}</strong>
                              {log.reaction ? ` — Phản ứng: ${log.reaction}` : ''}
                              {log.overrideReason && (
                                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>
                                  Lý do bác sĩ ghi nhận: <em>"{log.overrideReason}"</em> {log.doctorName ? `(Bác sĩ: ${log.doctorName})` : ''}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      }
                      style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}
                    />
                  </div>
                )}
              </>
            ),
          },
          {
            key: 'interconnection',
            label: (
              <span>
                <CloudUploadOutlined /> Cổng liên thông Quốc gia
                {interInfo.isSuccess && <Tag color="success" style={{ marginLeft: 6, fontSize: 11 }}>Đã gửi</Tag>}
                {interInfo.isFailed && <Tag color="error" style={{ marginLeft: 6, fontSize: 11 }}>Lỗi</Tag>}
                {interInfo.isNotSent && <Tag color="default" style={{ marginLeft: 6, fontSize: 11 }}>Chưa gửi</Tag>}
              </span>
            ),
            children: (
              <div style={{ padding: '8px 4px' }}>
                <Card
                  style={{
                    backgroundColor: interInfo.bgColor,
                    borderColor: interInfo.borderColor,
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <CloudServerOutlined style={{ fontSize: 24, color: interInfo.tagColor }} />
                        <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
                          Kết quả tiếp nhận tại Cổng liên thông mô phỏng
                        </Title>
                        <Tag color={interInfo.color} style={{ fontSize: 12, padding: '2px 8px' }}>
                          {interInfo.label}
                        </Tag>
                      </div>
                      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                        {interInfo.description}
                      </Paragraph>
                    </div>

                    {canSendNow && (
                      <Button
                        type="primary"
                        icon={<CloudUploadOutlined />}
                        loading={sendingInterconnection}
                        onClick={handleSendInterconnection}
                        style={{ backgroundColor: interInfo.isFailed ? '#dc2626' : '#0284c7', borderColor: interInfo.isFailed ? '#dc2626' : '#0284c7' }}
                      >
                        {interInfo.isFailed ? 'Gửi lại liên thông' : 'Gửi đơn lên Cổng liên thông'}
                      </Button>
                    )}
                  </div>

                  <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered style={{ backgroundColor: '#ffffff', borderRadius: 6 }}>
                    <Descriptions.Item label="Mã đơn thuốc điện tử">
                      <Text code strong style={{ color: '#1d4ed8', whiteSpace: 'nowrap', fontSize: 13.5 }}>
                        {formatPrescriptionCode(prescription.prescriptionCode || prescription.id)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Trạng thái tiếp nhận">
                      <Tag color={interInfo.color}>{interInfo.label}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Mã biên nhận (Receipt Code)">
                      {interInfo.receiptCode ? (
                        <Space>
                          <Text code strong style={{ color: '#16a34a', fontSize: 13 }}>
                            {interInfo.receiptCode}
                          </Text>
                          <Tooltip title="Sao chép mã biên nhận">
                            <Button
                              type="text"
                              size="small"
                              icon={<CopyOutlined style={{ color: '#16a34a' }} />}
                              onClick={() => {
                                navigator.clipboard.writeText(interInfo.receiptCode)
                                message.success(`Đã sao chép mã biên nhận: ${interInfo.receiptCode}`)
                              }}
                            />
                          </Tooltip>
                        </Space>
                      ) : (
                        <Text type="secondary">—</Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Thời gian gửi / phản hồi">
                      {interInfo.completedAt ? dayjs(interInfo.completedAt).format('HH:mm:ss DD/MM/YYYY') : '—'}
                    </Descriptions.Item>
                  </Descriptions>

                  {interInfo.isFailed && interInfo.failureReason && (
                    <Alert
                      type="error"
                      showIcon
                      icon={<CloseCircleOutlined />}
                      message="Chi tiết lỗi phản hồi từ Cổng liên thông"
                      description={interInfo.failureReason}
                      style={{ marginTop: 12 }}
                    />
                  )}
                </Card>
              </div>
            ),
          },
          {
            key: 'amendments',
            label: (
              <span>
                <HistoryOutlined /> Lịch sử lưu vết thay đổi {historyLogs.length > 0 ? `(${historyLogs.length})` : ''}
              </span>
            ),
            children: (
              <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 4px' }}>
                <Alert
                  type="info"
                  showIcon
                  message={`Mã đơn thuốc điện tử: ${formatPrescriptionCode(prescription.prescriptionCode || prescription.id)}`}
                  description="Mã định danh duy nhất của đơn thuốc được duy trì cố định và bất biến qua mọi lần chỉnh sửa / điều chỉnh liều."
                  style={{ marginBottom: 12 }}
                />
                {historyLogs.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center' }}>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="Đơn thuốc này chưa có lần điều chỉnh nào (đang ở trạng thái kê đơn ban đầu)."
                    />
                    {prescription.updatedAt && prescription.updatedAt !== prescription.prescribedAt && (
                      <Alert
                        type="info"
                        showIcon
                        message={`Lần cập nhật gần nhất lúc ${dayjs(prescription.updatedAt).format('HH:mm DD/MM/YYYY')}`}
                        style={{ marginTop: 12, display: 'inline-block' }}
                      />
                    )}
                  </div>
                ) : (
                  <Timeline
                    mode="left"
                    items={historyLogs.map((log, idx) => {
                      const isCreate = log.action === 'CREATE' || idx === historyLogs.length - 1
                      return {
                        color: isCreate ? 'green' : 'blue',
                        dot: isCreate ? <PlusCircleOutlined /> : <EditOutlined />,
                        children: (
                          <Card size="small" style={{ marginBottom: 12, borderRadius: 8, borderColor: '#e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Space>
                                <Tag color={isCreate ? 'green' : 'blue'}>
                                  {log.action || (isCreate ? 'KHỞI TẠO ĐƠN' : 'ĐIỀU CHỈNH ĐƠN')}
                                </Tag>
                                <Text strong>{log.changedBy || log.amendedByName || prescription.doctorName || 'Bác sĩ'}</Text>
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {log.changedAt || log.amendedAt ? dayjs(log.changedAt || log.amendedAt).format('HH:mm:ss DD/MM/YYYY') : '—'}
                              </Text>
                            </div>

                            {(log.changeReason || log.reason) && (
                              <Paragraph style={{ margin: '6px 0', color: '#1e40af', backgroundColor: '#eff6ff', padding: '6px 10px', borderRadius: 4 }}>
                                <strong>Lý do điều chỉnh:</strong> {log.changeReason || log.reason}
                              </Paragraph>
                            )}

                            {log.before && (
                              <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fef2f2', borderRadius: 6 }}>
                                <Text danger strong style={{ fontSize: 12 }}>
                                  [TRƯỚC KHI THAY ĐỔI]
                                </Text>
                                <ul style={{ paddingLeft: 20, margin: '4px 0' }}>
                                  {(Array.isArray(log.before.items)
                                    ? log.before.items
                                    : typeof log.before.items === 'string'
                                      ? JSON.parse(log.before.items)
                                      : []
                                  ).map((item, i) => {
                                    const freqText = item.frequency != null && item.frequency !== ''
                                      ? typeof item.frequency === 'number' || !isNaN(Number(item.frequency))
                                        ? `${item.frequency} lần/ngày`
                                        : item.frequency
                                      : ''
                                    return (
                                      <li key={i}>
                                        <strong>{item.medicineName || getMedicineName(item.medicineId)}</strong> — SL: {item.quantity} | Liều: {item.dosage || 'Theo chỉ định'} {freqText ? `(${freqText})` : ''}
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            )}

                            <div style={{ marginTop: 8, padding: 8, backgroundColor: '#f0fdf4', borderRadius: 6 }}>
                              <Text type="success" strong style={{ fontSize: 12 }}>
                                {log.before ? '[SAU KHI THAY ĐỔI]' : '[DANH SÁCH THUỐC KÊ]'}
                              </Text>
                              <ul style={{ paddingLeft: 20, margin: '4px 0' }}>
                                {(Array.isArray(log.after?.items)
                                  ? log.after.items
                                  : typeof log.after?.items === 'string'
                                    ? JSON.parse(log.after.items)
                                    : items
                                ).map((item, i) => {
                                  const freqText = item.frequency != null && item.frequency !== ''
                                    ? typeof item.frequency === 'number' || !isNaN(Number(item.frequency))
                                      ? `${item.frequency} lần/ngày`
                                      : item.frequency
                                    : ''
                                  return (
                                    <li key={i}>
                                      <strong>{item.medicineName || getMedicineName(item.medicineId)}</strong> — SL: {item.quantity} | Liều: {item.dosage || 'Theo chỉ định'} {freqText ? `(${freqText})` : ''}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          </Card>
                        ),
                      }
                    })}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <SaveAsTemplateModal
        open={saveTemplateModalOpen}
        onClose={() => setSaveTemplateModalOpen(false)}
        prescription={prescription}
        diagnoses={diagnoses}
        onSuccess={(savedTpl) => {
          if (onTemplateSaved) onTemplateSaved(savedTpl)
        }}
      />
    </Modal>
  )
}

export default PrescriptionDetailModal
