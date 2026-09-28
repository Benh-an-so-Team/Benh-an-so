import React from 'react'
import { Modal, Alert, Collapse, Tag, Button, Typography, Space, List } from 'antd'
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
  FireOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

const { Text, Paragraph } = Typography

function renderAllergySeverityTag(severity) {
  if (!severity) return null
  const sev = String(severity).toUpperCase()
  switch (sev) {
    case 'ANAPHYLAXIS':
      return (
        <Tag color="#b91c1c" style={{ fontWeight: 700 }}>
          SỐC PHẢN VỆ (NGUY HIỂM TÍNH MẠNG)
        </Tag>
      )
    case 'SEVERE':
      return (
        <Tag color="red" style={{ fontWeight: 700 }}>
          Nghiêm trọng
        </Tag>
      )
    case 'MODERATE':
      return (
        <Tag color="orange" style={{ fontWeight: 600 }}>
          Trung bình
        </Tag>
      )
    case 'MILD':
      return (
        <Tag color="gold" style={{ fontWeight: 600 }}>
          Nhẹ
        </Tag>
      )
    default:
      return <Tag color="volcano">{severity}</Tag>
  }
}

function renderInteractionSeverityTag(severity) {
  if (!severity) return null
  const sev = String(severity).toUpperCase()
  switch (sev) {
    case 'CONTRAINDICATED':
      return (
        <Tag color="magenta" style={{ fontWeight: 700 }}>
          Chống chỉ định phối hợp
        </Tag>
      )
    case 'SEVERE':
      return (
        <Tag color="red" style={{ fontWeight: 700 }}>
          Nghiêm trọng
        </Tag>
      )
    case 'MODERATE':
      return (
        <Tag color="orange" style={{ fontWeight: 600 }}>
          Trung bình
        </Tag>
      )
    case 'MILD':
      return <Tag color="blue">Nhẹ</Tag>
    default:
      return <Tag color="orange">{severity}</Tag>
  }
}

function renderContraindicationSeverityTag(severity) {
  if (!severity) return null
  const sev = String(severity).toUpperCase()
  switch (sev) {
    case 'ABSOLUTE':
      return (
        <Tag color="#991b1b" style={{ fontWeight: 700 }}>
          CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI
        </Tag>
      )
    case 'RELATIVE':
      return (
        <Tag color="#c2410c" style={{ fontWeight: 600 }}>
          Chống chỉ định tương đối
        </Tag>
      )
    default:
      return <Tag color="error">{severity}</Tag>
  }
}

/**
 * NCL-05-CN-008: Modal cảnh báo an toàn y tế khi áp dụng bộ đơn thuốc mẫu.
 * Hiển thị đầy đủ 3 tầng cảnh báo (tương tác thuốc, dị ứng, chống chỉ định) từ Backend.
 */
