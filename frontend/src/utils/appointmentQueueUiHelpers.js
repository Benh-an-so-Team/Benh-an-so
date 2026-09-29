export const avatarPalette = [
  ['#e7f0ff', '#1c68ce'],
  ['#fff0e5', '#bf6b32'],
  ['#e8f7ef', '#21835a'],
  ['#f1eaff', '#7541b7'],
]

export const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export const DEFAULT_DOCTORS = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    username: 'doctor1',
    fullName: 'Dr. Nguyen Minh Anh',
    department: 'Nội khoa',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    username: 'doctor2',
    fullName: 'Dr. Tran Quang Huy',
    department: 'Ngoại khoa',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    username: 'doctor3',
    fullName: 'BS. Phạm Hồng Anh',
    department: 'Nội tổng hợp',
  },
]

export const getAvatarStyle = (seed = '') => {
  const paletteIndex =
    [...String(seed)].reduce((sum, character) => sum + character.charCodeAt(0), 0) % avatarPalette.length
  const [background, color] = avatarPalette[paletteIndex]
  return { background, color }
}

export const normalizeQueueItem = (item = {}) => ({
  ...item,
  id: item.id || item.queueItemId,
  status: item.status || item.queueItemStatus,
  roomName: item.roomName || item.roomNumber,
})

export const normalizeQueueList = (payload) => {
  const list = Array.isArray(payload) ? payload : (payload?.content || payload?.items || [])
  return list.map(normalizeQueueItem).filter((item) => item.id)
}

export const replaceQueueItem = (items, queueItem) => {
  const list = Array.isArray(items) ? items : []
  const exists = list.some((item) => String(item.id) === String(queueItem.id))
  return exists
    ? list.map((item) => (String(item.id) === String(queueItem.id) ? queueItem : item))
    : [queueItem, ...list]
}
