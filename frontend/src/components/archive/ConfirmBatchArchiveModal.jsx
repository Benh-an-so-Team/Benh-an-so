import React, { useState } from 'react'
import { Modal, Alert, Button, Table, Typography, Space, Checkbox, Tag } from 'antd'
import { InboxOutlined, ExclamationCircleOutlined, LockOutlined } from '@ant-design/icons'
import { formatDateTime } from '../../utils/helpers'

const { Text, Paragraph } = Typography

/**
 * Modal xác nhận chuyển hồ sơ vào kho lưu trữ
 * Thao tác một chiều: Khóa chỉnh sửa, xóa và đưa vào kho lưu trữ an toàn.
 */
function ConfirmBatchArchiveModal({
  open,
  onClose,
  onConfirm,
  selectedRecords = [],
  isArchiveAll = false,
  totalEligibleCount = 0,
  loading = false,
}) {
  const [confirmed, setConfirmed] = useState(false)

  const handleClose = () => {
    if (loading) return
    setConfirmed(false)
    onClose()
  }

  const handleConfirm = () => {
    if (!confirmed) return
    onConfirm()
  }

  const recordCount = isArchiveAll ? totalEligibleCount : selectedRecords.length

  const columns = [
    {
      title: 'Mã hồ sơ / Lượt khám',
      key: 'code',
      width: 170,
      render: (_, r) => (
        <Space orientation="vertical" size={2}>
          <Tag color="cyan" style={{ fontFamily: 'monospace' }}>
            {r.visitCode || `BA-${String(r.medicalRecordId || r.id).slice(0, 8).toUpperCase()}`}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      render: (_, r) => (
        <div>
          <Text strong>{r.patientFullName || 'Bệnh nhân'}</Text>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Mã: {r.patientCode || '---'}</div>
        </div>
      ),
    },
    {
      title: 'Bác sĩ phụ trách',
      dataIndex: 'doctorFullName',
      key: 'doctorFullName',
      render: (text) => text || '---',
    },
    {
      title: 'Ngày kết thúc khám',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 170,
      render: (val) => formatDateTime(val),
    },
    {
      title: 'Trạng thái hiện tại',
      key: 'status',
      width: 120,
      align: 'center',
      render: () => <Tag color="green">Đã ký</Tag>,
    },
  ]

  return (
    <Modal
      open={open}
      title={
        <Space align="center" style={{ fontSize: 16 }}>
          <InboxOutlined style={{ color: '#7c3aed', fontSize: 20 }} />
          <span>Xác nhận chuyển hồ sơ vào kho lưu trữ</span>
        </Space>
      }
      onCancel={handleClose}
      width={760}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={loading}>
          Hủy bỏ
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<InboxOutlined />}
          loading={loading}
          disabled={!confirmed}
          onClick={handleConfirm}
          style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
          id="btn-confirm-batch-archive"
        >
          Xác nhận chuyển ({recordCount} hồ sơ)
        </Button>,
      ]}
    >
      <Alert
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined style={{ fontSize: 18, color: '#d97706' }} />}
        message={<strong>CẢNH BÁO QUAN TRỌNG: HÀNH ĐỘNG MỘT CHIỀU</strong>}
        description={
          <div style={{ fontSize: 13, marginTop: 4 }}>
            <Paragraph style={{ marginBottom: 6 }}>
              Bạn đang thực hiện chuyển <strong>{recordCount} hồ sơ bệnh án</strong> đã hết thời hạn hoạt động vào kho lưu trữ.
            </Paragraph>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li>
                Hồ sơ sau khi chuyển sẽ ở trạng thái <strong>CHỈ ĐỌC (Read-Only)</strong> vĩnh viễn.
              </li>
              <li>
                Hệ thống <strong>khóa hoàn toàn</strong> mọi quyền chỉnh sửa, sửa chẩn đoán, kê đơn bổ sung hoặc xóa hồ sơ.
              </li>
              <li>
                Hồ sơ sẽ biến mất khỏi danh sách hồ sơ hoạt động thường ngày và chuyển sang màn hình <strong>Tra cứu kho lưu trữ</strong>.
              </li>
            </ul>
          </div>
        }
        style={{ marginBottom: 16, background: '#fffbeb', borderColor: '#fde68a' }}
      />

      {!isArchiveAll && selectedRecords.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Danh sách hồ sơ được chuyển lưu trữ đợt này ({selectedRecords.length}):
          </div>
          <Table
            columns={columns}
            dataSource={selectedRecords}
            rowKey={(r) => r.medicalRecordId || r.id}
            size="small"
            pagination={selectedRecords.length > 5 ? { pageSize: 5 } : false}
            scroll={{ y: 220 }}
          />
        </div>
      )}

      {isArchiveAll && (
        <div
          style={{
            padding: '14px 16px',
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          <Space align="start">
            <LockOutlined style={{ color: '#475569', marginTop: 3 }} />
            <div>
              <Text strong>Thực hiện chuyển toàn bộ hồ sơ đủ điều kiện:</Text>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Hệ thống sẽ quét và chuyển đồng loạt tất cả <strong>{totalEligibleCount} hồ sơ</strong> đã ký và quá thời hạn hoạt động sang kho lưu trữ an toàn.
              </div>
            </div>
          </Space>
        </div>
      )}

      <div style={{ background: '#faf5ff', padding: '12px 16px', borderRadius: 6, border: '1px solid #e9d5ff' }}>
        <Checkbox
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          id="chk-confirm-archive-agreement"
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: '#581c87' }}>
            Tôi đã kiểm tra kỹ danh sách và xác nhận chuyển các hồ sơ này vào kho lưu trữ chỉ đọc.
          </span>
        </Checkbox>
      </div>
    </Modal>
  )
}

export default ConfirmBatchArchiveModal
