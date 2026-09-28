import React from 'react'
import { Modal, Descriptions, Alert, Typography, List, Space, Button, Divider, Tag } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  WarningFilled,
  FileTextOutlined,
  DatabaseOutlined,
  FieldTimeOutlined,
  SafetyCertificateOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { formatDateTime } from '../../utils/backupScheduleHelpers'

const { Text } = Typography

/**
 * Modal hiển thị kết quả kiểm tra tính toàn vẹn của bản sao lưu
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   verificationResult: import('../../types').BackupVerificationResponse | null,
 *   loading?: boolean
 * }} props
 */
function BackupVerificationModal({ open, onClose, verificationResult, loading = false }) {
  if (!verificationResult) return null

  const isValid = Boolean(verificationResult.valid && verificationResult.readable && verificationResult.dataIntact)
  const issues = Array.isArray(verificationResult.issues) ? verificationResult.issues : []

  return (
    <Modal
      title={
        <Space align="center">
          <SafetyCertificateOutlined style={{ color: isValid ? '#52c41a' : '#f5222d', fontSize: 20 }} />
          <span>Kết quả kiểm tra tính toàn vẹn bản sao lưu</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Đóng
        </Button>,
      ]}
      width={720}
      destroyOnClose
    >
      <div style={{ marginTop: 12 }}>
        {/* Kết luận tổng quan */}
        <Alert
          type={isValid ? 'success' : 'error'}
          showIcon
          icon={isValid ? <CheckCircleFilled /> : <CloseCircleFilled />}
          message={
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {isValid
                ? 'Bản sao lưu đọc được và đầy đủ dữ liệu'
                : 'Cảnh báo: Bản sao lưu phát hiện lỗi toàn vẹn hoặc không thể đọc'}
            </span>
          }
          description={
            <div style={{ marginTop: 4 }}>
              {verificationResult.message || (isValid
                ? 'Hệ thống đã đọc và xác thực thành công toàn bộ cấu trúc các bảng và dữ liệu.'
                : 'Bản sao lưu không đáp ứng tiêu chuẩn an toàn để phục hồi dữ liệu khi có sự cố.')}
            </div>
          }
          style={{ marginBottom: 16 }}
        />

        {/* Thông số kỹ thuật kiểm tra (Cố định 2 cột bằng column={2}, không dùng responsive object tránh tràn Modal) */}
        <Descriptions
          className="backup-verification-descriptions"
          bordered
          size="middle"
          column={2}
          labelStyle={{
            fontWeight: 600,
            width: '145px',
            whiteSpace: 'nowrap',
            backgroundColor: '#fafafa',
          }}
          contentStyle={{
            wordBreak: 'break-word',
          }}
        >
          <Descriptions.Item label="Mã bản sao lưu">
            <Text strong style={{ color: '#1890ff', whiteSpace: 'nowrap' }}>
              {verificationResult.backupCode || '—'}
            </Text>
          </Descriptions.Item>

          <Descriptions.Item label="Tên tệp lưu trữ">
            <Space align="center" style={{ maxWidth: '100%' }}>
              <FileTextOutlined style={{ flexShrink: 0 }} />
              <Text
                copyable
                ellipsis={{ tooltip: verificationResult.fileName }}
                style={{ maxWidth: 160, display: 'inline-block' }}
              >
                {verificationResult.fileName || '—'}
              </Text>
            </Space>
          </Descriptions.Item>

          <Descriptions.Item label="Thời điểm kiểm tra">
            <Space style={{ whiteSpace: 'nowrap' }}>
              <FieldTimeOutlined style={{ flexShrink: 0 }} />
              <span>{formatDateTime(verificationResult.verifiedAt)}</span>
            </Space>
          </Descriptions.Item>

          <Descriptions.Item label="Phiên bản cấu trúc">
            <Tag color="blue" style={{ whiteSpace: 'nowrap' }}>
              Phiên bản {verificationResult.schemaVersion || 'N/A'}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Khả năng đọc tệp">
            {verificationResult.readable ? (
              <Tag color="success" icon={<CheckOutlined />} style={{ whiteSpace: 'nowrap' }}>
                Đọc thành công
              </Tag>
            ) : (
              <Tag color="error" icon={<CloseCircleFilled />} style={{ whiteSpace: 'nowrap' }}>
                Không đọc được
              </Tag>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Tính toàn vẹn dữ liệu">
            {verificationResult.dataIntact ? (
              <Tag color="success" icon={<CheckOutlined />} style={{ whiteSpace: 'nowrap' }}>
                Đầy đủ dữ liệu
              </Tag>
            ) : (
              <Tag color="error" icon={<CloseCircleFilled />} style={{ whiteSpace: 'nowrap' }}>
                Thiếu hụt dữ liệu
              </Tag>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Số bảng kiểm tra">
            <Space style={{ whiteSpace: 'nowrap' }}>
              <DatabaseOutlined style={{ flexShrink: 0 }} />
              <span>
                <strong>{verificationResult.tableCount ?? '—'}</strong> / 28 bảng cốt lõi
              </span>
            </Space>
          </Descriptions.Item>

          <Descriptions.Item label="Tổng số bản ghi">
            <span style={{ whiteSpace: 'nowrap' }}>
              <strong>{Number(verificationResult.rowCount || 0).toLocaleString('vi-VN')}</strong> dòng dữ liệu
            </span>
          </Descriptions.Item>
        </Descriptions>

        {/* Danh sách lỗi phát hiện nếu có */}
        {issues.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong style={{ color: '#f5222d', display: 'block', marginBottom: 8 }}>
              Chi tiết các vấn đề phát hiện ({issues.length}):
            </Text>
            <List
              size="small"
              bordered
              dataSource={issues}
              renderItem={(issue) => (
                <List.Item>
                  <Space align="start">
                    <WarningFilled style={{ color: '#faad14', marginTop: 4, flexShrink: 0 }} />
                    <Text type="danger">{issue}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        )}

        <Divider style={{ margin: '16px 0 12px' }} />

        {/* Ghi chú môi trường thử nghiệm */}
        <Alert
          type="info"
          showIcon
          message="Lưu ý môi trường thử nghiệm"
          description="Hệ thống đang hoạt động với dữ liệu mô phỏng của phòng khám. Tiến trình kiểm tra toàn vẹn chỉ đọc và kiểm tra cấu trúc tệp tin, không làm thay đổi hay can thiệp vào cơ sở dữ liệu đang vận hành."
        />
      </div>
    </Modal>
  )
}

export default BackupVerificationModal
