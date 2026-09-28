/**
 * NoticeContainer.jsx
 * Khung chứa thông báo cố định tại GÓC DƯỚI BÊN PHẢI màn hình.
 * - Xếp chồng từ dưới lên (cái mới nhất nằm dưới cùng).
 * - Hiển thị tối đa 4 thông báo cùng lúc.
 * - Nếu vượt quá 4, gộp phần thừa thành pill "và N thông báo khác".
 * - Chừa khoảng cách an toàn với mép màn hình và nút thao tác.
 */

import React, { useState } from 'react'
import NoticeCard from './NoticeCard.jsx'
import { noticeManager } from './NoticeService.js'
import { CloseCircleOutlined, EyeOutlined } from '@ant-design/icons'

export default function NoticeContainer({ noticesState }) {
  const [showAllDrawer, setShowAllDrawer] = useState(false)
  const { visibleNotices = [], overflowCount = 0, allNotices = [] } = noticesState || {}

  if (!allNotices || allNotices.length === 0) {
    return null
  }

  const handleDismiss = (id) => {
    noticeManager.dismiss(id)
  }

  const handlePause = (id) => {
    noticeManager.pauseNotice(id)
  }

  const handleResume = (id) => {
    noticeManager.resumeNotice(id)
  }

  const handleClearAll = () => {
    noticeManager.clearAll()
    setShowAllDrawer(false)
  }

  // Danh sách hiển thị theo chế độ thu gọn (tối đa 4 cái mới nhất) hoặc mở rộng toàn bộ
  const displayItems = showAllDrawer ? allNotices : visibleNotices

  return (
    <div
      className="notice-viewport-container"
      aria-live="polite"
      aria-label="Thông báo góc màn hình"
    >
      {/* Nút tóm tắt khi có hơn 4 thông báo */}
      {overflowCount > 0 && !showAllDrawer && (
        <div className="notice-overflow-pill" role="status">
          <span className="notice-overflow-text">
            và <strong>{overflowCount}</strong> thông báo khác
          </span>
          <div className="notice-overflow-actions">
            <button
              type="button"
              className="notice-overflow-btn"
              onClick={() => setShowAllDrawer(true)}
              title="Xem tất cả thông báo"
            >
              <EyeOutlined /> Xem hết
            </button>
            <button
              type="button"
              className="notice-overflow-btn notice-overflow-btn-dismiss"
              onClick={handleClearAll}
              title="Đóng toàn bộ thông báo"
            >
              <CloseCircleOutlined /> Đóng tất cả
            </button>
          </div>
        </div>
      )}

      {showAllDrawer && (
        <div className="notice-expanded-header">
          <span>Tất cả thông báo ({allNotices.length})</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="notice-overflow-btn"
              onClick={() => setShowAllDrawer(false)}
            >
              Thu gọn
            </button>
            <button
              type="button"
              className="notice-overflow-btn notice-overflow-btn-dismiss"
              onClick={handleClearAll}
            >
              Đóng hết
            </button>
          </div>
        </div>
      )}

      {/* Danh sách thẻ thông báo (xếp chồng từ dưới lên bằng CSS flex-direction: column-reverse) */}
      <div className="notice-stack-list">
        {displayItems.map((notice) => (
          <NoticeCard
            key={notice.id}
            notice={notice}
            onDismiss={handleDismiss}
            onPause={handlePause}
            onResume={handleResume}
          />
        ))}
      </div>
    </div>
  )
}
