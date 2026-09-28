/**
 * NoticeBellStore.js
 * Kho lưu trữ và quản lý thông báo cho Chuông thông báo (Header Bell).
 * Dành riêng cho Quản trị viên và Dược sĩ lưu lại các cảnh báo quan trọng:
 * - Sao lưu thất bại (BACKUP_FAILED)
 * - Tồn kho thấp (INVENTORY_LOW)
 * - Thuốc gần hết hạn (MEDICINE_EXPIRING)
 * - Cảnh báo an toàn lâm sàng & bảo mật (CLINICAL_SAFETY_ALERT / UNUSUAL_ACCESS)
 */

const STORAGE_KEY = 'clinic_bell_notifications_v1'
const MAX_STORED_NOTICES = 50

class NoticeBellStore {
  constructor() {
    this.notifications = this.loadFromStorage()
    this.listeners = new Set()
  }

  loadFromStorage() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return []
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  saveToStorage() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications))
    } catch {
      // ignore storage error
    }
  }

  notify() {
    this.saveToStorage()
    const snapshot = [...this.notifications]
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot)
      } catch (err) {
        console.error('[NoticeBellStore] Listener error:', err)
      }
    })
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener([...this.notifications])
    return () => {
      this.listeners.delete(listener)
    }
  }

  getBellNotifications() {
    return [...this.notifications]
  }

  getUnreadCount() {
    return this.notifications.filter((n) => !n.read).length
  }

  /**
   * Thêm thông báo mới vào chuông
   */
  addBellNotification(item) {
    if (!item || !item.title) return null

    const id = item.id || `bell-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const newNotice = {
      id,
      category: item.category || 'SYSTEM',
      title: item.title,
      message: item.message || '',
      level: item.level || 'warning',
      actionUrl: item.actionUrl || null,
      referenceCode: item.referenceCode || null,
      createdAt: item.createdAt || new Date().toISOString(),
      read: false,
    }

    // Đẩy lên đầu danh sách, giới hạn tối đa MAX_STORED_NOTICES
    this.notifications = [newNotice, ...this.notifications].slice(0, MAX_STORED_NOTICES)
    this.notify()
    return newNotice
  }

  markAsRead(id) {
    let changed = false
    this.notifications = this.notifications.map((n) => {
      if (n.id === id && !n.read) {
        changed = true
        return { ...n, read: true }
      }
      return n
    })
    if (changed) this.notify()
  }

  markAllAsRead() {
    let changed = false
    this.notifications = this.notifications.map((n) => {
      if (!n.read) {
        changed = true
        return { ...n, read: true }
      }
      return n
    })
    if (changed) this.notify()
  }

  removeBellNotification(id) {
    const beforeCount = this.notifications.length
    this.notifications = this.notifications.filter((n) => n.id !== id)
    if (this.notifications.length !== beforeCount) {
      this.notify()
    }
  }

  clearBellNotifications() {
    this.notifications = []
    this.notify()
  }
}

export const noticeBellStore = new NoticeBellStore()
export default noticeBellStore
