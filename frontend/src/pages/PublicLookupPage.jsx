import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LockOutlined,
  LoginOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import portalApi from '../api/portalApi.js'
import './styles/publicLookup.css'

const { Text, Title, Paragraph } = Typography

const formatDate = (val) => (val && dayjs(val).isValid() ? dayjs(val).format('DD/MM/YYYY') : '—')
const formatDateTime = (val) => (val && dayjs(val).isValid() ? dayjs(val).format('HH:mm DD/MM/YYYY') : '—')

const formatGender = (gender) => {
  if (!gender) return '—'
  const upper = String(gender).toUpperCase()
  if (upper === 'MALE') return 'Nam'
  if (upper === 'FEMALE') return 'Nữ'
  return gender
}

const formatRoute = (route) => {
  if (!route) return '—'
  const upper = String(route).toUpperCase()
  if (upper === 'ORAL') return 'Uống'
  if (upper === 'INJECTION') return 'Tiêm'
  if (upper === 'TOPICAL') return 'Dùng ngoài'
  if (upper === 'EYE_DROPS') return 'Nhỏ mắt'
  if (upper === 'INHALATION') return 'Hít'
  return route
}

function PublicLookupPage() {
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleLookup = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (loading) return

    const trimmedCode = code.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedCode) {
      setError('Vui lòng nhập mã lịch hẹn để tra cứu.')
      setResult(null)
      return
    }

    setLoading(true)
    setError('')
    setResult(null) // CRITICAL: Reset previous result on new query

    try {
      const response = await portalApi.lookup({
        code: trimmedCode,
        phone: trimmedPhone,
      })

      if (response && response.data) {
        setResult(response.data)
      } else {
        setError('Không tìm thấy kết quả phù hợp. Vui lòng kiểm tra lại mã hẹn, số điện thoại hoặc trạng thái lượt khám.')
      }
    } catch (err) {
      setResult(null)
      const status = err?.response?.status
      if (status === 400) {
        setError('Thông tin tra cứu chưa hợp lệ. Vui lòng kiểm tra lại mã hẹn.')
      } else if (status === 404) {
        setError('Không tìm thấy kết quả phù hợp. Vui lòng kiểm tra lại mã hẹn, số điện thoại hoặc trạng thái lượt khám.')
      } else if (status === 429) {
        setError('Bạn đã thực hiện quá nhiều yêu cầu, vui lòng thử lại sau.')
      } else {
        setError('Hệ thống đang gặp sự cố. Vui lòng thử lại sau.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCode('')
    setPhone('')
    setError('')
    setResult(null)
    setLoading(false)
  }

  const diagnosesColumns = [
    {
      title: 'Mã ICD',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (val) => <Tag color="blue">{val || '—'}</Tag>,
    },
    {
      title: 'Tên chẩn đoán',
      dataIndex: 'name',
      key: 'name',
      render: (val) => <Text strong>{val || '—'}</Text>,
    },
    {
      title: 'Phân loại',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type) => {
        if (!type) return '—'
        const upper = String(type).toUpperCase()
        if (upper === 'PRIMARY') return <Tag color="red">Chẩn đoán chính</Tag>
        if (upper === 'SECONDARY') return <Tag color="orange">Chẩn đoán kèm theo</Tag>
        return <Tag>{type}</Tag>
      },
    },
  ]

  const testResultsColumns = [
    {
      title: 'Mã dịch vụ',
      dataIndex: 'serviceCode',
      key: 'serviceCode',
      width: 120,
      render: (val) => <Tag color="cyan">{val || '—'}</Tag>,
    },
    {
      title: 'Tên xét nghiệm / Dịch vụ',
      dataIndex: 'serviceName',
      key: 'serviceName',
      render: (val) => <Text strong>{val || '—'}</Text>,
    },
    {
      title: 'Kết quả',
      dataIndex: 'value',
      key: 'value',
      render: (val) => <Text style={{ color: '#096dd9', fontWeight: 600 }}>{val || '—'}</Text>,
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      render: (val) => val || '—',
    },
    {
      title: 'CS Tham chiếu',
      dataIndex: 'referenceRange',
      key: 'referenceRange',
      width: 140,
      render: (val) => val || '—',
    },
    {
      title: 'Kết luận cận lâm sàng',
      dataIndex: 'conclusion',
      key: 'conclusion',
      render: (val) => (val ? <Tag color="green">{val}</Tag> : '—'),
    },
  ]

  const prescriptionColumns = [
    {
      title: 'Tên thuốc',
      dataIndex: 'medicineName',
      key: 'medicineName',
      render: (name, item) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[item.activeIngredient, item.strength].filter(Boolean).join(' · ')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Liều dùng & Tần suất',
      key: 'dosageInfo',
      render: (_, item) => {
        const freqStr = item.frequency ? `${item.frequency} lần/ngày` : ''
        return [item.dosage, freqStr].filter(Boolean).join(' — ') || '—'
      },
    },
    {
      title: 'Đường dùng',
      dataIndex: 'route',
      key: 'route',
      width: 110,
      render: (route) => <Tag color="blue">{formatRoute(route)}</Tag>,
    },
    {
      title: 'Số ngày',
      dataIndex: 'durationDays',
      key: 'durationDays',
      width: 100,
      align: 'center',
      render: (days) => (days ? `${days} ngày` : '—'),
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (_, item) => (item.quantity ? `${item.quantity} ${item.unit || ''}` : '—'),
    },
    {
      title: 'Hướng dẫn dùng thuốc',
      dataIndex: 'instructions',
      key: 'instructions',
      render: (val) => val || '—',
    },
  ]

  return (
    <div className="public-lookup-page">
      <div className="public-lookup-decoration public-lookup-decoration-one" aria-hidden="true" />
      <div className="public-lookup-decoration public-lookup-decoration-two" aria-hidden="true" />

      {/* Header */}
      <header className="public-lookup-header">
        <div className="public-lookup-header-inner">
          <Link className="public-lookup-brand" to="/portal" aria-label="Bệnh Án Số - Cổng tra cứu">
            <span className="public-lookup-brand-icon">
              <MedicineBoxOutlined />
            </span>
            <span>
              <strong>BỆNH ÁN SỐ</strong>
              <small>Cổng tra cứu kết quả khám bệnh trực tuyến</small>
            </span>
          </Link>

          <div className="public-lookup-header-actions">
            <span className="public-lookup-secure">
              <SafetyCertificateOutlined /> Tra cứu an toàn
            </span>
            <Link className="public-lookup-login" to="/portal/login" style={{ background: '#e6f7ff', borderColor: '#91d5ff', color: '#096dd9' }}>
              <UserOutlined /> Đăng nhập Bệnh nhân
            </Link>
            <Link className="public-lookup-login" to="/login">
              <LoginOutlined /> Đăng nhập nhân viên
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="public-lookup-main" style={{ gridTemplateColumns: result ? '1fr' : undefined }}>
        <section className="public-lookup-intro">
          <span className="public-lookup-eyebrow">
            <SafetyCertificateOutlined /> Tra cứu kết quả trực tuyến
          </span>
          <h1>Tra cứu kết quả khám bệnh</h1>
          <p>
            Nhập mã hẹn để tra cứu kết quả khám đã được hệ thống công bố.
          </p>

          <div className="public-lookup-steps" aria-label="Hướng dẫn tra cứu">
            <div>
              <b>1</b>
              <span>
                <strong>Nhập mã hẹn</strong>
                <small>Sử dụng mã hẹn để tra cứu kết quả.</small>
              </span>
            </div>
            <div>
              <b>2</b>
              <span>
                <strong>Xác minh số điện thoại (tùy chọn)</strong>
                <small>Bảo vệ riêng tư thông tin y tế.</small>
              </span>
            </div>
            <div>
              <b>3</b>
              <span>
                <strong>Xem kết quả khám</strong>
                <small>Nhận chẩn đoán và dặn dò của bác sĩ.</small>
              </span>
            </div>
          </div>

          <div className="public-lookup-trust-note">
            <LockOutlined />
            <span>
              <strong>Bảo mật thông tin y tế</strong>
              <small>Dữ liệu chỉ hiển thị khi tra cứu đúng Mã hẹn hợp lệ.</small>
            </span>
          </div>
        </section>

        {/* Search Card Section */}
        <section className="public-lookup-card">
          <div className="public-lookup-card-heading">
            <span>
              <SearchOutlined />
            </span>
            <div>
              <h2>Tra cứu kết quả</h2>
              <p>Vui lòng nhập chính xác mã hẹn và số điện thoại bệnh nhân.</p>
            </div>
          </div>

          <form className="public-lookup-form" onSubmit={handleLookup} noValidate>
            <div className="public-lookup-field">
              <label htmlFor="public-appointment-code">
                Mã hẹn <b>*</b>
              </label>
              <Input
                id="public-appointment-code"
                size="large"
                prefix={<CalendarOutlined />}
                placeholder="Ví dụ: APT000001"
                value={code}
                maxLength={30}
                autoComplete="off"
                disabled={loading}
                onChange={(e) => {
                  setError('')
                  setCode(e.target.value)
                }}
              />
              <small>Nhập mã hẹn hợp lệ để tra cứu kết quả khám.</small>
            </div>

            <div className="public-lookup-field">
              <label htmlFor="public-phone-number">Số điện thoại bệnh nhân (tùy chọn)</label>
              <Input
                id="public-phone-number"
                size="large"
                prefix={<PhoneOutlined />}
                placeholder="Nhập số điện thoại để xác thực (nếu cần)"
                value={phone}
                maxLength={20}
                inputMode="tel"
                autoComplete="off"
                disabled={loading}
                onChange={(e) => {
                  setError('')
                  setPhone(e.target.value)
                }}
              />
              <small>Nhập số điện thoại để xác thực thêm nếu cần.</small>
            </div>

            <Button
              className="public-lookup-submit"
              type="primary"
              size="large"
              htmlType="submit"
              icon={<SearchOutlined />}
              loading={loading}
              disabled={loading}
              block
            >
              Tra cứu kết quả
            </Button>

            <div className="public-lookup-privacy">
              <LockOutlined /> Dữ liệu tra cứu an toàn và bảo mật.
            </div>
          </form>

          {/* Feedback Alert */}
          {error && (
            <div className="public-lookup-feedback">
              <Alert
                type="error"
                showIcon
                message="Thông báo tra cứu"
                description={error}
                closable
                onClose={() => setError('')}
              />
            </div>
          )}
        </section>
      </main>

      {/* Result Display Section (Renders when result is loaded) */}
      {result && (
        <div style={{ width: 'min(1080px, calc(100% - 40px))', margin: '0 auto 48px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Title level={4} style={{ margin: 0, color: '#172840' }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              KẾT QUẢ KHÁM BỆNH CHI TIẾT
            </Title>
            <Button icon={<ArrowLeftOutlined />} onClick={handleReset}>
              Tra cứu mã khác
            </Button>
          </div>

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Section A: THÔNG TIN BỆNH NHÂN */}
            <Card title={<Space><UserOutlined style={{ color: '#1890ff' }} /><span>THÔNG TIN BỆNH NHÂN</span></Space>} style={{ borderRadius: 12 }}>
              <Descriptions column={{ xs: 1, sm: 2, md: 4 }} bordered size="middle">
                <Descriptions.Item label="Họ và tên"><Text strong>{result.patientName || '—'}</Text></Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">{formatDate(result.patientDateOfBirth)}</Descriptions.Item>
                <Descriptions.Item label="Giới tính">{formatGender(result.patientGender)}</Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">{result.patientPhoneMasked || '—'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Section B: THÔNG TIN LƯỢT KHÁM */}
            <Card title={<Space><CalendarOutlined style={{ color: '#722ed1' }} /><span>THÔNG TIN LƯỢT KHÁM</span></Space>} style={{ borderRadius: 12 }}>
              <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="middle">
                <Descriptions.Item label="Mã hẹn"><Tag color="purple">{result.appointmentCode || '—'}</Tag></Descriptions.Item>
                <Descriptions.Item label="Thời gian hẹn">{formatDateTime(result.appointmentStartTime)}</Descriptions.Item>
                <Descriptions.Item label="Lý do khám">{result.appointmentReason || '—'}</Descriptions.Item>
                <Descriptions.Item label="Mã lượt khám"><Tag color="blue">{result.visitCode || '—'}</Tag></Descriptions.Item>
                <Descriptions.Item label="Thời gian khám">{formatDateTime(result.visitAt)}</Descriptions.Item>
                <Descriptions.Item label="Bác sĩ phụ trách">{result.doctorName ? `BS. ${result.doctorName.replace(/^BS\.\s*/i, '')}` : '—'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Section C: KẾT LUẬN & DẶN DÒ */}
            <Card title={<Space><InfoCircleOutlined style={{ color: '#fa8c16' }} /><span>KẾT LUẬN & DẶN DÒ BÁC SĨ</span></Space>} style={{ borderRadius: 12 }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, borderLeft: '4px solid #1890ff', height: '100%' }}>
                    <Text type="secondary" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>KẾT LUẬN CHUNG</Text>
                    <Text strong style={{ fontSize: 15, color: '#262626' }}>{result.conclusion || '—'}</Text>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div style={{ background: '#f6ffed', padding: 16, borderRadius: 8, borderLeft: '4px solid #52c41a', height: '100%' }}>
                    <Text type="secondary" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>DẶN DÒ & CHỈ ĐỊNH BÁC SĨ</Text>
                    <Text style={{ fontSize: 15, color: '#274e13' }}>{result.doctorInstructions || '—'}</Text>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Section D: CHẨN ĐOÁN */}
            <Card title={<Space><FileTextOutlined style={{ color: '#ff4d4f' }} /><span>CHẨN ĐOÁN CỦA BÁC SĨ</span></Space>} style={{ borderRadius: 12 }}>
              {Array.isArray(result.diagnoses) && result.diagnoses.length > 0 ? (
                <Table
                  columns={diagnosesColumns}
                  dataSource={result.diagnoses}
                  rowKey={(r, idx) => r.code || idx}
                  pagination={false}
                  size="middle"
                />
              ) : (
                <Empty description="Không có chẩn đoán được công bố." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            {/* Section E: KẾT QUẢ CẬN LÂM SÀNG */}
            <Card title={<Space><FileDoneOutlined style={{ color: '#13c2c2' }} /><span>KẾT QUẢ CẬN LÂM SÀNG & XÉT NGHIỆM</span></Space>} style={{ borderRadius: 12 }}>
              {Array.isArray(result.clinicalTestResults) && result.clinicalTestResults.length > 0 ? (
                <Table
                  columns={testResultsColumns}
                  dataSource={result.clinicalTestResults}
                  rowKey={(r, idx) => r.serviceCode || idx}
                  pagination={false}
                  size="middle"
                  scroll={{ x: 'max-content' }}
                />
              ) : (
                <Empty description="Không có kết quả cận lâm sàng." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            {/* Section F: ĐƠN THUỐC */}
            <Card title={<Space><MedicineBoxOutlined style={{ color: '#eb2f96' }} /><span>ĐƠN THUỐC CHỈ ĐỊNH</span></Space>} style={{ borderRadius: 12 }}>
              {Array.isArray(result.prescriptions) && result.prescriptions.length > 0 ? (
                <Table
                  columns={prescriptionColumns}
                  dataSource={result.prescriptions}
                  rowKey={(r, idx) => r.medicineName || idx}
                  pagination={false}
                  size="middle"
                  scroll={{ x: 'max-content' }}
                />
              ) : (
                <Empty description="Không có thuốc được kê trong lượt khám này." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Space>
        </div>
      )}

      {/* Footer */}
      <footer className="public-lookup-footer">
        <div className="public-lookup-header-inner">
          <span>© {new Date().getFullYear()} Bệnh Án Số — Hệ thống quản lý hồ sơ sức khỏe điện tử</span>
          <span>
            <SafetyCertificateOutlined /> Kết nối tra cứu an toàn & bảo mật
          </span>
        </div>
      </footer>
    </div>
  )
}

export default PublicLookupPage
