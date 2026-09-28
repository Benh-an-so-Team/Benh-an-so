import React, { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Form, Input, Button, Alert, message } from 'antd'
import {
  PhoneOutlined,
  LockOutlined,
  MedicineBoxOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAuthContext } from '../context/AuthContext'
import './styles/portalLogin.css'

function PortalLogin() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorType, setErrorType] = useState('error')
  const [lockoutSeconds, setLockoutSeconds] = useState(0)

  const navigate = useNavigate()
  const location = useLocation()
  const { patientLogin, isAuthenticated, user } = useAuthContext()

  const userRoles = (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  const isPatient = userRoles.includes('patient')

  useEffect(() => {
    if (location.state?.phone) {
      form.setFieldsValue({ phone: location.state.phone })
    }
  }, [location.state, form])

  if (isAuthenticated && isPatient) {
    return <Navigate to="/portal/dashboard" replace />
  }

  useEffect(() => {
    if (lockoutSeconds <= 0) return undefined
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setErrorMessage('')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [lockoutSeconds])

  const handleSubmit = async (values) => {
    if (lockoutSeconds > 0) {
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const result = await patientLogin({
        phone: String(values.phone || '').trim(),
        password: values.password,
      })

      if (result.success) {
        message.success('Đăng nhập cổng bệnh nhân thành công!')
        navigate('/portal/dashboard', { replace: true })
      } else {
        if (result.status === 429 || result.isLockout) {
          const retryAfter = result.retryAfterSeconds || result.data?.details?.retryAfterSeconds || result.data?.retryAfterSeconds || 60
          setLockoutSeconds(retryAfter)
          setErrorType('warning')
          setErrorMessage(`Tài khoản tạm khóa. Vui lòng thử lại sau ${retryAfter} giây.`)
        } else if (result.status === 403) {
          setErrorType('error')
          setErrorMessage('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ phòng khám để được hỗ trợ.')
        } else {
          setErrorType('error')
          setErrorMessage(result.message || 'Số điện thoại hoặc mật khẩu không chính xác.')
        }
      }
    } catch (error) {
      setErrorType('error')
      setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-login-page">
      <div className="portal-login-decoration portal-login-decoration-one" aria-hidden="true" />
      <div className="portal-login-decoration portal-login-decoration-two" aria-hidden="true" />

      <header className="portal-login-header">
        <div className="portal-login-header-inner">
          <Link className="portal-login-brand" to="/portal">
            <span className="portal-login-brand-icon">
              <MedicineBoxOutlined />
            </span>
            <span>
              <strong>BỆNH ÁN SỐ</strong>
              <small>Cổng thông tin bệnh nhân trực tuyến</small>
            </span>
          </Link>

          <div className="portal-login-header-links">
            <Link className="portal-header-link" to="/portal">
              <SearchOutlined /> Tra cứu theo mã hẹn
            </Link>
            <Link className="portal-header-link" to="/login">
              <UserOutlined /> Đăng nhập nhân viên
            </Link>
          </div>
        </div>
      </header>

      <main className="portal-login-main">
        <div className="portal-login-card">
          <div className="portal-login-card-header">
            <div className="portal-login-card-badge">
              <SafetyCertificateOutlined /> Cổng bệnh nhân
            </div>
            <h1 className="portal-login-card-title">Đăng nhập tài khoản</h1>
            <p className="portal-login-card-sub">
              Xem hồ sơ bệnh án, lịch sử khám, đơn thuốc và kết quả xét nghiệm trực tuyến
            </p>
          </div>

          {errorMessage && (
            <Alert
              className="portal-login-alert"
              type={errorType}
              showIcon
              message={
                lockoutSeconds > 0
                  ? `Tài khoản tạm khóa. Thử lại sau ${lockoutSeconds} giây.`
                  : errorMessage
              }
            />
          )}

          <Form
            form={form}
            className="portal-login-form"
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            requiredMark={false}
          >
            <Form.Item
              label={<span style={{ fontWeight: 600, color: '#334155' }}>Số điện thoại</span>}
              name="phone"
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại' },
                { pattern: /^[0-9+]{8,15}$/, message: 'Số điện thoại không hợp lệ' },
              ]}
            >
              <Input
                prefix={<PhoneOutlined />}
                placeholder="Nhập số điện thoại đăng ký"
                disabled={loading || lockoutSeconds > 0}
                autoFocus
              />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontWeight: 600, color: '#334155' }}>Mật khẩu</span>}
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Nhập mật khẩu"
                disabled={loading || lockoutSeconds > 0}
              />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -10, marginBottom: 16 }}>
              <Link
                to="/portal/forgot-password"
                style={{ fontSize: 13, color: '#1677ff', fontWeight: 500 }}
              >
                Quên mật khẩu?
              </Link>
            </div>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                className="portal-login-btn"
                type="primary"
                htmlType="submit"
                loading={loading}
                disabled={lockoutSeconds > 0}
                block
              >
                {lockoutSeconds > 0 ? `Vui lòng thử lại sau (${lockoutSeconds}s)` : 'Đăng nhập Cổng bệnh nhân'}
              </Button>
            </Form.Item>
          </Form>

          <div className="portal-login-footer">
            <div className="portal-login-footer-text">
              Chưa có tài khoản Bệnh nhân?{' '}
              <Link to="/portal/register">Đăng ký ngay</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default PortalLogin
