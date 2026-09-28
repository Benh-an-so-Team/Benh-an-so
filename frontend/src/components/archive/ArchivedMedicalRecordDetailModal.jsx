import React, { useEffect, useState } from 'react'
import {
  Modal,
  Alert,
  Descriptions,
  Tag,
  Typography,
  Space,
  Divider,
  Spin,
  Button,
  Card,
  Row,
  Col,
  Table,
} from 'antd'
import {
  LockOutlined,
  PrinterOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  SafetyCertificateFilled,
  CalendarOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import medicalRecordApi from '../../api/medicalRecordApi'
import { formatDateTime, formatDate, formatGender, formatRecordCode } from '../../utils/helpers'
import MedicalRecordSignatureStamp from '../clinical/MedicalRecordSignatureStamp'

const { Title, Text, Paragraph } = Typography

/**
 * Modal xem chi tiết hồ sơ bệnh án trong kho lưu trữ
 * Toàn bộ thông tin hiển thị nguyên vẹn như bản gốc, chế độ CHỈ ĐỌC (Read-Only).
 * Ẩn hoàn toàn mọi nút Sửa / Xóa.
 */
function ArchivedMedicalRecordDetailModal({ open, onClose, record, onPrint }) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!open || !record) {
      setDetail(null)
      return
    }

    const fetchDetail = async () => {
      setLoading(true)
      try {
        const visitId = record.visitId || record.visit?.id
        const recordId = record.medicalRecordId || record.id
        if (visitId) {
          const res = await medicalRecordApi.getByVisit(visitId)
          if (res?.data) {
            setDetail(res.data)
            return
          }
        }
        if (recordId) {
          const res = await medicalRecordApi.getById(recordId)
          if (res?.data) {
            setDetail(res.data)
            return
          }
        }
        setDetail(record)
      } catch (err) {
        // Fallback to record in props
        setDetail(record)
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [open, record])

  const handlePrint = () => {
    if (onPrint) {
      onPrint(record, detail)
    } else {
      window.print()
    }
  }

  const patient = detail?.patient || record?.patient || {}
  const visit = detail?.visit || record?.visit || {}
  const patientName = patient?.fullName || record?.patientFullName || 'Người bệnh'
  const patientCode = patient?.patientCode || record?.patientCode || '---'
  const doctorName = detail?.visit?.doctorName || record?.doctorFullName || 'Bác sĩ điều trị'

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={880}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space align="center">
            <LockOutlined style={{ color: '#7c3aed', fontSize: 20 }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>Chi tiết hồ sơ bệnh án lưu trữ</span>
            <Tag color="purple" style={{ fontWeight: 600, fontSize: 12 }}>
              Hồ sơ lưu trữ (Chỉ đọc)
            </Tag>
          </Space>
          <Tag color="cyan" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {formatRecordCode(record?.medicalRecordId || record?.id || detail?.medicalRecordId)}
          </Tag>
        </div>
      }
      footer={[
        <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint} id="btn-print-archived-record">
          In hồ sơ / Phiếu khám
        </Button>,
        <Button key="close" type="primary" onClick={onClose} id="btn-close-archived-detail">
          Đóng
        </Button>,
      ]}
      style={{ top: 20 }}
    >
      {/* Banner cảnh báo bản chỉ đọc */}
      <Alert
        type="info"
        showIcon
        icon={<LockOutlined style={{ color: '#6b21a8', fontSize: 18 }} />}
        message={<strong>HỒ SƠ BỆNH ÁN ĐÃ LƯU TRỮ — CHẾ ĐỘ CHỈ ĐỌC</strong>}
        description={
          <div style={{ fontSize: 12.5, color: '#4b5563', marginTop: 2 }}>
            Hồ sơ này đã kết thúc thời hạn hoạt động và được chuyển vào kho lưu trữ an toàn theo quy định.
            Toàn bộ diễn biến lâm sàng, chẩn đoán, đơn thuốc và cận lâm sàng được bảo lưu nguyên vẹn.
            <strong> Mọi thao tác chỉnh sửa hoặc xóa hồ sơ đều bị khóa vĩnh viễn.</strong>
          </div>
        }
        style={{ marginBottom: 16, background: '#faf5ff', borderColor: '#e9d5ff' }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="Đang tải dữ liệu hồ sơ lưu trữ..." />
        </div>
      ) : (
        <div>
          {/* 1. Thông tin lưu trữ & Hành chính */}
          <Card size="small" style={{ marginBottom: 16, background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <Text type="secondary">Thời điểm lưu trữ: </Text>
                <Text strong>{formatDateTime(record?.archivedAt || detail?.archivedAt) || 'Đã lưu trữ'}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">Thời điểm hoàn tất khám: </Text>
                <Text strong>{formatDateTime(record?.completedAt || visit?.completedAt) || '---'}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">Mã lượt khám: </Text>
                <Tag color="blue">{record?.visitCode || visit?.visitCode || '---'}</Tag>
              </Col>
              <Col span={12}>
                <Text type="secondary">Thời điểm ký duyệt: </Text>
                <Text strong>{formatDateTime(record?.signedAt || detail?.signedAt) || '---'}</Text>
              </Col>
            </Row>
          </Card>

          {/* 2. Thông tin bệnh nhân */}
          <Descriptions
            title={<span style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a' }}>Thông tin người bệnh</span>}
            bordered
            size="small"
            column={2}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Họ và tên">
              <Text strong>{patientName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Mã bệnh nhân">
              <Tag color="cyan">{patientCode}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày sinh">
              {formatDate(patient?.dateOfBirth)}
            </Descriptions.Item>
            <Descriptions.Item label="Giới tính">
              {formatGender(patient?.gender)}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">
              {patient?.phone || record?.patientPhone || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Số CCCD/CMND">
              {patient?.identityNumber || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Mã BHYT">
              {patient?.insuranceNumber || 'Không có'}
            </Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">
              {patient?.address || record?.address || '---'}
            </Descriptions.Item>
          </Descriptions>

          {/* 3. Chỉ số sinh tồn */}
          {(detail?.vitalSigns || record?.vitalSigns) && (
            <Descriptions
              title={<span style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a' }}>Chỉ số sinh tồn</span>}
              bordered
              size="small"
              column={{ xs: 2, sm: 4 }}
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="Mạch">
                <strong>{(detail?.vitalSigns || record?.vitalSigns)?.pulse || '---'}</strong> lần/phút
              </Descriptions.Item>
              <Descriptions.Item label="Huyết áp">
                <strong>{(detail?.vitalSigns || record?.vitalSigns)?.bloodPressure || '---'}</strong> mmHg
              </Descriptions.Item>
              <Descriptions.Item label="Thân nhiệt">
                <strong>{(detail?.vitalSigns || record?.vitalSigns)?.temperature || '---'}</strong> °C
              </Descriptions.Item>
              <Descriptions.Item label="Nhịp thở">
                <strong>{(detail?.vitalSigns || record?.vitalSigns)?.respiratoryRate || '---'}</strong> lần/phút
              </Descriptions.Item>
              <Descriptions.Item label="SpO2">
                <strong>{(detail?.vitalSigns || record?.vitalSigns)?.spO2 || '---'}</strong> %
              </Descriptions.Item>
              <Descriptions.Item label="Cân nặng">
                <strong>{(detail?.vitalSigns || record?.vitalSigns)?.weight || '---'}</strong> kg
              </Descriptions.Item>
              <Descriptions.Item label="Chiều cao">
                <strong>{(detail?.vitalSigns || record?.vitalSigns)?.height || '---'}</strong> cm
              </Descriptions.Item>
              <Descriptions.Item label="BMI">
                <strong>{(detail?.vitalSigns || record?.vitalSigns)?.bmi || '---'}</strong> kg/m²
              </Descriptions.Item>
            </Descriptions>
          )}

          {/* 4. Khám lâm sàng & Diễn biến */}
          <Descriptions
            title={<span style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a' }}>Khám lâm sàng & Tiền sử</span>}
            bordered
            size="small"
            column={1}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Lý do khám">
              {detail?.chiefComplaint || visit?.reason || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Triệu chứng / Bệnh sử">
              {detail?.symptoms || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Tiền sử bệnh">
              {detail?.medicalHistory || 'Không ghi nhận tiền sử đặc biệt'}
            </Descriptions.Item>
            <Descriptions.Item label="Khám thể chất & Cơ quan">
              {detail?.physicalExamination || 'Bình thường'}
            </Descriptions.Item>
            <Descriptions.Item label="Diễn biến lâm sàng">
              {detail?.clinicalProgress || '---'}
            </Descriptions.Item>
          </Descriptions>

          {/* 5. Chẩn đoán y khoa */}
          <Descriptions
            title={<span style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a' }}>Chẩn đoán & Kết luận</span>}
            bordered
            size="small"
            column={1}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Chẩn đoán chính (ICD-10)">
              {detail?.primaryIcdCode ? (
                <Space>
                  <Tag color="red" style={{ fontWeight: 600 }}>{detail.primaryIcdCode}</Tag>
                  <Text strong>{detail.primaryIcdName || detail.conclusion || '---'}</Text>
                </Space>
              ) : (
                <Text strong>{record?.conclusion || detail?.conclusion || '---'}</Text>
              )}
            </Descriptions.Item>
            {detail?.secondaryIcdCodes && detail.secondaryIcdCodes.length > 0 && (
              <Descriptions.Item label="Chẩn đoán kèm theo">
                <Space wrap>
                  {detail.secondaryIcdCodes.map((code, idx) => (
                    <Tag key={idx} color="orange">{code}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Kế hoạch điều trị">
              {detail?.treatmentPlan || 'Theo đơn thuốc và hướng dẫn của bác sĩ'}
            </Descriptions.Item>
            <Descriptions.Item label="Lời dặn của bác sĩ">
              {detail?.doctorInstructions || 'Tái khám khi có dấu hiệu bất thường'}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày hẹn tái khám">
              {detail?.revisitDate || record?.revisitDate ? formatDate(detail?.revisitDate || record?.revisitDate) : 'Không hẹn tái khám'}
            </Descriptions.Item>
          </Descriptions>

          {/* 6. Kết quả cận lâm sàng & Xét nghiệm */}
          {((detail?.clinicalTests || record?.clinicalTests)?.length > 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a', marginBottom: 8 }}>
                Chỉ định & Kết quả cận lâm sàng
              </div>
              <Table
                dataSource={detail?.clinicalTests || record?.clinicalTests || []}
                rowKey="name"
                pagination={false}
                size="small"
                bordered
                columns={[
                  { title: 'Tên dịch vụ cận lâm sàng', dataIndex: 'name', key: 'name', width: '38%' },
                  { title: 'Kết quả ghi nhận', dataIndex: 'result', key: 'result', render: (val) => <Text strong>{val}</Text> },
                  {
                    title: 'Đánh giá',
                    dataIndex: 'status',
                    key: 'status',
                    width: 140,
                    align: 'center',
                    render: (val) => (
                      <Tag color={val === 'Bình thường' || val === 'Âm tính' ? 'green' : 'orange'}>
                        {val}
                      </Tag>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {/* 7. Đơn thuốc đã cấp phát */}
          {((detail?.prescriptions || record?.prescriptions)?.length > 0) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e3a8a', marginBottom: 8 }}>
                Đơn thuốc đã cấp phát
              </div>
              <Table
                dataSource={detail?.prescriptions || record?.prescriptions || []}
                rowKey="medicineName"
                pagination={false}
                size="small"
                bordered
                columns={[
                  { title: 'Tên thuốc & Hàm lượng', dataIndex: 'medicineName', key: 'medicineName', render: (val) => <Text strong>{val}</Text> },
                  { title: 'Dạng bào chế', dataIndex: 'form', key: 'form', width: 130 },
                  { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'center', render: (val) => <Tag color="blue">{val}</Tag> },
                  { title: 'Hướng dẫn sử dụng & Liều dùng', dataIndex: 'usage', key: 'usage' },
                ]}
              />
            </div>
          )}

          {/* 5. Tem chữ ký số điện tử của bác sĩ */}
          <div style={{ marginTop: 16, padding: '16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                  Xác thực chữ ký số điện tử & Niêm phong bệnh án
                </Text>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Bác sĩ chịu trách nhiệm chuyên môn: <strong>{doctorName}</strong>
                </div>
                {detail?.signedAt && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Thời điểm ký số: {formatDateTime(detail.signedAt)}
                  </div>
                )}
              </div>
              <Tag icon={<SafetyCertificateFilled />} color="green" style={{ padding: '4px 10px', fontSize: 13 }}>
                ĐÃ KÝ DUYỆT HỢP LỆ
              </Tag>
            </div>
            {detail?.signatureData && (
              <div style={{ marginTop: 12 }}>
                <MedicalRecordSignatureStamp
                  signatureData={detail.signatureData}
                  fallbackDoctorName={doctorName}
                  fallbackSignedAt={detail.signedAt}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ArchivedMedicalRecordDetailModal
