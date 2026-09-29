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
import PortalCyberBackground from '../components/portal/PortalCyberBackground'
import PortalCyberHeader from '../components/portal/PortalCyberHeader'
import './styles/portalLogin.css'
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
    <div className="portal-cyber-login-page public-lookup-page">
      <PortalCyberBackground />

      <PortalCyberHeader activePage="lookup" />

      {/* Main Content */}
      <main className="public-lookup-main" style={{ gridTemplateColumns: result ? '1fr' : undefined }}>
        <section className="public-lookup-intro">
          <span className="public-lookup-eyebrow">
            <SafetyCertificateOutlined /> Tra cứu kết quả trực tuyến
          </span>
          <h1 className="public-lookup-title">Tra cứu kết quả khám bệnh</h1>
          <p className="public-lookup-desc">
            Nhập mã hẹn để tra cứu kết quả khám bệnh, chỉ định thuốc và kết luận chuyên khoa đã được cơ sở y tế công bố trực tuyến.
          </p>

          <div className="public-lookup-steps" aria-label="Hướng dẫn tra cứu">
            <div className="public-lookup-step-item">
              <div className="step-num">01</div>
              <div className="step-body">
                <strong>Nhập mã hẹn</strong>
                <small>Sử dụng mã hẹn (ví dụ: APT000001) được cấp khi đăng ký khám.</small>
              </div>
            </div>
            <div className="public-lookup-step-item">
              <div className="step-num">02</div>
              <div className="step-body">
                <strong>Xác minh số điện thoại (tùy chọn)</strong>
                <small>Bảo vệ quyền riêng tư và đối soát dữ liệu bệnh nhân.</small>
              </div>
            </div>
            <div className="public-lookup-step-item">
              <div className="step-num">03</div>
              <div className="step-body">
                <strong>Xem kết quả khám tức thì</strong>
                <small>Xem chẩn đoán, cận lâm sàng và dặn dò của bác sĩ.</small>
              </div>
            </div>
          </div>

          <div className="public-lookup-trust-note">
            <LockOutlined className="trust-icon" />
            <div>
              <strong>Bảo mật thông tin y tế 100%</strong>
              <small>Dữ liệu chỉ hiển thị khi tra cứu đúng Mã hẹn hợp lệ theo quy định an toàn.</small>
            </div>
          </div>
        </section>

        {/* Search Card Section */}
        <section className="public-lookup-card">
          <div className="public-lookup-card-heading">
            <span className="public-lookup-card-icon">
              <SearchOutlined />
            </span>
            <div>
              <span className="public-lookup-card-badge">
                <SafetyCertificateOutlined /> Cổng tra cứu công khai
              </span>
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
              <LockOutlined /> Dữ liệu tra cứu an toàn và bảo mật theo chuẩn y tế điện tử.
            </div>

            <div className="public-lookup-card-foot">
              <span>Đã có tài khoản Bệnh nhân?</span>
              <Link to="/portal/login">Đăng nhập để xem toàn bộ hồ sơ y bạ &rarr;</Link>
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
        <div className="public-lookup-result-wrap">
          <div className="public-lookup-result-header">
            <div className="result-header-title">
              <span className="result-header-badge-icon">
                <CheckCircleOutlined />
              </span>
              <div>
                <h3>KẾT QUẢ KHÁM BỆNH CHI TIẾT</h3>
                <p>Mã hẹn: <b>{result.appointmentCode}</b> &bull; Lượt khám: <b>{result.visitCode || '—'}</b></p>
              </div>
            </div>
            <Button className="public-lookup-reset-btn" icon={<ArrowLeftOutlined />} onClick={handleReset}>
              Tra cứu mã khác
            </Button>
          </div>

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Section A: THÔNG TIN BỆNH NHÂN */}
            <Card className="public-result-card" title={<Space><UserOutlined style={{ color: '#0284c7' }} /><span>THÔNG TIN BỆNH NHÂN</span></Space>}>
              <Descriptions column={{ xs: 1, sm: 2, md: 4 }} bordered size="middle">
                <Descriptions.Item label="Họ và tên"><Text strong>{result.patientName || '—'}</Text></Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">{formatDate(result.patientDateOfBirth)}</Descriptions.Item>
                <Descriptions.Item label="Giới tính">{formatGender(result.patientGender)}</Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">{result.patientPhoneMasked || '—'}</Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Section B: THÔNG TIN LƯỢT KHÁM */}
            <Card className="public-result-card" title={<Space><CalendarOutlined style={{ color: '#7c3aed' }} /><span>THÔNG TIN LƯỢT KHÁM</span></Space>}>
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
            <Card className="public-result-card" title={<Space><InfoCircleOutlined style={{ color: '#f59e0b' }} /><span>KẾT LUẬN & DẶN DÒ BÁC SĨ</span></Space>}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <div className="conclusion-box conclusion-primary">
                    <Text type="secondary" className="conclusion-lbl">KẾT LUẬN CHUNG</Text>
                    <div className="conclusion-val">{result.conclusion || '—'}</div>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div className="conclusion-box conclusion-success">
                    <Text type="secondary" className="conclusion-lbl">DẶN DÒ & CHỈ ĐỊNH BÁC SĨ</Text>
                    <div className="conclusion-val">{result.doctorInstructions || '—'}</div>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Section D: CHẨN ĐOÁN */}
            <Card className="public-result-card" title={<Space><FileTextOutlined style={{ color: '#ef4444' }} /><span>CHẨN ĐOÁN CỦA BÁC SĨ</span></Space>}>
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
            <Card className="public-result-card" title={<Space><FileDoneOutlined style={{ color: '#06b6d4' }} /><span>KẾT QUẢ CẬN LÂM SÀNG & XÉT NGHIỆM</span></Space>}>
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
            <Card className="public-result-card" title={<Space><MedicineBoxOutlined style={{ color: '#ec4899' }} /><span>ĐƠN THUỐC CHỈ ĐỊNH</span></Space>}>
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
        <div className="public-lookup-footer-inner">
          <span>© {new Date().getFullYear()} Bệnh Án Số — Hệ thống chuyển đổi số y tế &amp; hồ sơ sức khỏe điện tử</span>
          <span>
            <SafetyCertificateOutlined /> Kết nối tra cứu dữ liệu an toàn &amp; bảo mật
          </span>
        </div>
      </footer>
    </div>
  )
}

export default PublicLookupPage