function PrescriptionTemplateWarningsModal({
  open,
  templateTitle = '',
  interactionWarnings = [],
  allergyWarnings = [],
  contraindicationWarnings = [],
  contraindicationMissingData = [],
  onCancel,
  onProceed,
}) {
  const totalWarnings =
    (interactionWarnings?.length || 0) +
    (allergyWarnings?.length || 0) +
    (contraindicationWarnings?.length || 0)

  const items = []

  // 1. Cảnh báo Dị ứng thuốc
  if (allergyWarnings?.length > 0) {
    items.push({
      key: 'allergy',
      label: (
        <Space>
          <FireOutlined style={{ color: '#dc2626' }} />
          <Text strong style={{ color: '#b91c1c' }}>
            Cảnh báo Dị ứng thuốc ({allergyWarnings.length})
          </Text>
        </Space>
      ),
      children: (
        <List
          size="small"
          dataSource={allergyWarnings}
          renderItem={(item, idx) => (
            <List.Item
              key={idx}
              style={{
                backgroundColor: '#fef2f2',
                borderRadius: 6,
                marginBottom: 8,
                border: '1px solid #fecaca',
                padding: '10px 14px',
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 14, color: '#991b1b' }}>
                    {item.medicineName || 'Thuốc trong đơn'}
                  </Text>
                  {renderAllergySeverityTag(item.severity)}
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  Trùng dị ứng với: <Tag color="red">{item.allergenName}</Tag>
                  {item.reaction ? ` — Biểu hiện: ${item.reaction}` : ''}
                </div>
                {item.clinicalAdvice && (
                  <div style={{ fontSize: 12, color: '#7f1d1d', fontStyle: 'italic' }}>
                    Khuyến cáo: {item.clinicalAdvice}
                  </div>
                )}
              </div>
            </List.Item>
          )}
        />
      ),
    })
  }

  // 2. Cảnh báo Tương tác thuốc
  if (interactionWarnings?.length > 0) {
    items.push({
      key: 'interaction',
      label: (
        <Space>
          <ThunderboltOutlined style={{ color: '#d97706' }} />
          <Text strong style={{ color: '#b45309' }}>
            Cảnh báo Tương tác thuốc ({interactionWarnings.length})
          </Text>
        </Space>
      ),
      children: (
        <List
          size="small"
          dataSource={interactionWarnings}
          renderItem={(item, idx) => (
            <List.Item
              key={idx}
              style={{
                backgroundColor: '#fffbeb',
                borderRadius: 6,
                marginBottom: 8,
                border: '1px solid #fde68a',
                padding: '10px 14px',
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Space>
                    <Text strong style={{ color: '#b45309' }}>{item.medicineAName}</Text>
                    <Text type="secondary">✕</Text>
                    <Text strong style={{ color: '#b45309' }}>{item.medicineBName}</Text>
                  </Space>
                  {renderInteractionSeverityTag(item.severity)}
                </div>
                {item.description && (
                  <Paragraph style={{ margin: '4px 0', fontSize: 13 }}>
                    {item.description}
                  </Paragraph>
                )}
                {item.clinicalManagement && (
                  <div style={{ fontSize: 12, color: '#92400e', fontStyle: 'italic' }}>
                    Xử trí: {item.clinicalManagement}
                  </div>
                )}
              </div>
            </List.Item>
          )}
        />
      ),
    })
  }

  // 3. Cảnh báo Chống chỉ định
  if (contraindicationWarnings?.length > 0) {
    items.push({
      key: 'contraindication',
      label: (
        <Space>
          <StopOutlined style={{ color: '#dc2626' }} />
          <Text strong style={{ color: '#991b1b' }}>
            Cảnh báo Chống chỉ định ({contraindicationWarnings.length})
          </Text>
        </Space>
      ),
      children: (
        <List
          size="small"
          dataSource={contraindicationWarnings}
          renderItem={(item, idx) => (
            <List.Item
              key={idx}
              style={{
                backgroundColor: '#fef2f2',
                borderRadius: 6,
                marginBottom: 8,
                border: '1px solid #fecaca',
                padding: '10px 14px',
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 14, color: '#991b1b' }}>
                    {item.medicineName} ({item.activeIngredient || 'Hoạt chất'})
                  </Text>
                  {renderContraindicationSeverityTag(item.severity)}
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Lý do chống chỉ định:</strong> {item.contraindicationReason || item.ruleName}
                  {item.factorDetail ? ` (${item.factorDetail})` : ''}
                </div>
                {item.clinicalManagement && (
                  <div style={{ fontSize: 12, color: '#7f1d1d', fontStyle: 'italic' }}>
                    Hướng dẫn xử trí: {item.clinicalManagement}
                  </div>
                )}
              </div>
            </List.Item>
          )}
        />
      ),
    })
  }

  const defaultActiveKeys = items.map((i) => i.key)

  return (
    <Modal
      open={open}
      title={
        <Space style={{ color: '#dc2626' }}>
          <ExclamationCircleOutlined style={{ fontSize: 20 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            CẢNH BÁO AN TOÀN Y TẾ KHI ÁP DỤNG ĐƠN MẪU
          </span>
        </Space>
      }
      onCancel={onCancel}
      width={750}
      destroyOnClose
      footer={[
        <Button key="back" icon={<ArrowLeftOutlined />} onClick={onCancel}>
          Hủy áp dụng mẫu
        </Button>,
        <Button
          key="proceed"
          type="primary"
          danger
          icon={<CheckOutlined />}
          onClick={onProceed}
          id="btn-proceed-apply-template"
        >
          Tôi đã hiểu cảnh báo — Tiếp tục điền vào đơn
        </Button>,
      ]}
    >
      <div style={{ marginTop: 12 }}>
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined style={{ fontSize: 20, color: '#ea580c' }} />}
          message={
            <span>
              Phát hiện <strong>{totalWarnings} cảnh báo an toàn y tế</strong> đối với người bệnh khi đối chiếu đơn mẫu {templateTitle ? `"${templateTitle}"` : ''}
            </span>
          }
          description="Backend đã thực hiện kiểm tra 3 tầng an toàn: Tương tác thuốc, Tiền sử dị ứng người bệnh và Chống chỉ định lâm sàng. Vui lòng xem xét chi tiết bên dưới trước khi quyết định đưa vào đơn thuốc."
          style={{ marginBottom: 16 }}
        />

        <Collapse
          defaultActiveKey={defaultActiveKeys}
          items={items}
          style={{ backgroundColor: '#ffffff' }}
        />

        {contraindicationMissingData?.length > 0 && (
          <Alert
            type="info"
            showIcon
            message="Lưu ý về dữ liệu bệnh nhân"
            description={`Hồ sơ bệnh nhân còn thiếu ${contraindicationMissingData.length} yếu tố lâm sàng để kiểm tra chống chỉ định toàn diện.`}
            style={{ marginTop: 12 }}
          />
        )}

        <div style={{ marginTop: 14, fontSize: 13, color: '#475569', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
          💡 <em>Sau khi điền vào đơn, bạn vẫn có thể chỉnh sửa liều lượng, cách dùng hoặc xóa bỏ các thuốc có nguy cơ trước khi bấm "Tạo đơn thuốc".</em>
        </div>
      </div>
    </Modal>
  )
}

export default PrescriptionTemplateWarningsModal
