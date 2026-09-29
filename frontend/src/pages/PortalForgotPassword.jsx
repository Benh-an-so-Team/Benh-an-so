import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Form,
  Input,
  Button,
  Alert,
  Steps,
  Result,
  message,
} from 'antd'
import {
  PhoneOutlined,
  LockOutlined,
  KeyOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import authApi, { parseRetryAfterSeconds } from '../api/authApi'
import PortalCyberBackground from '../components/portal/PortalCyberBackground'
import PortalCyberHeader from '../components/portal/PortalCyberHeader'
import './styles/portalLogin.css'
import './portalForgotPassword.css'

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 3)
}

function PortalForgotPassword() {
  const [currentStep, setCurrentStep] = useState(0) // 0: Phone, 1: OTP & New Password, 2: Done
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  const [phoneForm] = Form.useForm()
  const [resetForm] = Form.useForm()
  const navigate = useNavigate()

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds])

  // Step 1: Yêu cầu gửi mã OTP
  const handleRequestOtp = async (values) => {
    if (cooldownSeconds > 0) return

    setLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    const inputPhone = String(values.phone || '').trim()

    try {
      const response = await authApi.patientForgotPassword(inputPhone)
      const data = response.data

      setPhone(inputPhone)
      setCooldownSeconds(60) // Cooldown 60s
      setInfoMessage(
        data?.message ||
          'Nếu số điện thoại đã được đăng ký tài khoản bệnh nhân, mã xác thực sẽ được gửi tới số điện thoại của bạn.'
      )
      message.success('Đã gửi yêu cầu mã xác thực!')
      setCurrentStep(1)
    } catch (error) {
      const status = error.response?.status
      const errorData = error.response?.data
      if (status === 429 || errorData?.code === 'VERIFICATION_CODE_COOLDOWN') {
        const retryAfter = parseRetryAfterSeconds(error) || 60
        setCooldownSeconds(retryAfter)
        setErrorMessage(`Yêu cầu gửi mã quá nhanh. Vui lòng thử lại sau ${retryAfter} giây.`)
      } else {
        setErrorMessage(
          errorData?.message || error.message || 'Không thể gửi yêu cầu xác thực. Vui lòng thử lại.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  // Gửi lại mã OTP từ bước 2
  const handleResendOtp = async () => {
    if (cooldownSeconds > 0 || !phone) return

    setLoading(true)
    setErrorMessage('')
    try {
      const response = await authApi.patientForgotPassword(phone)
      setCooldownSeconds(60)
      message.success('Đã gửi lại mã xác thực tới số điện thoại của bạn!')
      setInfoMessage(
        response.data?.message || 'Mã xác thực mới đã được gửi tới số điện thoại của bạn.'
      )
    } catch (error) {
      const status = error.response?.status
      const errorData = error.response?.data
      if (status === 429 || errorData?.code === 'VERIFICATION_CODE_COOLDOWN') {
        const retryAfter = parseRetryAfterSeconds(error) || 60
        setCooldownSeconds(retryAfter)
        setErrorMessage(`Vui lòng đợi ${retryAfter} giây trước khi gửi lại mã.`)
      } else {
        setErrorMessage(errorData?.message || 'Không thể gửi lại mã xác thực.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Nhập OTP & Đặt lại mật khẩu
  const handleResetPassword = async (values) => {
    setLoading(true)
    setErrorMessage('')

    try {
      const payload = {
        phone: phone,
        code: String(values.code || '').trim(),
        newPassword: values.newPassword,
      }

      await authApi.patientResetPassword(payload)
      message.success('Đặt lại mật khẩu thành công!')
      setCurrentStep(2)
    } catch (error) {
      const errorData = error.response?.data
      const code = errorData?.code
      if (code === 'INVALID_VERIFICATION_CODE') {
        setErrorMessage(
          errorData?.message || 'Mã xác thực không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.'
        )
      } else if (code === 'VERIFICATION_CODE_EXPIRED') {
        setErrorMessage('Mã xác thực đã hết hạn (sau 5 phút). Vui lòng yêu cầu mã mới.')
      } else if (code === 'SAME_PASSWORD') {
        setErrorMessage('Mật khẩu mới không được trùng với mật khẩu cũ. Vui lòng chọn mật khẩu khác.')
      } else if (code === 'WEAK_PASSWORD') {
        setErrorMessage(
          errorData?.message ||
            'Mật khẩu mới không đủ mạnh (cần ít nhất 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 chữ số).'
        )
      } else {
        setErrorMessage(
          errorData?.message || error.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-cyber-login-page portal-forgot-page">
      <PortalCyberBackground />

      <PortalCyberHeader activePage="forgot-password" hideNav />

      <main>
        <div className="card-wrapper">
          <div className="portal-forgot-card">
            <div className="portal-forgot-card-header">
              <span className="portal-forgot-badge">
                <svg className="ic"><use href="#shield" /></svg>
                Bảo mật tài khoản
              </span>
              <h1 className="portal-forgot-title">Khôi phục mật khẩu</h1>
              <p className="portal-forgot-sub">
                Xác thực qua tin nhắn SMS OTP để thiết lập lại mật khẩu mới
              </p>
            </div>

            <Steps
              className="portal-forgot-steps"
              size="small"
              current={currentStep}
              items={[
                { title: 'Nhập SĐT' },
                { title: 'Xác thực & Mật khẩu' },
                { title: 'Hoàn tất' },
              ]}
            />

            {errorMessage && (
              <Alert
                className="portal-forgot-alert"
                type="error"
                showIcon
                message={errorMessage}
              />
            )}

            {infoMessage && currentStep === 1 && (
              <Alert
                className="portal-forgot-alert"
                type="info"
                showIcon
                message={infoMessage}
                closable
                onClose={() => setInfoMessage('')}
              />
            )}

            {/* BƯỚC 1: NHẬP SỐ ĐIỆN THOẠI */}
            {currentStep === 0 && (
              <Form
                form={phoneForm}
                className="portal-forgot-form"
                layout="vertical"
                onFinish={handleRequestOtp}
                requiredMark={false}
              >
                <Form.Item
                  label="Số điện thoại đã đăng ký"
                  name="phone"
                  rules={[
                    { required: true, message: 'Vui lòng nhập số điện thoại' },
                    {
                      pattern: /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/,
                      message: 'Số điện thoại không đúng định dạng di động Việt Nam (VD: 0912345678)',
                    },
                  ]}
                >
                  <Input
                    prefix={<PhoneOutlined />}
                    placeholder="Nhập số điện thoại (VD: 0912345678)"
                    disabled={loading}
                    autoFocus
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 8, marginTop: 16 }}>
                  <Button
                    className="portal-forgot-btn-submit"
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    disabled={cooldownSeconds > 0}
                    block
                  >
                    {cooldownSeconds > 0
                      ? `Vui lòng đợi (${cooldownSeconds}s)`
                      : 'Gửi mã xác thực qua SMS'}
                  </Button>
                </Form.Item>
              </Form>
            )}

            {/* BƯỚC 2: NHẬP OTP VÀ MẬT KHẨU MỚI */}
            {currentStep === 1 && (
              <div>
                <div className="portal-forgot-phone-preview">
                  <span>Số điện thoại nhận mã:</span>
                  <strong>{maskPhone(phone)}</strong>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setCurrentStep(0)
                      setErrorMessage('')
                    }}
                    style={{ padding: 0 }}
                  >
                    Đổi số khác
                  </Button>
                </div>

                <Form
                  form={resetForm}
                  className="portal-forgot-form"
                  layout="vertical"
                  onFinish={handleResetPassword}
                  requiredMark={false}
                >
                  <Form.Item
                    label="Mã xác thực OTP (6 chữ số)"
                    name="code"
                    rules={[
                      { required: true, message: 'Vui lòng nhập mã xác thực OTP' },
                      { pattern: /^[0-9]{6}$/, message: 'Mã xác thực gồm đúng 6 chữ số' },
                    ]}
                  >
                    <Input
                      prefix={<KeyOutlined />}
                      placeholder="Nhập 6 chữ số OTP từ SMS"
                      maxLength={6}
                      disabled={loading}
                      autoFocus
                    />
                  </Form.Item>

                  <div className="portal-forgot-resend-row">
                    <span>Chưa nhận được tin nhắn?</span>
                    <Button
                      type="link"
                      size="small"
                      onClick={handleResendOtp}
                      disabled={cooldownSeconds > 0 || loading}
                      style={{ padding: 0 }}
                    >
                      {cooldownSeconds > 0
                        ? `Gửi lại mã sau ${cooldownSeconds}s`
                        : 'Gửi lại mã OTP'}
                    </Button>
                  </div>

                  <div className="portal-forgot-password-rules">
                    <strong>Chính sách mật khẩu an toàn:</strong>
                    <div>• Độ dài từ 8 đến 50 ký tự</div>
                    <div>• Chứa ít nhất 1 chữ in hoa (A-Z)</div>
                    <div>• Chứa ít nhất 1 chữ thường (a-z)</div>
                    <div>• Chứa ít nhất 1 chữ số (0-9)</div>
                  </div>

                  <Form.Item
                    label="Mật khẩu mới"
                    name="newPassword"
                    rules={[
                      { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                      { min: 8, message: 'Mật khẩu phải có tối thiểu 8 ký tự' },
                      { max: 50, message: 'Mật khẩu không được quá 50 ký tự' },
                      {
                        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                        message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
                      },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="Nhập mật khẩu mới an toàn"
                      disabled={loading}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Xác nhận mật khẩu mới"
                    name="confirmPassword"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true, message: 'Vui lòng nhập lại mật khẩu mới' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) {
                            return Promise.resolve()
                          }
                          return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="Nhập lại mật khẩu mới"
                      disabled={loading}
                    />
                  </Form.Item>

                  <Form.Item style={{ marginBottom: 8, marginTop: 16 }}>
                    <Button
                      className="portal-forgot-btn-submit"
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                    >
                      Xác nhận đặt lại mật khẩu
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            )}

            {/* BƯỚC 3: THÀNH CÔNG */}
            {currentStep === 2 && (
              <Result
                status="success"
                title="Đặt lại mật khẩu thành công!"
                subTitle="Mật khẩu của bạn đã được cập nhật an toàn. Toàn bộ phiên đăng nhập cũ đã được thu hồi bảo mật. Vui lòng đăng nhập lại bằng mật khẩu mới."
                extra={[
                  <Button
                    key="login"
                    type="primary"
                    className="portal-forgot-btn-submit"
                    onClick={() => navigate('/portal/login', { replace: true, state: { phone } })}
                    block
                  >
                    Đăng nhập Cổng bệnh nhân ngay
                  </Button>,
                ]}
              />
            )}

            {currentStep !== 2 && (
              <div className="portal-forgot-footer">
                <div className="portal-forgot-footer-text">
                  <Link to="/portal/login">
                    <ArrowLeftOutlined /> Quay lại trang Đăng nhập
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default PortalForgotPassword
