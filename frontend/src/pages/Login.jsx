import React, { useState, useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert, message } from 'antd'
import { useAuthContext } from '../context/AuthContext.jsx'
import { getDefaultHomePath } from '../components/layout/navigationConfig.js'
import { popSessionExpiredNotice } from '../utils/sessionManagementHelpers.js'
import './login.css'

const FLOATING_ICONS = [
  { id: 1, name: 'cross', left: '10%', top: '14%', size: 46, depth: 16, duration: '5.2s', delay: '-1.2s', rotate: '14deg', opacity: 0.75 },
  { id: 2, name: 'pill', left: '80%', top: '12%', size: 40, depth: 24, duration: '6.4s', delay: '-3.5s', rotate: '-10deg', opacity: 0.8 },
  { id: 3, name: 'steth', left: '22%', top: '78%', size: 54, depth: 14, duration: '4.8s', delay: '-0.8s', rotate: '12deg', opacity: 0.7 },
  { id: 4, name: 'syringe', left: '86%', top: '66%', size: 38, depth: 30, duration: '7.0s', delay: '-4.2s', rotate: '-14deg', opacity: 0.65 },
  { id: 5, name: 'heart', left: '6%', top: '48%', size: 48, depth: 18, duration: '5.6s', delay: '-2.1s', rotate: '8deg', opacity: 0.85 },
  { id: 6, name: 'dna', left: '58%', top: '20%', size: 44, depth: 26, duration: '6.2s', delay: '-4.8s', rotate: '-8deg', opacity: 0.7 },
  { id: 7, name: 'thermo', left: '40%', top: '82%', size: 42, depth: 15, duration: '4.6s', delay: '-1.5s', rotate: '16deg', opacity: 0.6 },
  { id: 8, name: 'hospital', left: '72%', top: '82%', size: 50, depth: 22, duration: '5.8s', delay: '-3.2s', rotate: '-12deg', opacity: 0.75 },
  { id: 9, name: 'pill', left: '16%', top: '88%', size: 36, depth: 12, duration: '4.2s', delay: '-2.0s', rotate: '10deg', opacity: 0.65 },
  { id: 10, name: 'heart', left: '90%', top: '38%', size: 44, depth: 28, duration: '6.8s', delay: '-4.5s', rotate: '-15deg', opacity: 0.8 },
  { id: 11, name: 'cross', left: '34%', top: '10%', size: 38, depth: 14, duration: '5.0s', delay: '-0.6s', rotate: '6deg', opacity: 0.7 },
  { id: 12, name: 'steth', left: '4%', top: '26%', size: 52, depth: 25, duration: '6.1s', delay: '-2.8s', rotate: '-11deg', opacity: 0.75 },
  { id: 13, name: 'syringe', left: '48%', top: '68%', size: 40, depth: 19, duration: '5.5s', delay: '-1.7s', rotate: '13deg', opacity: 0.65 },
  { id: 14, name: 'dna', left: '28%', top: '40%', size: 46, depth: 23, duration: '5.9s', delay: '-3.1s', rotate: '-7deg', opacity: 0.7 },
  { id: 15, name: 'thermo', left: '66%', top: '50%', size: 38, depth: 17, duration: '4.9s', delay: '-0.9s', rotate: '11deg', opacity: 0.7 },
  { id: 16, name: 'hospital', left: '46%', top: '16%', size: 44, depth: 20, duration: '6.0s', delay: '-4.0s', rotate: '-14deg', opacity: 0.75 },
]

