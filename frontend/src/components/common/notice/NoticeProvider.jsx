/**
 * NoticeProvider.jsx
 * Component Provider toàn cục đặt tại gốc ứng dụng (App.jsx).
 * Kết nối NoticeContext và hiển thị NoticeContainer ở góc dưới bên phải màn hình.
 */

import React, { useEffect, useState, useMemo } from 'react'
import { NoticeContext } from './NoticeContext.jsx'
import NoticeContainer from './NoticeContainer.jsx'
import {
  showNotice,
  dismissNotice,
  clearAllNotices,
  noticeManager,
} from './NoticeService.js'
import noticeBellStore from '../../../utils/NoticeBellStore.js'
import './notice.css'

export default function NoticeProvider({ children }) {
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
      <NoticeContainer noticesState={noticesState} />
    </NoticeContext.Provider>
  )
}
