/**
 * NoticeContext.jsx
 * React Context cung cấp hook useNotice() cho toàn ứng dụng
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import {
  showNotice,
  dismissNotice,
  clearAllNotices,
  noticeManager,
} from './NoticeService.js'
import noticeBellStore from '../../../utils/NoticeBellStore.js'

export const NoticeContext = createContext(null)

export function NoticeProvider({ children }) {
  const [noticesState, setNoticesState] = useState(() => noticeManager.getSnapshot())
  const [bellNotifications, setBellNotifications] = useState(() => noticeBellStore.getBellNotifications())

  useEffect(() => {
    const unsubNotices = noticeManager.subscribe((snapshot) => {
      setNoticesState(snapshot)
    })
    const unsubBell = noticeBellStore.subscribe((list) => {
      setBellNotifications(list)
    })

    return () => {
      unsubNotices()
      unsubBell()
    }
  }, [])

  const unreadBellCount = useMemo(() => {
    return bellNotifications.filter((n) => !n.read).length
  }, [bellNotifications])

  const contextValue = useMemo(() => {
    return {
      showNotice,
      dismissNotice,
      clearAllNotices,
      noticesState,
      bellNotifications,
      unreadBellCount,
      markBellAsRead: (id) => noticeBellStore.markAsRead(id),
      markAllBellAsRead: () => noticeBellStore.markAllAsRead(),
      clearBellNotifications: () => noticeBellStore.clearBellNotifications(),
    }
  }, [noticesState, bellNotifications, unreadBellCount])

  return (
    <NoticeContext.Provider value={contextValue}>
      {children}
    </NoticeContext.Provider>
  )
}

export function useNotice() {
  const context = useContext(NoticeContext)
  if (!context) {
    // Nếu gọi ngoài Provider, vẫn fallback về singleton service
    return {
      showNotice,
      dismissNotice,
      clearAllNotices,
      noticesState: noticeManager.getSnapshot(),
      bellNotifications: noticeBellStore.getBellNotifications(),
      unreadBellCount: noticeBellStore.getUnreadCount(),
      markBellAsRead: (id) => noticeBellStore.markAsRead(id),
      markAllBellAsRead: () => noticeBellStore.markAllAsRead(),
      clearBellNotifications: () => noticeBellStore.clearBellNotifications(),
    }
  }
  return context
}

export default NoticeContext
