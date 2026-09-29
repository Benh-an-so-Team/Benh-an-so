import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  Form,
  Input,
  Button,
  DatePicker,
  Radio,
  Alert,
  Checkbox,
  message,
} from 'antd'
import {
  PhoneOutlined,
  LockOutlined,
  UserOutlined,
  IdcardOutlined,
  MailOutlined,
  SafetyCertificateFilled,
  ReadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthContext } from '../context/AuthContext'
import PortalCyberBackground from '../components/portal/PortalCyberBackground'
import PortalCyberHeader from '../components/portal/PortalCyberHeader'
import PersonalDataConsentModal from '../components/patient/PersonalDataConsentModal'
import './styles/portalLogin.css'
import './styles/portalRegister.css'

function PortalRegister() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [phoneConflict, setPhoneConflict] = useState(false)
  const [consentModalOpen, setConsentModalOpen] = useState(false)

  const navigate = useNavigate()
  const { patientRegister, isAuthenticated, user } = useAuthContext()

  const userRoles = (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  const isPatient = userRoles.includes('patient')

  if (isAuthenticated && isPatient) {
    return <Navigate to="/portal/dashboard" replace />
  }

  const handleSubmit = async (values) => {
    setLoading(true)
    setServerError('')
    setPhoneConflict(false)

    try {
      const payload = {
        phone: String(values.phone || '').trim(),
        password: values.password,
        fullName: String(values.fullName || '').trim(),
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        gender: values.gender || 'MALE',
        identityNumber: values.identityNumber ? String(values.identityNumber).trim() : null,
        email: values.email ? String(values.email).trim() : null,
        consentAgreed: values.consentAgreed ?? true,
        consentVersion: 'v1.0',
      }

      const result = await patientRegister(payload)

      if (result.success) {
        message.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập để tiếp tục.')
        navigate('/portal/login', { replace: true, state: { phone: payload.phone } })
      } else {
        const status = result.status
        const errorData = result.data
        const errorMsg = result.message || ''

        if (status === 409) {
          if (errorData?.code === 'PHONE_ALREADY_EXISTS' || errorMsg.includes('Số điện thoại') || errorMsg.includes('phone')) {
            setPhoneConflict(true)
            form.setFields([
              {
                name: 'phone',
                errors: ['Số điện thoại này đã được đăng ký tài khoản.'],
              },
            ])
            setServerError('Số điện thoại đã được đăng ký tài khoản. Vui lòng đăng nhập.')
          } else if (errorData?.code === 'EMAIL_ALREADY_EXISTS' || errorMsg.includes('email') || errorMsg.includes('Email')) {
            form.setFields([
              {
                name: 'email',
                errors: ['Email này đã được sử dụng cho tài khoản khác.'],
              },
            ])
            setServerError('Email đã được đăng ký tài khoản trong hệ thống.')
          } else if (errorMsg.includes('identity number') || errorMsg.includes('CCCD') || errorMsg.includes('CMND')) {
            form.setFields([
              {
                name: 'identityNumber',
                errors: ['Số CCCD/CMND này đã được sử dụng trên một hồ sơ bệnh nhân khác.'],
              },
            ])
            setServerError('Số CCCD/CMND này đã tồn tại trong hệ thống.')
          } else {
            setServerError(errorMsg || 'Thông tin đăng ký bị trùng lặp trong hệ thống.')
          }
        } else if (status === 400 || status === 422) {
          const detailedErrors = []
          if (errorData?.details?.fields && typeof errorData.details.fields === 'object') {
            const fieldLabels = {
              phone: 'Số điện thoại',
              password: 'Mật khẩu',
              confirmPassword: 'Xác nhận mật khẩu',
              fullName: 'Họ và tên',
              dateOfBirth: 'Ngày sinh',
              gender: 'Giới tính',
              identityNumber: 'Số CCCD/CMND',
              email: 'Email',
              consentAgreed: 'Xác nhận đồng ý xử lý dữ liệu cá nhân',
            }
            const fieldErrors = []
            Object.entries(errorData.details.fields).forEach(([name, err]) => {
              let msg = String(err || '')
              if (msg === 'Validation failed.' || msg === 'Invalid value.') {
                msg = 'Giá trị không hợp lệ'
              }
              fieldErrors.push({
                name,
                errors: [msg],
              })
              const label = fieldLabels[name] || name
              detailedErrors.push(`${label}: ${msg}`)
            })
            form.setFields(fieldErrors)
          }

          if (detailedErrors.length > 0) {
            setServerError(
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Thông tin đăng ký chưa hợp lệ:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {detailedErrors.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )
          } else {
            let msg = errorMsg
            if (!msg || msg.toLowerCase().includes('validation failed')) {
              msg = 'Dữ liệu đăng ký không hợp lệ. Vui lòng kiểm tra lại các trường thông tin.'
            }
            setServerError(msg)
          }
        } else if (status === 500) {
          setServerError(errorMsg || 'Lỗi xử lý từ máy chủ. Vui lòng thử lại sau.')
        } else if (result.error?.response) {
          setServerError(errorMsg || `Yêu cầu thất bại với mã lỗi HTTP ${status}.`)
        } else {
          setServerError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền mạng hoặc kiểm tra xem máy chủ backend có đang hoạt động hay không.')
        }
      }
    } catch {
      setServerError('Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-cyber-login-page portal-register-page">
      <PortalCyberBackground />

      <PortalCyberHeader activePage="register" hideNav />

      <main>
        <div className="card-wrapper">
          <div className="portal-register-card">
            <div className="portal-register-card-header">
              <span className="portal-register-card-badge">
                <svg className="ic"><use href="#user" /></svg>
                Đăng ký thành viên
              </span>
              <h1 className="portal-register-card-title">Tạo tài khoản Bệnh nhân</h1>
              <p className="portal-register-card-sub">
                Đăng ký tài khoản để theo dõi kết quả khám bệnh, đơn thuốc và hồ sơ y tế cá nhân
              </p>
            </div>

            {serverError && (
              <Alert
                className="portal-register-alert"
                type={phoneConflict ? 'warning' : 'error'}
                showIcon
                message={
                  <div>
                    {serverError}
                    {phoneConflict && (
                      <div style={{ marginTop: 6 }}>
                        <Link to="/portal/login" style={{ fontWeight: 600, color: '#0284c7' }}>
                          👉 Bấm vào đây để chuyển sang màn hình Đăng nhập
                        </Link>
                      </div>
                    )}
                  </div>
                }
              />
            )}

            <Form
              form={form}
              className="portal-register-form"
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ gender: 'MALE' }}
              requiredMark={false}
              scrollToFirstError
            >
              <Form.Item
                label="Họ và tên"
                name="fullName"
                rules={[
                  { required: true, message: 'Vui lòng nhập họ và tên' },
                  { min: 2, message: 'Họ tên quá ngắn' },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  disabled={loading}
                  autoFocus
                />
              </Form.Item>

              <Form.Item
                label="Số điện thoại"
                name="phone"
                rules={[
                  { required: true, message: 'Vui lòng nhập số điện thoại' },
                  {
                    pattern: /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/,
                    message: 'Số điện thoại không đúng định dạng (VD: 0912345678 hoặc +84912345678)',
                  },
                ]}
              >
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="Nhập số điện thoại di động"
                  disabled={loading}
                />
              </Form.Item>

              <Form.Item
                label="Địa chỉ Email (Không bắt buộc)"
                name="email"
                rules={[
                  {
                    type: 'email',
                    message: 'Email không đúng định dạng',
                  },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="Ví dụ: benhnhan@gmail.com"
                  disabled={loading}
                />
              </Form.Item>

              <div className="portal-register-grid-2">
                <Form.Item
                  label="Mật khẩu"
                  name="password"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu' },
                    { min: 6, max: 50, message: 'Mật khẩu phải từ 6 đến 50 ký tự' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Từ 6 đến 50 ký tự"
                    disabled={loading}
                    maxLength={50}
                  />
                </Form.Item>

                <Form.Item
                  label="Xác nhận mật khẩu"
                  name="confirmPassword"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Vui lòng xác nhận lại mật khẩu' },
                    { min: 6, max: 50, message: 'Mật khẩu phải từ 6 đến 50 ký tự' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Nhập lại mật khẩu"
                    disabled={loading}
                    maxLength={50}
                  />
                </Form.Item>
              </div>

              <div className="portal-register-grid-2">
                <Form.Item
                  label="Ngày sinh"
                  name="dateOfBirth"
                  rules={[{ required: true, message: 'Vui lòng chọn ngày sinh' }]}
                >
                  <DatePicker
                    placeholder="DD/MM/YYYY"
                    format="DD/MM/YYYY"
                    disabledDate={(current) => current && current > dayjs().endOf('day')}
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item
                  label="Giới tính"
                  name="gender"
                  rules={[{ required: true, message: 'Vui lòng chọn giới tính' }]}
                >
                  <Radio.Group disabled={loading} style={{ paddingTop: 6 }}>
                    <Radio value="MALE">Nam</Radio>
                    <Radio value="FEMALE">Nữ</Radio>
                    <Radio value="OTHER">Khác</Radio>
                  </Radio.Group>
                </Form.Item>
              </div>

              <Form.Item
                label="Số CCCD / CMND (Không bắt buộc)"
                name="identityNumber"
                rules={[
                  {
                    pattern: /^[0-9]{9}([0-9]{3})?$/,
                    message: 'Số CCCD/CMND phải gồm 9 hoặc 12 chữ số',
                  },
                ]}
                extra={
                  <span className="portal-register-hint">
                    Giúp hệ thống liên kết chính xác hồ sơ khám bệnh có sẵn của bạn (áp dụng khi gia đình dùng chung số điện thoại).
                  </span>
                }
              >
                <Input
                  prefix={<IdcardOutlined />}
                  placeholder="Nhập 9 hoặc 12 số CCCD/CMND (nếu có)"
                  disabled={loading}
                  maxLength={12}
                />
              </Form.Item>

              <div className="portal-register-consent-box">
                <div className="portal-consent-header">
                  <div className="portal-consent-title">
                    <SafetyCertificateFilled className="portal-consent-shield-icon" />
                    <span>Cam kết & Điều khoản bảo mật y tế</span>
                  </div>
                  <button
                    type="button"
                    className="portal-consent-modal-btn"
                    onClick={() => setConsentModalOpen(true)}
                  >
                    <ReadOutlined />
                    Xem chi tiết
                  </button>
                </div>

                <div className="portal-consent-body">
                  <Form.Item
                    name="consentAgreed"
                    valuePropName="checked"
                    initialValue={true}
                    style={{ marginBottom: 0 }}
                    rules={[
                      {
                        validator: (_, value) =>
                          value
                            ? Promise.resolve()
                            : Promise.reject(new Error('Vui lòng đồng ý với điều khoản sử dụng và xử lý dữ liệu cá nhân.')),
                      },
                    ]}
                  >
                    <Checkbox disabled={loading} className="portal-consent-checkbox">
                      <span className="portal-consent-label-text">
                        Tôi đồng ý với{' '}
                        <a
                          role="button"
                          tabIndex={0}
                          className="portal-consent-link"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setConsentModalOpen(true)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              setConsentModalOpen(true)
                            }
                          }}
                        >
                          Quy định và Phiếu đồng ý xử lý dữ liệu cá nhân
                        </a>{' '}
                        (theo Nghị định 13/2023/NĐ-CP). <span className="portal-consent-star">*</span>
                      </span>
                    </Checkbox>
                  </Form.Item>
                </div>
              </div>

              <Form.Item style={{ marginBottom: 8, marginTop: 12 }}>
                <Button
                  className="portal-register-btn"
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                >
                  Đăng ký tài khoản Bệnh nhân
                </Button>
              </Form.Item>
            </Form>

            <div className="portal-register-footer">
              <div className="portal-register-footer-text">
                Đã có tài khoản Bệnh nhân?
                <Link to="/portal/login">Đăng nhập ngay</Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PersonalDataConsentModal
        open={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        patientName={form.getFieldValue('fullName') || ''}
        version="v1.0"
      />
    </div>
  )
}

export default PortalRegister
