/**
 * NoticeCard.jsx
 * Thẻ thông báo góc dưới bên phải - Chuẩn hóa UI phòng khám tư nhân.
 * Hỗ trợ 4 mức độ: Lỗi, Cảnh báo thường, Cảnh báo nghiêm trọng, Thành công/Thông tin.
 * Đầy đủ tính năng: Tạm dừng khi rê chuột, phím Esc để đóng, đếm lặp "×3", nút hành động.
 */

import React, { useState } from 'react'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  InfoCircleFilled,
  WarningFilled,
  AlertFilled,
  CloseOutlined,
} from '@ant-design/icons'
import { NOTICE_LEVELS } from './NoticeService.js'

export default function NoticeCard({ notice, onDismiss, onPause, onResume }) {
  const [isHovered, setIsHovered] = useState(false)
  const {
    id,
    level = NOTICE_LEVELS.INFO,
    title,
    message,
    action,
    count = 1,
    referenceCode,
    duration = 0,
    persistent = false,
    countdownSeconds,
  } = notice

  const isAlertRole = level === NOTICE_LEVELS.ERROR || level === NOTICE_LEVELS.CRITICAL
  const role = isAlertRole ? 'alert' : 'status'
  const ariaLive = isAlertRole ? 'assertive' : 'polite'

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (onPause) onPause(id)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (onResume) onResume(id)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onDismiss(id)
    }
  }

  // Icon theo từng mức độ
  const renderIcon = () => {
    switch (level) {
      case NOTICE_LEVELS.CRITICAL:
        return (
          <div className="notice-icon-wrapper notice-icon-critical" aria-hidden="true">
            <WarningFilled className="notice-icon-pulse" />
          </div>
        )
      case NOTICE_LEVELS.ERROR:
        return (
          <div className="notice-icon-wrapper notice-icon-error" aria-hidden="true">
            <CloseCircleFilled />
          </div>
        )
      case NOTICE_LEVELS.WARNING:
        return (
          <div className="notice-icon-wrapper notice-icon-warning" aria-hidden="true">
            <AlertFilled />
          </div>
        )
      case NOTICE_LEVELS.SUCCESS:
        return (
          <div className="notice-icon-wrapper notice-icon-success" aria-hidden="true">
            <CheckCircleFilled />
          </div>
        )
      case NOTICE_LEVELS.INFO:
      default:
        return (
          <div className="notice-icon-wrapper notice-icon-info" aria-hidden="true">
            <InfoCircleFilled />
          </div>
        )
    }
  }

  return (
    <div
      id={`notice-card-${id}`}
      className={`notice-card notice-card-${level} ${isHovered ? 'notice-card-hovered' : ''}`}
      role={role}
      aria-live={ariaLive}
      tabIndex={0}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      data-testid="notice-card"
      data-level={level}
    >
      <div className="notice-card-content">
        {renderIcon()}

        <div className="notice-text-body">
          <div className="notice-header-row">
            <span className="notice-title">
              {title}
              {count > 1 && (
                <span className="notice-repeat-badge" title={`Xuất hiện ${count} lần`}>
                  ×{count}
                </span>
              )}
            </span>

            {countdownSeconds !== undefined && countdownSeconds > 0 && (
              <span className="notice-countdown-pill" title="Thời gian còn lại">
                {countdownSeconds}s
              </span>
            )}
          </div>

          {message && <div className="notice-message">{message}</div>}

          {referenceCode && (
            <div className="notice-ref-code">
              Mã tham chiếu: <code>{referenceCode}</code>
            </div>
          )}

          {action && (
            <div className="notice-action-row">
              <button
                type="button"
                className={`notice-action-btn ${action.primary ? 'notice-action-btn-primary' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (typeof action.onClick === 'function') {
                    action.onClick()
                  }
                }}
              >
                {action.label}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="notice-close-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss(id)
          }}
          aria-label="Đóng thông báo"
          title="Đóng thông báo (Esc)"
        >
          <CloseOutlined />
        </button>
      </div>

      {/* Thanh tiến trình thời gian tự tắt (pause khi hover) */}
      {!persistent && duration > 0 && (
        <div className="notice-progress-container" aria-hidden="true">
          <div
            className={`notice-progress-bar notice-progress-bar-${level} ${isHovered ? 'notice-progress-paused' : ''}`}
            style={{
              animationDuration: `${duration}ms`,
            }}
          />
        </div>
      )}
    </div>
  )
}
