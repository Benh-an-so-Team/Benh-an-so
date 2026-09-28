/**
 * ClinicHeaderNotificationBell.jsx
 * Chuông thông báo ở thanh Header cho nhân viên y tế (Quản trị viên, Dược sĩ, Bác sĩ, v.v.).
 * Lưu trữ các cảnh báo quan trọng: Sao lưu thất bại, Tồn kho thấp, Thuốc gần hết hạn, An toàn lâm sàng.
 * Tích hợp chặt chẽ với NoticeBellStore.
 */

import React, { useState, useEffect } from 'react'
import { Badge, Popover, Empty } from 'antd'
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  CloudServerOutlined,
  ShopOutlined,
  MedicineBoxOutlined,
  AlertOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import noticeBellStore from '../../utils/NoticeBellStore.js'
import './clinicHeaderBell.css'

export default function ClinicHeaderNotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState(() => noticeBellStore.getBellNotifications())
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = noticeBellStore.subscribe((list) => {
      setNotifications(list)
    })
    return () => unsub()
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length
  const displayedItems = filterUnreadOnly ? notifications.filter((n) => !n.read) : notifications

  const handleMarkAsRead = (id, e) => {
    if (e) e.stopPropagation()
    noticeBellStore.markAsRead(id)
  }

  const handleMarkAllRead = () => {
    noticeBellStore.markAllAsRead()
  }

  const handleClearAll = () => {
    noticeBellStore.clearBellNotifications()
  }

  const handleItemClick = (item) => {
    noticeBellStore.markAsRead(item.id)
    setOpen(false)

    if (item.actionUrl) {
      navigate(item.actionUrl)
      return
    }

    // Tự động chuyển trang phù hợp với nhóm cảnh báo
    switch (item.category) {
      case 'BACKUP':
        navigate('/system/scheduled-backup')
        break
      case 'INVENTORY':
        navigate('/inventory/stock-report')
        break
      case 'MEDICINE':
        navigate('/medicines')
        break
      case 'CLINICAL':
        navigate('/prescriptions')
        break
      default:
        break
    }
  }

  const renderCategoryIcon = (category) => {
    switch (category) {
      case 'BACKUP':
        return <CloudServerOutlined style={{ color: '#2563eb' }} />
      case 'INVENTORY':
        return <ShopOutlined style={{ color: '#d97706' }} />
      case 'MEDICINE':
        return <MedicineBoxOutlined style={{ color: '#dc2626' }} />
      case 'CLINICAL':
        return <AlertOutlined style={{ color: '#b91c1c' }} />
      default:
        return <BellOutlined style={{ color: '#64748b' }} />
    }
  }

  const formatCategoryName = (category) => {
    switch (category) {
      case 'BACKUP':
        return 'Sao lưu dữ liệu'
      case 'INVENTORY':
        return 'Kho dược'
      case 'MEDICINE':
        return 'Hạn dùng thuốc'
      case 'CLINICAL':
        return 'An toàn lâm sàng'
      default:
        return 'Hệ thống'
    }
  }

  const formatTime = (isoString) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return 'Vừa xong'
      if (diffMins < 60) return `${diffMins} phút trước`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours} giờ trước`
      return date.toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const popoverContent = (
    <div className="clinic-bell-popover">
      <div className="clinic-bell-header">
        <div className="clinic-bell-title-wrap">
          <span className="clinic-bell-title">Cảnh báo & Thông báo</span>
          {unreadCount > 0 && <span className="clinic-bell-badge">{unreadCount} mới</span>}
        </div>
        <div className="clinic-bell-header-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="clinic-bell-action-text-btn"
              onClick={handleMarkAllRead}
              title="Đánh dấu tất cả là đã đọc"
            >
              <CheckOutlined /> Đã đọc hết
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              className="clinic-bell-action-text-btn clinic-bell-action-danger"
              onClick={handleClearAll}
              title="Xóa lịch sử thông báo"
            >
              <DeleteOutlined /> Xóa hết
            </button>
          )}
        </div>
      </div>

      <div className="clinic-bell-tabs">
        <button
          type="button"
          className={`clinic-bell-tab ${!filterUnreadOnly ? 'active' : ''}`}
          onClick={() => setFilterUnreadOnly(false)}
        >
          Tất cả ({notifications.length})
        </button>
        <button
          type="button"
          className={`clinic-bell-tab ${filterUnreadOnly ? 'active' : ''}`}
          onClick={() => setFilterUnreadOnly(true)}
        >
          Chưa đọc ({unreadCount})
        </button>
      </div>

      <div className="clinic-bell-list">
        {displayedItems.length === 0 ? (
          <div className="clinic-bell-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={filterUnreadOnly ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
            />
          </div>
        ) : (
          displayedItems.map((item) => (
            <div
              key={item.id}
              className={`clinic-bell-item ${!item.read ? 'clinic-bell-item-unread' : ''}`}
              onClick={() => handleItemClick(item)}
              role="button"
              tabIndex={0}
            >
              <div className="clinic-bell-item-icon">{renderCategoryIcon(item.category)}</div>

              <div className="clinic-bell-item-body">
                <div className="clinic-bell-item-top">
                  <span className="clinic-bell-item-category">{formatCategoryName(item.category)}</span>
                  <span className="clinic-bell-item-time">
                    <ClockCircleOutlined /> {formatTime(item.createdAt)}
                  </span>
                </div>

                <div className="clinic-bell-item-title">{item.title}</div>
                {item.message && <div className="clinic-bell-item-msg">{item.message}</div>}

                {item.referenceCode && (
                  <div className="clinic-bell-item-ref">
                    Mã tra cứu: <code>{item.referenceCode}</code>
                  </div>
                )}
              </div>

              {!item.read && (
                <button
                  type="button"
                  className="clinic-bell-item-mark-btn"
                  title="Đánh dấu đã đọc"
                  onClick={(e) => handleMarkAsRead(item.id, e)}
                >
                  <span className="clinic-bell-unread-dot" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayClassName="clinic-bell-popover-overlay"
      arrow={false}
    >
      <Badge count={unreadCount} overflowCount={99} size="small" offset={[-2, 3]}>
        <button
          type="button"
          className={`notification-button ${open ? 'notification-button-active' : ''}`}
          aria-label={`Thông báo hệ thống (${unreadCount} chưa đọc)`}
        >
          <BellOutlined />
        </button>
      </Badge>
    </Popover>
  )
}
