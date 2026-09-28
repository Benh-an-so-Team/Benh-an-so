import React, { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Form, Input, Button, Alert, message } from 'antd'
import { UserOutlined, LockOutlined, SearchOutlined } from '@ant-design/icons'
import { useAuthContext } from '../context/AuthContext.jsx'
import { getDefaultHomePath } from '../components/layout/navigationConfig.js'
import { popSessionExpiredNotice } from '../utils/sessionManagementHelpers.js'
import './login.css'

function Login() {
  const [loading, setLoading] = useState(false)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState('')
  const navigate = useNavigate()
  const { login, logout, isAuthenticated, user } = useAuthContext()

  useEffect(() => {
    const notice = popSessionExpiredNotice()
    if (notice) {
      setSessionExpiredNotice(notice)
    }
  }, [])

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

  if (isAuthenticated && user) {
    const userRoles = (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
    if (userRoles.includes('patient')) {
      return <Navigate to="/portal/dashboard" replace />
    }
    return <Navigate to={getDefaultHomePath(user?.roles, user?.permissions)} replace />
  }

  const handleSubmit = async (values) => {
    if (lockoutSeconds > 0) {
      return
    }
    setLoading(true)
    setErrorMessage('')
    try {
      const result = await login(values)
      if (result.success) {
        if (result.twoFactorRequired) {
          navigate('/login/verify-2fa', {
            state: {
              twoFactorToken: result.twoFactorToken,
              twoFactorExpiresAt: result.twoFactorExpiresAt,
              username: values.username,
            },
          })
          return
        }
        setLockoutSeconds(0)
        setErrorMessage('')
        const targetUser = result.user || JSON.parse(localStorage.getItem('user') || '{}')
        const userRoles = (targetUser?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
        if (userRoles.includes('patient')) {
          logout()
          message.warning('Tài khoản này là tài khoản bệnh nhân. Vui lòng đăng nhập tại Cổng bệnh nhân.')
          navigate('/portal/login', { replace: true, state: { phone: values.username } })
          return
        }
        message.success('Đăng nhập thành công!')
        const destination = getDefaultHomePath(targetUser?.roles, targetUser?.permissions)
        navigate(destination, { replace: true })
      } else {
        if (result.isLockout || result.status === 429) {
          const seconds = result.retryAfterSeconds || 60
          setLockoutSeconds(seconds)
          setErrorMessage(`Tài khoản tạm khóa. Vui lòng thử lại sau ${seconds} giây.`)
        } else if (
          result.isTempPasswordExpired ||
          result.errorCode === 'TEMP_PASSWORD_EXPIRED' ||
          result.data?.code === 'TEMP_PASSWORD_EXPIRED'
        ) {
          const msg = result.message || 'Mật khẩu tạm thời đã hết hạn. Vui lòng liên hệ Quản trị viên để được cấp lại.'
          setErrorMessage(msg)
          message.error(msg)
        } else {
          const msg = result.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.'
          setErrorMessage(msg)
          message.error(msg)
        }
      }
    } catch (error) {
      const msg = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại.'
      setErrorMessage(msg)
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bsa2-page">
      <div className="bsa2-card">
        <svg className="bsa2-ecg" viewBox="0 0 360 40">
          <path
            className="bsa2-pulse"
            d="M0 20 L60 20 L74 20 L82 4 L92 36 L100 20 L120 20 L360 20"
            fill="none"
            stroke="#2FA8A0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="bsa2-title">Bệnh Án Số</div>
        <p className="bsa2-sub">Đăng nhập hệ thống khám chữa bệnh</p>

        {sessionExpiredNotice && (
          <Alert
            className="bsa2-login-alert"
            type="warning"
            showIcon
            message={sessionExpiredNotice}
            closable
            onClose={() => setSessionExpiredNotice('')}
            style={{ marginBottom: 16, textAlign: 'left', borderRadius: 8 }}
          />
        )}

        {errorMessage && (
          <Alert
            className="bsa2-login-alert"
            type={lockoutSeconds > 0 ? 'warning' : 'error'}
            showIcon
            message={
              lockoutSeconds > 0
                ? `Tài khoản tạm khóa. Vui lòng thử lại sau ${lockoutSeconds} giây.`
                : errorMessage
            }
            style={{ marginBottom: 16, textAlign: 'left' }}
          />
        )}

        <Form
          className="bsa2-form"
          name="login"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Tên đăng nhập"
              bordered={false}
              disabled={loading || lockoutSeconds > 0}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mật khẩu"
              bordered={false}
              disabled={loading || lockoutSeconds > 0}
            /> 
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={lockoutSeconds > 0}
              block
              style={{ height: 44, fontSize: 16 }}
            >
              {lockoutSeconds > 0 ? `Vui lòng thử lại sau (${lockoutSeconds}s)` : 'Đăng nhập'}
            </Button>
          </Form.Item>
        </Form>

        <div className="bsa2-patient-divider">
          <span>Dành cho bệnh nhân</span>
        </div>

        <div className="bsa2-patient-actions">
          <Link className="bsa2-patient-btn primary" to="/portal/login">
            <UserOutlined /> Đăng nhập Cổng bệnh nhân
          </Link>
          <Link className="bsa2-patient-btn secondary" to="/public-lookup">
            <SearchOutlined /> Tra cứu lịch hẹn
          </Link>
        </div>

        <div className="bsa2-foot">
          <span>Phiên bản nội bộ · Bệnh Án Số</span>
        </div>
      </div>
    </div>
  )
}

export default Login
