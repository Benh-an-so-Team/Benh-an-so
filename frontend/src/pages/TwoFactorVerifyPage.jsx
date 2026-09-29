import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Form, Input, Button, Alert, message, Card, Space } from 'antd'
import {
  SafetyOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import twoFactorAuthApi from '../api/twoFactorAuthApi.js'
import { useAuthContext } from '../context/AuthContext.jsx'
import { getDefaultHomePath } from '../components/layout/navigationConfig.js'
import {
  isOtpValid,
  maskUsername,
  calculateRemainingSeconds,
  formatTimeCountdown,
  mapTwoFactorError,
} from '../utils/twoFactorHelpers.js'
import './login.css'

// ============================================================================
// CẤU HÌNH MÔI TRƯỜNG PHÁT TRIỂN (DEV CONFIG)
// ============================================================================
// TODO [PRODUCTION CHECKLIST]: Đổi thành false hoặc xóa khối Banner tương ứng
// trước khi bàn giao hệ thống cho người dùng thật.
const SHOW_DEV_HINT = false

function TwoFactorVerifyPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { completeTwoFactorLogin } = useAuthContext()

  const twoFactorToken = location.state?.twoFactorToken
  const initialExpiresAt = location.state?.twoFactorExpiresAt
  const rawUsername = location.state?.username || ''

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(60) // Bắt đầu với cooldown 60s
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    calculateRemainingSeconds(initialExpiresAt)
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [isExpired, setIsExpired] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  const inputRef = useRef(null)

  // Tự động focus ô nhập khi vào trang
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Đếm ngược thời gian hết hạn của thử thách (challenge)
  useEffect(() => {
    if (!expiresAt) return undefined

    const updateTimer = () => {
      const sec = calculateRemainingSeconds(expiresAt)
      setRemainingSeconds(sec)
      if (sec <= 0) {
        setIsExpired(true)
        setErrorMessage('Mã xác thực đã hết hạn. Vui lòng đăng nhập lại.')
      }
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  // Đếm ngược thời gian cooldown nút gửi lại mã (60 giây)
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Xử lý xác nhận mã OTP
  const handleVerify = useCallback(
    async (otpToVerify) => {
      const targetOtp = otpToVerify || code
      if (!isOtpValid(targetOtp)) {
        setErrorMessage('Vui lòng nhập đúng 6 chữ số mã xác thực.')
        return
      }

      if (isExpired || isLocked || loading) {
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const response = await twoFactorAuthApi.verify(twoFactorToken, targetOtp)
        const responseData = response.data

        // Tái sử dụng logic lưu session và người dùng từ AuthContext
        const result = completeTwoFactorLogin(responseData)
        message.success('Xác thực hai lớp thành công! Đang chuyển hướng...')

        const targetUser = result?.user || responseData
        const destination = getDefaultHomePath(targetUser?.roles, targetUser?.permissions)
        navigate(destination, { replace: true })
      } catch (error) {
        const mapped = mapTwoFactorError(error)
        setErrorMessage(mapped.message)
        if (mapped.isExpired) {
          setIsExpired(true)
        }
        if (mapped.isLocked) {
          setIsLocked(true)
        }
      } finally {
        setLoading(false)
      }
    },
    [code, twoFactorToken, isExpired, isLocked, loading, completeTwoFactorLogin, navigate]
  )

  // Tự động submit khi nhập đủ 6 số
  const handleCodeChange = (e) => {
    const rawVal = e.target.value || ''
    // Chỉ giữ lại ký tự số, tối đa 6 ký tự
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 6)
    setCode(digitsOnly)
    setErrorMessage('')

    if (digitsOnly.length === 6 && !loading && !isExpired && !isLocked) {
      handleVerify(digitsOnly)
    }
  }

  // Xử lý gửi lại mã OTP
  const handleResend = async () => {
    if (cooldown > 0 || isExpired || isLocked || resending) {
      return
    }

    setResending(true)
    setErrorMessage('')

    try {
      const response = await twoFactorAuthApi.resend(twoFactorToken)
      const newExpires = response.data?.expiresAt || new Date(Date.now() + 300000).toISOString()
      setExpiresAt(newExpires)
      setIsExpired(false)
      setCooldown(60)
      setCode('')
      message.success('Đã gửi lại mã xác thực mới. Vui lòng kiểm tra.')
      inputRef.current?.focus()
    } catch (error) {
      const mapped = mapTwoFactorError(error)
      setErrorMessage(mapped.message)
      if (mapped.isExpired) {
        setIsExpired(true)
      }
      if (mapped.isLocked) {
        setIsLocked(true)
      }
    } finally {
      setResending(false)
    }
  }

  // Quay lại màn hình đăng nhập
  const handleBackToLogin = () => {
    navigate('/login', { replace: true })
  }

  // Route guard: Nếu truy cập trực tiếp không có token hợp lệ, chuyển về trang đăng nhập
  if (!twoFactorToken) {
    return <Navigate to="/login" replace />
  }

  const isFormDisabled = loading || isExpired || isLocked

  return (
    <div className="bsa2-page">
      <div className="bsa2-card" style={{ maxWidth: 440 }}>
        {/* Họa tiết sóng ECG */}
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

        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: '#e6f7f4',
              color: '#137a6f',
              fontSize: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              boxShadow: '0 4px 12px rgba(19, 122, 111, 0.15)',
            }}
          >
            <SafetyOutlined />
          </div>
          <div className="bsa2-title" style={{ fontSize: 22 }}>
            Xác thực hai lớp
          </div>
          <p className="bsa2-sub" style={{ marginBottom: 4 }}>
            Nhập mã xác thực đã được gửi để hoàn tất đăng nhập.
          </p>
          {rawUsername && (
            <div
              style={{
                fontSize: 13,
                color: '#64748b',
                backgroundColor: '#f1f5f9',
                padding: '3px 12px',
                borderRadius: 16,
                display: 'inline-block',
                marginTop: 4,
              }}
            >
              Tài khoản: <strong>{maskUsername(rawUsername)}</strong>
            </div>
          )}
        </div>

        {/* Thông báo gửi mã xác thực */}
        {SHOW_DEV_HINT ? (
          <Alert
            type="warning"
            showIcon
            icon={<ToolOutlined />}
            message="🔧 Chế độ phát triển (DEV MODE)"
            description="Hệ thống SMS/Email thật chưa được tích hợp. Vui lòng mở cửa sổ terminal đang chạy Backend để xem mã xác thực vừa được sinh ra (tìm dòng '[MOCK 2FA]')."
            style={{ marginBottom: 16, border: '2px dashed #faad14', borderRadius: 8, textAlign: 'left' }}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            message="Mã xác thực 2FA đã được gửi qua SMS"
            description="Vui lòng kiểm tra tin nhắn trên số điện thoại liên kết với tài khoản của bạn để lấy mã OTP gồm 6 chữ số."
            style={{ marginBottom: 16, textAlign: 'left', borderRadius: 8 }}
          />
        )}

        {/* Thông báo lỗi nếu có */}
        {errorMessage && (
          <Alert
            className="bsa2-login-alert"
            type="error"
            showIcon
            message={errorMessage}
            style={{ marginBottom: 16, textAlign: 'left', borderRadius: 8 }}
          />
        )}

        {/* Đồng hồ đếm ngược hiệu lực challenge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 14px',
            backgroundColor: isExpired ? '#fef2f2' : '#f8fafc',
            borderRadius: 8,
            marginBottom: 16,
            border: `1px solid ${isExpired ? '#fecaca' : '#e2e8f0'}`,
            fontSize: 13,
          }}
        >
          <span style={{ color: isExpired ? '#dc2626' : '#64748b' }}>
            {isExpired ? 'Mã xác thực đã hết hạn' : 'Thời gian hiệu lực còn lại:'}
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: isExpired ? '#dc2626' : remainingSeconds <= 60 ? '#f59e0b' : '#0f766e',
            }}
          >
            {formatTimeCountdown(remainingSeconds)}
          </span>
        </div>

        {/* Form nhập mã 6 số */}
        <Form
          layout="vertical"
          onFinish={() => handleVerify(code)}
          style={{ marginTop: 8 }}
        >
          <Form.Item style={{ marginBottom: 18 }}>
            <Input
              ref={inputRef}
              value={code}
              onChange={handleCodeChange}
              placeholder="Nhập 6 chữ số"
              maxLength={6}
              disabled={isFormDisabled}
              style={{
                height: 52,
                fontSize: 26,
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: 10,
                borderRadius: 10,
                border: '2px solid #cbd5e1',
                boxShadow: 'none',
              }}
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          </Form.Item>

          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {/* Nút Xác nhận */}
            <Button
              type="primary"
              htmlType="submit"
              icon={<CheckCircleOutlined />}
              loading={loading}
              disabled={isFormDisabled || code.length !== 6}
              block
              style={{
                height: 44,
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                backgroundColor: '#137a6f',
                borderColor: '#137a6f',
              }}
            >
              Xác nhận đăng nhập
            </Button>

            {/* Nút Gửi lại mã */}
            <Button
              icon={<ReloadOutlined />}
              onClick={handleResend}
              loading={resending}
              disabled={cooldown > 0 || isExpired || isLocked}
              block
              style={{
                height: 42,
                fontSize: 14,
                borderRadius: 8,
              }}
            >
              {cooldown > 0 ? `Gửi lại mã sau (${cooldown}s)` : 'Gửi lại mã xác thực'}
            </Button>

            {/* Nút Quay lại đăng nhập */}
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleBackToLogin}
              block
              style={{
                height: 40,
                fontSize: 14,
                color: '#64748b',
              }}
            >
              Quay lại đăng nhập
            </Button>
          </Space>
        </Form>
      </div>
    </div>
  )
}

export default TwoFactorVerifyPage
