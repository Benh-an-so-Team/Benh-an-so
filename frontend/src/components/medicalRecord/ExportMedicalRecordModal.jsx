import React, { useState, useMemo } from 'react'
import { Modal, Table, Button, Tag, Space, Alert, Typography, Tooltip, message } from 'antd'
import {
  DownloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  LockOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import medicalRecordExportApi from '../../api/medicalRecordExportApi.js'
import {
  canExportRecord,
  downloadBlobFile,
  extractBlobErrorMessage,
  mapExportErrorMessage,
  MAX_EXPORT_BATCH_SIZE,
} from '../../utils/medicalRecordExportHelpers.js'
import { formatRecordStatus } from '../../utils/helpers.js'

const { Title, Text, Paragraph } = Typography

/**
 * Modal to preview and confirm batch/single export of medical records according to data exchange structure (NCL-11-CN-007).
 * Strictly enforces:
 * - QTN-41: Only signed records (SIGNED, LOCKED, ARCHIVED)
 * - All-or-Nothing rule: If any record fails or violates conditions, no records are exported
 * - Max batch size 100 limit
 * - Double-click protection via loading & maskClosable=false
 * - Minimal PII on UI (only patientCode, patientName, visitCode, recordCode)
 */
export default function ExportMedicalRecordModal({
  open,
  onClose,
  records = [],
  onSuccess,
}) {
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const normalizedRecords = useMemo(() => {
    return (Array.isArray(records) ? records : []).map((r, idx) => {
      const id = r.id || r.medicalRecordId || `rec-${idx}`
      const recordCode = r.recordCode || (id ? `BA-${String(id).substring(0, 8).toUpperCase()}` : '---')
      const patientCode = r.patientCode || r.patient?.patientCode || '---'
      const patientName = r.patientName || r.patient?.fullName || '---'
      const visitCode = r.visitCode || r.encounter?.visitCode || (r.visitId ? `VS-${String(r.visitId).substring(0, 8).toUpperCase()}` : '---')
      const doctorName = r.doctorName || r.doctorFullName || '---'
      const status = r.status || 'DRAFT'
      const isSigned = canExportRecord(r)

      return {
        key: id,
        id,
        medicalRecordId: id,
        recordCode,
        patientCode,
        patientName,
        visitCode,
        doctorName,
        status,
        isSigned,
        rawRecord: r,
      }
    })
  }, [records])

  const totalCount = normalizedRecords.length
  const isOverLimit = totalCount > MAX_EXPORT_BATCH_SIZE
  const unexportableRecords = useMemo(
    () => normalizedRecords.filter((r) => !r.isSigned),
    [normalizedRecords]
  )
  const hasUnexportable = unexportableRecords.length > 0

  const handleExport = async () => {
    if (totalCount === 0) {
      message.warning('Chưa có hồ sơ nào được chọn để xuất.')
      return
    }

    if (isOverLimit) {
      message.error(`Chỉ được chọn tối đa ${MAX_EXPORT_BATCH_SIZE} hồ sơ mỗi lần xuất. Vui lòng giảm số lượng.`)
      return
    }

    // Modal.confirm final step
    Modal.confirm({
      title: `Xác nhận xuất ${totalCount} hồ sơ bệnh án chuẩn trao đổi dữ liệu?`,
      icon: <ExclamationCircleOutlined style={{ color: '#4f46e5' }} />,
      content: (
        <div>
          <Paragraph>
            Tệp xuất ra tuân thủ cấu trúc chuẩn trao đổi dữ liệu y tế gồm 5 khối thông tin (Hành chính, Chẩn đoán gắn mã ICD-10, Chỉ định CLS, Kết quả CLS, Đơn thuốc).
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 13 }}>
            Lưu ý: Hệ thống áp dụng quy tắc <strong>All-or-Nothing</strong> và tự động ghi nhận nhật ký kiểm toán (QTN-19).
          </Paragraph>
        </div>
      ),
      okText: 'Xác nhận xuất',
      cancelText: 'Hủy',
      okButtonProps: {
        style: { background: '#4f46e5', borderColor: '#4f46e5' },
      },
      onOk: async () => {
        setExporting(true)
        setErrorMessage(null)

        try {
          const recordIds = normalizedRecords.map((r) => r.id)
          let response

          if (recordIds.length === 1) {
            // Can use exportSingle or exportBatch
            response = await medicalRecordExportApi.exportSingle(recordIds[0])
          } else {
            response = await medicalRecordExportApi.exportBatch(recordIds)
          }

          const fallbackName = recordIds.length === 1
            ? `emr-exchange-${normalizedRecords[0].patientCode}-${normalizedRecords[0].visitCode}.json`
            : `emr-exchange-bundle-${Date.now()}.json`

          const finalFilename = downloadBlobFile(
            response.data,
            fallbackName,
            response.headers
          )

          message.success(`Đã xuất thành công ${totalCount} hồ sơ bệnh án thành tệp [${finalFilename}].`)
          onSuccess?.()
          onClose?.()
        } catch (err) {
          const parsedError = await extractBlobErrorMessage(err)
          const friendlyMsg = mapExportErrorMessage(parsedError || err)

          setErrorMessage(
            `${friendlyMsg} (Quy tắc All-or-Nothing: Toàn bộ yêu cầu xuất bị từ chối, không có hồ sơ nào được xuất).`
          )
          message.error(friendlyMsg)
        } finally {
          setExporting(false)
        }
      },
    })
  }

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'recordCode',
      key: 'recordCode',
      width: 140,
      render: (text) => (
        <Tag color="cyan" style={{ fontWeight: 600, fontFamily: 'monospace' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Mã bệnh nhân',
      dataIndex: 'patientCode',
      key: 'patientCode',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Tên bệnh nhân',
      dataIndex: 'patientName',
      key: 'patientName',
      ellipsis: true,
    },
    {
      title: 'Mã lượt khám',
      dataIndex: 'visitCode',
      key: 'visitCode',
      width: 130,
      render: (text) => text || '---',
    },
    {
      title: 'Bác sĩ',
      dataIndex: 'doctorName',
      key: 'doctorName',
      width: 140,
      ellipsis: true,
      render: (text) => text || '---',
    },
    {
      title: 'Trạng thái ký',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (status) => {
        if (status === 'ARCHIVED') {
          return (
            <Tag color="purple" icon={<LockOutlined />} style={{ fontWeight: 600 }}>
              Đã lưu trữ
            </Tag>
          )
        }
        const formatted = formatRecordStatus(status)
        return <Tag color={formatted.color}>{formatted.label}</Tag>
      },
    },
    {
      title: 'Điều kiện xuất',
      key: 'eligibility',
      width: 130,
      align: 'center',
      render: (_, record) => {
        if (record.isSigned) {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Đủ điều kiện
            </Tag>
          )
        }
        return (
          <Tooltip title="Bệnh án chưa ký hoặc chưa khóa nội dung theo QTN-41">
            <Tag color="error" icon={<CloseCircleOutlined />}>
              Chưa ký
            </Tag>
          </Tooltip>
        )
      },
    },
  ]

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!exporting) {
          setErrorMessage(null)
          onClose?.()
        }
      }}
      title={
        <Space>
          <FileTextOutlined style={{ color: '#4f46e5', fontSize: 18 }} />
          <span>Xuất hồ sơ bệnh án theo cấu trúc trao đổi dữ liệu</span>
        </Space>
      }
      width={850}
      destroyOnClose
      maskClosable={!exporting}
      closable={!exporting}
      footer={[
        <Button key="cancel" disabled={exporting} onClick={onClose}>
          Hủy
        </Button>,
        <Tooltip
          key="exportTooltip"
          title={
            isOverLimit
              ? `Chỉ được chọn tối đa ${MAX_EXPORT_BATCH_SIZE} hồ sơ`
              : hasUnexportable
                ? 'Có hồ sơ chưa ký, theo quy tắc All-or-Nothing sẽ bị từ chối'
                : ''
          }
        >
          <Button
            key="submit"
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            disabled={exporting || totalCount === 0 || isOverLimit}
            onClick={handleExport}
            style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
          >
            {exporting ? 'Đang xuất tệp JSON...' : `Xuất ${totalCount} hồ sơ`}
          </Button>
        </Tooltip>,
      ]}
    >
      <div style={{ marginTop: 8 }}>
        <Alert
          type="info"
          showIcon
          message="Xuất dữ liệu chuẩn trao đổi điện tử"
          description="Hồ sơ được đóng gói ra tệp JSON chuẩn trao đổi dữ liệu y tế gồm 5 khối: Thông tin hành chính & lượt khám, Chẩn đoán gắn mã ICD-10, Chỉ định cận lâm sàng, Kết quả cận lâm sàng và Đơn thuốc."
          style={{ marginBottom: 16 }}
        />

        {isOverLimit && (
          <Alert
            type="error"
            showIcon
            message={`Vượt quá số lượng cho phép (${totalCount} / ${MAX_EXPORT_BATCH_SIZE} hồ sơ)`}
            description={`Hệ thống chỉ hỗ trợ xuất tối đa ${MAX_EXPORT_BATCH_SIZE} hồ sơ trong một lần yêu cầu để bảo đảm an toàn hiệu năng. Vui lòng bỏ bớt hồ sơ.`}
            style={{ marginBottom: 16 }}
          />
        )}

        {hasUnexportable && !isOverLimit && (
          <Alert
            type="warning"
            showIcon
            message={`Cảnh báo tiền điều kiện (${unexportableRecords.length} hồ sơ chưa ký)`}
            description="Có hồ sơ trong danh sách chưa ở trạng thái ĐÃ KÝ (SIGNED, LOCKED, ARCHIVED). Theo nguyên tắc toàn vẹn (All-or-Nothing), yêu cầu xuất sẽ bị từ chối hoàn toàn nếu chứa bất kỳ hồ sơ nào chưa ký."
            style={{ marginBottom: 16 }}
          />
        )}

        {errorMessage && (
          <Alert
            type="error"
            showIcon
            closable
            onClose={() => setErrorMessage(null)}
            message="Thao tác xuất không thành công"
            description={errorMessage}
            style={{ marginBottom: 16 }}
          />
        )}

        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Danh sách hồ sơ bệnh án được chọn ({totalCount})</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Nguyên tắc toàn vẹn (All-or-Nothing) & Ghi nhật ký kiểm toán
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={normalizedRecords}
          pagination={totalCount > 5 ? { pageSize: 5, size: 'small', showTotal: (t) => `Tổng: ${t} hồ sơ` } : false}
          size="small"
          bordered
        />
      </div>
    </Modal>
  )
}
