import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button, message } from 'antd'
import { ClockCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '../../context/AuthContext.jsx'
import sessionApi from '../../api/sessionApi.js'
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  COUNTDOWN_WARNING_SECONDS,
  SESSION_IDLE_CONFIG_KEY,
  setSessionExpiredNotice,
} from '../../utils/sessionManagementHelpers.js'
import './sessionTimeout.css'

export default function SessionTimeoutWarningModal() {
  const { user, logout, isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()

  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_IDLE_CONFIG_KEY)
      if (saved && !isNaN(Number(saved))) {
        return Math.max(5, Number(saved))
      }
    } catch {
      // ignore storage error
    }
    return DEFAULT_IDLE_TIMEOUT_MINUTES
  })

  const [isWarningOpen, setIsWarningOpen] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(COUNTDOWN_WARNING_SECONDS)
  const [extending, setExtending] = useState(false)

  const lastActiveRef = useRef(Date.now())
  const isWarningOpenRef = useRef(false)
  isWarningOpenRef.current = isWarningOpen

  // Fetch configured timeout from backend when user is logged in
  useEffect(() => {
    if (!isAuthenticated) return

    let isMounted = true
    sessionApi
      .getClinicConfiguration()
      .then((res) => {
        if (!isMounted) return
        const minutes = res.data?.sessionIdleTimeoutMinutes
        if (minutes && !isNaN(Number(minutes))) {
          const validMin = Math.max(5, Number(minutes))
          setIdleTimeoutMinutes(validMin)
          localStorage.setItem(SESSION_IDLE_CONFIG_KEY, String(validMin))
        }
      })
      .catch(() => {
        // Fallback to default or cached timeout if user lacks CLINIC_CONFIGURATION_READ
      })

    const handleConfigUpdated = (e) => {
      const minutes = e.detail?.sessionIdleTimeoutMinutes
      if (minutes && !isNaN(Number(minutes))) {
        const validMin = Math.max(5, Number(minutes))
        setIdleTimeoutMinutes(validMin)
        localStorage.setItem(SESSION_IDLE_CONFIG_KEY, String(validMin))
      }
    }

    window.addEventListener('clinic-config:updated', handleConfigUpdated)
    return () => {
      isMounted = false
      window.removeEventListener('clinic-config:updated', handleConfigUpdated)
    }
  }, [isAuthenticated])

  // Perform auto-logout when countdown finishes
  const handleAutoLogout = useCallback(() => {
    setIsWarningOpen(false)
    setSessionExpiredNotice('Phiên làm việc đã hết hạn do không có thao tác, vui lòng đăng nhập lại')
    logout()

    const isPortal = location.pathname.startsWith('/portal')
    if (isPortal) {
      navigate('/portal/login', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [logout, location.pathname, navigate])

  // Extend current session action
  const handleExtendSession = async () => {
    setExtending(true)
    try {
      await sessionApi.extendCurrentSession()
      lastActiveRef.current = Date.now()
      setIsWarningOpen(false)
      setRemainingSeconds(COUNTDOWN_WARNING_SECONDS)
      message.success('Phiên làm việc đã được gia hạn thành công.')
    } catch (error) {
      const status = error.response?.status
      if (status === 400 || status === 401) {
        setIsWarningOpen(false)
        setSessionExpiredNotice('Phiên làm việc đã bị kết thúc hoặc không hợp lệ, vui lòng đăng nhập lại')
        logout()
        navigate('/login', { replace: true })
      } else {
        // In case of transient network issue, still reset local timer to avoid abrupt kick
        lastActiveRef.current = Date.now()
        setIsWarningOpen(false)
        message.warning('Không thể kết nối máy chủ để gia hạn, vui lòng kiểm tra mạng.')
      }
    } finally {
      setExtending(false)
    }
  }

  // Activity listeners to reset idle timer silently when warning is NOT yet open
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsWarningOpen(false)
      return undefined
    }

    const handleUserActivity = () => {
      // Only reset timer silently if the warning dialog is not currently showing
      if (!isWarningOpenRef.current) {
        lastActiveRef.current = Date.now()
      }
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    activityEvents.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }))

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity))
    }
  }, [isAuthenticated, user])

  // Heartbeat timer checking elapsed idle time
  useEffect(() => {
    if (!isAuthenticated || !user) return undefined

    lastActiveRef.current = Date.now()

    const checkInterval = setInterval(() => {
      const now = Date.now()
      const idleElapsedSeconds = (now - lastActiveRef.current) / 1000
      const totalTimeoutSeconds = idleTimeoutMinutes * 60
      const warningThresholdSeconds = Math.max(10, totalTimeoutSeconds - COUNTDOWN_WARNING_SECONDS)

      if (idleElapsedSeconds >= totalTimeoutSeconds) {
        // Time is up!
        clearInterval(checkInterval)
        handleAutoLogout()
      } else if (idleElapsedSeconds >= warningThresholdSeconds) {
        // Show countdown dialog
        const remaining = Math.max(0, Math.ceil(totalTimeoutSeconds - idleElapsedSeconds))
        setRemainingSeconds(remaining)
        if (!isWarningOpenRef.current) {
          setIsWarningOpen(true)
        }
      } else {
        // Within normal active window
        if (isWarningOpenRef.current) {
          setIsWarningOpen(false)
        }
      }
    }, 1000)

    return () => clearInterval(checkInterval)
  }, [isAuthenticated, user, idleTimeoutMinutes, handleAutoLogout])

  if (!isAuthenticated || !isWarningOpen) {
    return null
  }

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / COUNTDOWN_WARNING_SECONDS) * 100))
  const isUrgent = remainingSeconds <= 15

  return (
    <div className="bsa-session-warning-overlay" role="dialog" aria-modal="true">
      <div className="bsa-session-warning-card">
        <div className="bsa-session-warning-accent" />

        <div className="bsa-session-icon-wrap">
          <ClockCircleOutlined />
        </div>

        <h3 className="bsa-session-title">Cảnh báo hết hạn phiên làm việc</h3>

        <p className="bsa-session-desc">
          Hệ thống phát hiện máy trạm không có thao tác trong thời gian quy định. Để đảm bảo an toàn dữ liệu bệnh án,
          phiên làm việc sẽ tự động kết thúc nếu không có phản hồi.
        </p>

        <div className="bsa-session-countdown-box">
          <span className="bsa-session-countdown-label">Tự động đăng xuất sau</span>
          <span className={`bsa-session-countdown-digits ${isUrgent ? 'is-urgent' : ''}`}>
            {formatCountdown(remainingSeconds)}
          </span>
          <div className="bsa-session-progress-bar-wrap">
            <div className="bsa-session-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <Button
          type="primary"
          className="bsa-session-btn-extend"
          icon={<ThunderboltOutlined />}
          loading={extending}
          onClick={handleExtendSession}
          id="btn-extend-session"
        >
          Tiếp tục làm việc
        </Button>

        <p className="bsa-session-notice-hint">
          Bấm nút trên để ngay lập tức gia hạn phiên mà không cần đăng nhập lại.
        </p>
      </div>
    </div>
  )
}