function Login() {
  const [loading, setLoading] = useState(false)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [isSuccessOn, setIsSuccessOn] = useState(false)
  const [successGreeting, setSuccessGreeting] = useState('Xin chào')
  const [overlayCoords, setOverlayCoords] = useState({ x: '50%', y: '50%' })

  const stageRef = useRef(null)
  const submitBtnRef = useRef(null)
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

  // Parallax effect on mouse move in stage
  const handleStageMouseMove = (e) => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const stage = stageRef.current
    if (!stage) return
    const r = stage.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    stage.querySelectorAll('[data-depth]').forEach((el) => {
      const depth = parseFloat(el.getAttribute('data-depth') || '0')
      el.style.transform = `translate(${-x * depth}px, ${-y * depth}px)`
    })
  }

  if (isAuthenticated && user) {
    const userRoles = (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
    if (userRoles.includes('patient')) {
      return <Navigate to="/portal/dashboard" replace />
    }
    return <Navigate to={getDefaultHomePath(user?.roles, user?.permissions)} replace />
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (lockoutSeconds > 0) {
      return
    }

    if (!username.trim() || !password) {
      setErrorMessage('Nhập tên đăng nhập và mật khẩu để tiếp tục.')
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 450)
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const result = await login({ username: username.trim(), password })
      if (result.success) {
        if (result.twoFactorRequired) {
          navigate('/login/verify-2fa', {
            state: {
              twoFactorToken: result.twoFactorToken,
              twoFactorExpiresAt: result.twoFactorExpiresAt,
              username: username.trim(),
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
          navigate('/portal/login', { replace: true, state: { phone: username.trim() } })
          return
        }

        // Radial wipe animation coordinates from submit button
        if (submitBtnRef.current) {
          const r = submitBtnRef.current.getBoundingClientRect()
          setOverlayCoords({
            x: `${r.left + r.width / 2}px`,
            y: `${r.top + r.height / 2}px`,
          })
        }

        const displayName = targetUser?.fullName || targetUser?.name || username.trim()
        setSuccessGreeting(`Xin chào, ${displayName}`)
        setIsSuccessOn(true)

        const destination = getDefaultHomePath(targetUser?.roles, targetUser?.permissions)
        setTimeout(() => {
          navigate(destination, { replace: true })
        }, 1600)
      } else {
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 450)

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
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 450)
      const msg = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại.'
      setErrorMessage(msg)
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bsa-login-page">
      {/* SVG Symbols Library */}
      <svg width="0" height="0" style={{ position: 'absolute', display: 'none' }} aria-hidden="true">
        <symbol id="cross" viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></symbol>
        <symbol id="pill" viewBox="0 0 24 24"><path d="M10.5 20.5a5 5 0 01-7-7l10-10a5 5 0 017 7z"/><path d="M8.5 8.5l7 7"/></symbol>
        <symbol id="steth" viewBox="0 0 24 24"><path d="M5 3v6a4 4 0 008 0V3M9 13v2a5 5 0 0010 0v-1"/><circle cx="19" cy="12" r="2"/></symbol>
        <symbol id="syringe" viewBox="0 0 24 24"><path d="M17 3l4 4M19 5l-3 3M14 6l4 4-8 8-4-4zM9 15l-2-2M6 18l-3 3"/></symbol>
        <symbol id="heart" viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4.5 4.5 0 018-3 4.5 4.5 0 018 3c0 6-8 11-8 11z"/><path d="M7 12h3l1.5-3 2 6 1.5-3h2"/></symbol>
        <symbol id="dna" viewBox="0 0 24 24"><path d="M7 3c0 6 10 12 10 18M17 3c0 6-10 12-10 18M8 7h8M8 17h8M6.5 12h11"/></symbol>
        <symbol id="thermo" viewBox="0 0 24 24"><path d="M14 14.5V5a2 2 0 00-4 0v9.5a4 4 0 104 0z"/><path d="M12 9v7"/></symbol>
        <symbol id="hospital" viewBox="0 0 24 24"><path d="M4 21V7l8-4 8 4v14zM10 21v-5h4v5M12 8v4M10 10h4"/></symbol>
        <symbol id="user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></symbol>
        <symbol id="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></symbol>
        <symbol id="eye" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
        <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></symbol>
        <symbol id="pulse" viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></symbol>
      </svg>

      {/* Sân khấu bên trái */}
      <section className="stage" id="stage" ref={stageRef} onMouseMove={handleStageMouseMove}>
        <div className="brand">
          <i>
            <svg className="ic" style={{ color: '#fff' }}><use href="#pulse"/></svg>
          </i>
          Bệnh Án Số
        </div>

        <div className="radar" data-depth="14" aria-hidden="true">
          <span className="ring"></span>
          <span className="ring"></span>
          <span className="ring"></span>
          <div className="core">
            <svg className="ic"><use href="#heart"/></svg>
          </div>
        </div>

        {/* Floating medical icons with depth and animation */}
        {FLOATING_ICONS.map((icon) => (
          <div
            key={icon.id}
            className="fl"
            data-depth={icon.depth}
            style={{
              left: icon.left,
              top: icon.top,
              width: `${icon.size}px`,
              '--d': icon.duration,
              '--dl': icon.delay,
              '--r': icon.rotate,
              opacity: icon.opacity,
            }}
          >
            <span>
              <svg className="ic"><use href={`#${icon.name}`}/></svg>
            </span>
          </div>
        ))}

        <div className="headline">
          <h1>Hồ sơ người bệnh, đầy đủ và an toàn trong một nơi.</h1>
          <p>Xem tiền sử, kê đơn và theo dõi điều trị theo thời gian thực. Mỗi thay đổi đều được ghi lại rõ ràng.</p>
        </div>

        <div className="ecg">
          <svg viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-label="Đường điện tim đang chạy">
            <path id="p" className="base" d="M0 60H70l8-8 8 8H130l8 10 10-52 12 74 8-32H230l14-14 16 14H340l8 10 10-52 12 74 8-32H440l14-14 16 14H600"/>
            <path className="live" pathLength="1" vectorEffect="non-scaling-stroke" d="M0 60H70l8-8 8 8H130l8 10 10-52 12 74 8-32H230l14-14 16 14H340l8 10 10-52 12 74 8-32H440l14-14 16 14H600"/>
            <circle r="5" fill="#ff6b4a">
              <animateMotion dur="4.8s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.85;1" calcMode="linear">
                <mpath href="#p"/>
              </animateMotion>
              <animate attributeName="opacity" values="1;1;0" keyTimes="0;.85;1" dur="4.8s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
      </section>

      {/* Form đăng nhập bên phải */}
      <main className="login">
        <div className={`card ${isShaking ? 'shake' : ''}`} id="card">
          <h2>Đăng nhập</h2>

          {sessionExpiredNotice && (
            <Alert
              type="warning"
              showIcon
              message={sessionExpiredNotice}
              closable
              onClose={() => setSessionExpiredNotice('')}
              style={{ marginBottom: 16, borderRadius: 12, textAlign: 'left' }}
            />
          )}

          <form id="f" noValidate onSubmit={handleSubmit}>
            <div className="field">
              <svg className="ic"><use href="#user"/></svg>
              <input
                id="u"
                placeholder="Tên đăng nhập"
                autoComplete="username"
                aria-label="Tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || lockoutSeconds > 0}
              />
            </div>

            <div className="field">
              <svg className="ic"><use href="#lock"/></svg>
              <input
                id="pw"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mật khẩu"
                autoComplete="current-password"
                aria-label="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || lockoutSeconds > 0}
              />
              <button
                className="eye"
                type="button"
                id="eye"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                <svg className="ic"><use href="#eye"/></svg>
              </button>
            </div>

            <p className="msg" id="msg" role="alert">
              {lockoutSeconds > 0
                ? `Tài khoản tạm khóa. Vui lòng thử lại sau ${lockoutSeconds} giây.`
                : errorMessage}
            </p>

            <button
              ref={submitBtnRef}
              className={`btn ${loading ? 'loading' : ''}`}
              id="go"
              type="submit"
              disabled={lockoutSeconds > 0}
            >
              <span className="lbl">
                {lockoutSeconds > 0 ? `Vui lòng thử lại sau (${lockoutSeconds}s)` : 'Đăng nhập'}
              </span>
              <span className="spin"></span>
            </button>
          </form>

          <div className="or">Dành cho bệnh nhân</div>

          <Link className="alt pri" to="/portal/login">
            <svg className="ic"><use href="#user"/></svg>
            Đăng nhập Cổng bệnh nhân
          </Link>

          <Link className="alt" to="/public-lookup">
            <svg className="ic"><use href="#search"/></svg>
            Tra cứu lịch hẹn
          </Link>
        </div>
      </main>

      {/* Hiệu ứng đăng nhập thành công */}
      <div
        className={`ok ${isSuccessOn ? 'on' : ''}`}
        id="ok"
        style={{
          '--x': overlayCoords.x,
          '--y': overlayCoords.y,
        }}
        aria-live="polite"
      >
        <div className="box">
          <div className="badge">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54"/>
              <path d="M36 62l16 16 32-34"/>
            </svg>
          </div>
          <h3 id="hello">{successGreeting}</h3>
          <p>Đang mở hồ sơ bệnh án của bạn…</p>
          <div className="bar"><i></i></div>
          <button className="back" id="back" type="button" onClick={() => setIsSuccessOn(false)}>
            Quay lại (demo)
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
