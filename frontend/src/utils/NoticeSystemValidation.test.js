/**
 * NoticeSystemValidation.test.js
 * Bộ kiểm thử toàn diện hệ thống thông báo lỗi/cảnh báo góc dưới bên phải:
 * 1. 4 mức độ & hành vi tự tắt (Error 8s, Warning 8s, Critical không tự tắt, Success/Info 4s)
 * 2. Giới hạn hiển thị tối đa 4 thông báo & gộp thông báo thừa ("và N thông báo khác")
 * 3. Chống lặp thông báo (Deduplication count "x3", reset timer)
 * 4. Tạm dừng khi hover (Pause on hover, resume on leave)
 * 5. Bảo vệ dữ liệu cá nhân bệnh nhân & lọc lỗi kỹ thuật thô (SQL, stack trace)
 * 6. Xử lý từ chối truy cập 403 (Cổng bệnh nhân vs Nội bộ phòng khám)
 * 7. Tóm tắt lỗi nhập liệu biểu mẫu & tệp Excel
 * 8. Cảnh báo an toàn lâm sàng (Critical, persistent) & Cảnh báo hết phiên làm việc
 * 9. Lưu trữ chuông thông báo (Header Bell Store) cho Quản trị viên & Dược sĩ
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  showNotice,
  dismissNotice,
  clearAllNotices,
  noticeManager,
  NOTICE_LEVELS,
  DEFAULT_DURATIONS,
  MAX_VISIBLE_NOTICES,
} from '../components/common/notice/NoticeService.js'

import {
  sanitizeNoticeMessage,
  sanitizeNoticeTitle,
  resolveAccessDeniedNotice,
  formatValidationSummary,
  formatExcelValidationSummary,
  generateReferenceCode,
  hasTechnicalError,
} from './noticeSecurityHelpers.js'

import { noticeBellStore } from './NoticeBellStore.js'

test('1. Bốn mức độ thông báo và cấu hình thời gian tự tắt chuẩn xác', () => {
  // Lỗi (error): Tự tắt sau 8 giây
  assert.equal(DEFAULT_DURATIONS[NOTICE_LEVELS.ERROR], 8000, 'Lỗi phải tự tắt sau 8000ms')

  // Cảnh báo thường (warning): Tự tắt sau 8 giây
  assert.equal(DEFAULT_DURATIONS[NOTICE_LEVELS.WARNING], 8000, 'Cảnh báo thường phải tự tắt sau 8000ms')

  // Cảnh báo nghiêm trọng (critical): KHÔNG tự tắt (persistent = true / duration = 0)
  assert.equal(DEFAULT_DURATIONS[NOTICE_LEVELS.CRITICAL], 0, 'Cảnh báo nghiêm trọng KHÔNG tự tắt')

  // Thành công & Thông tin: Tự tắt sau 4 giây
  assert.equal(DEFAULT_DURATIONS[NOTICE_LEVELS.SUCCESS], 4000, 'Thành công phải tự tắt sau 4000ms')
  assert.equal(DEFAULT_DURATIONS[NOTICE_LEVELS.INFO], 4000, 'Thông tin phải tự tắt sau 4000ms')
})

test('2. Hành vi khởi tạo notice theo từng mức độ qua showNotice shortcuts', () => {
  clearAllNotices()

  // 1. Error
  const errId = showNotice.error('Lỗi lưu dữ liệu', 'Không thể kết nối cơ sở dữ liệu.')
  let snap = noticeManager.getSnapshot()
  const errNotice = snap.allNotices.find((n) => n.id === errId)
  assert.ok(errNotice, 'Phải tạo thành công notice error')
  assert.equal(errNotice.level, NOTICE_LEVELS.ERROR)
  assert.equal(errNotice.duration, 8000)
  assert.equal(errNotice.persistent, false)

  // 2. Warning có kèm nút thao tác
  const warnId = showNotice.warning('Tồn kho thấp', 'Thuốc Paracetamol sắp hết.', {
    label: 'Xem danh sách',
    onClick: () => {},
  })
  snap = noticeManager.getSnapshot()
  const warnNotice = snap.allNotices.find((n) => n.id === warnId)
  assert.ok(warnNotice, 'Phải tạo thành công notice warning')
  assert.equal(warnNotice.level, NOTICE_LEVELS.WARNING)
  assert.equal(warnNotice.action.label, 'Xem danh sách')

  // 3. Critical (bắt buộc người dùng đóng, persistent = true)
  const critId = showNotice.critical('Sao lưu thất bại', 'Tiến trình sao lưu tự động gặp sự cố.')
  snap = noticeManager.getSnapshot()
  const critNotice = snap.allNotices.find((n) => n.id === critId)
  assert.ok(critNotice, 'Phải tạo thành công notice critical')
  assert.equal(critNotice.level, NOTICE_LEVELS.CRITICAL)
  assert.equal(critNotice.persistent, true)
  assert.equal(critNotice.duration, 0)

  // 4. Success
  const succId = showNotice.success('Thành công', 'Đã lưu thông tin bệnh nhân.')
  snap = noticeManager.getSnapshot()
  const succNotice = snap.allNotices.find((n) => n.id === succId)
  assert.equal(succNotice.level, NOTICE_LEVELS.SUCCESS)
  assert.equal(succNotice.duration, 4000)

  clearAllNotices()
})

test('3. Giới hạn hiển thị tối đa 4 thông báo và gộp phần thừa thành "và N thông báo khác"', () => {
  clearAllNotices()
  assert.equal(MAX_VISIBLE_NOTICES, 4, 'Hệ thống quy định tối đa 4 thông báo')

  // Tạo 6 thông báo khác nhau
  for (let i = 1; i <= 6; i++) {
    showNotice.info(`Thông báo ${i}`, `Mô tả chi tiết nội dung số ${i}`, {
      dedupeKey: `unique-notice-${i}`,
    })
  }

  const snap = noticeManager.getSnapshot()
  assert.equal(snap.totalCount, 6, 'Tổng cộng có 6 thông báo trong hàng đợi')
  assert.equal(snap.visibleNotices.length, 4, 'Chỉ 4 thông báo mới nhất được hiển thị trên giao diện')
  assert.equal(snap.overflowCount, 2, 'Gộp 2 thông báo cũ thành phần thừa (+2 thông báo khác)')

  // Cái mới nhất nằm dưới cùng (mục cuối cùng của mảng hiển thị)
  assert.equal(snap.visibleNotices[3].title, 'Thông báo 6', 'Thông báo mới nhất phải ở vị trí cuối cùng')

  clearAllNotices()
  const emptySnap = noticeManager.getSnapshot()
  assert.equal(emptySnap.totalCount, 0)
  assert.equal(emptySnap.visibleNotices.length, 0)
})

test('4. Chống lặp thông báo liên tiếp (Deduplication) - tăng số đếm x2, x3 và reset timer', () => {
  clearAllNotices()

  const id1 = showNotice.error('Thất bại', 'Không thể kết nối đến máy chủ.', {
    dedupeKey: 'dup-conn-error',
    duration: 8000,
  })

  // Gọi lần 2 với cùng nội dung/dedupeKey
  const id2 = showNotice.error('Thất bại', 'Không thể kết nối đến máy chủ.', {
    dedupeKey: 'dup-conn-error',
    duration: 8000,
  })

  // Gọi lần 3
  const id3 = showNotice.error('Thất bại', 'Không thể kết nối đến máy chủ.', {
    dedupeKey: 'dup-conn-error',
    duration: 8000,
  })

  assert.equal(id1, id2, 'Không tạo thẻ mới, phải trả về cùng notice ID')
  assert.equal(id2, id3, 'Không tạo thẻ mới, phải trả về cùng notice ID')

  const snap = noticeManager.getSnapshot()
  assert.equal(snap.totalCount, 1, 'Chỉ có đúng 1 thẻ duy nhất trên màn hình')
  assert.equal(snap.allNotices[0].count, 3, 'Số đếm lặp phải hiển thị là 3 (x3)')

  clearAllNotices()
})

test('5. Tạm dừng khi rê chuột (Pause on hover) và tiếp tục đếm giờ khi rời chuột', () => {
  clearAllNotices()

  const id = showNotice.error('Kiểm tra Hover', 'Thông báo thử nghiệm', { duration: 8000 })
  const timerBefore = noticeManager.timers.get(id)
  assert.ok(timerBefore, 'Timer phải được khởi tạo')
  assert.equal(timerBefore.isPaused, false, 'Ban đầu không ở trạng thái pause')

  // Giả lập chuột rê vào
  noticeManager.pauseNotice(id)
  const timerPaused = noticeManager.timers.get(id)
  assert.equal(timerPaused.isPaused, true, 'Timer phải chuyển sang trạng thái pause')

  // Giả lập chuột rời ra
  noticeManager.resumeNotice(id)
  const timerResumed = noticeManager.timers.get(id)
  assert.equal(timerResumed.isPaused, false, 'Timer phải được tiếp tục đếm ngược')

  clearAllNotices()
})

test('6. Bảo vệ dữ liệu cá nhân bệnh nhân (Privacy) & Không hiển thị lỗi kỹ thuật thô', () => {
  // 1. Lọc bỏ lỗi kỹ thuật thô: SQL, hibernate, null pointer, stack trace
  const rawSqlError = 'SQLException: Duplicate entry 123 for key tbl_patient.PRIMARY at com.benhsoan.repo.save()'
  assert.ok(hasTechnicalError(rawSqlError), 'Phải nhận diện được lỗi kỹ thuật thô')

  const sanitizedSql = sanitizeNoticeMessage(rawSqlError, { referenceCode: 'ERR-TEST' })
  assert.ok(!sanitizedSql.includes('SQLException'), 'Không được chứa tên exception Java')
  assert.ok(!sanitizedSql.includes('tbl_patient'), 'Không được chứa tên bảng database')
  assert.ok(sanitizedSql.includes('ERR-TEST'), 'Phải chứa mã tham chiếu cho Quản trị viên')

  // 2. Bảo vệ dữ liệu cá nhân: Ẩn họ tên đầy đủ tại quầy tiếp đón
  const rawPatientMsg = 'Đã cập nhật hồ sơ bệnh nhân Nguyễn Văn An thành công.'
  const sanitizedPatientMsg = sanitizeNoticeMessage(rawPatientMsg)
  assert.ok(!sanitizedPatientMsg.includes('Nguyễn Văn An'), 'Không được để lộ họ tên đầy đủ của bệnh nhân')
  assert.ok(sanitizedPatientMsg.includes('Bệnh nhân'), 'Thay thế bằng danh từ chung Bệnh nhân')

  // 3. Cho phép giữ mã bệnh nhân định danh y tế hợp lệ (BN-2026-0001)
  const codeMsg = 'Hồ sơ bệnh nhân Trần Thị Mai (BN-2026-0089) đã được chuyển kho lưu trữ.'
  const sanitizedCodeMsg = sanitizeNoticeMessage(codeMsg)
  assert.ok(sanitizedCodeMsg.includes('BN-2026-0089'), 'Phải giữ lại mã hồ sơ BN để đối chiếu')
  assert.ok(!sanitizedCodeMsg.includes('Trần Thị Mai'), 'Không để lộ họ tên đầy đủ')
})

test('7. Xử lý từ chối truy cập (403) - Phân biệt Cổng Bệnh nhân và Nhân viên', () => {
  // Cổng Bệnh nhân: Thông điệp trung lập, không tiết lộ dữ liệu có tồn tại hay không
  const patientPortalNotice = resolveAccessDeniedNotice(true)
  assert.equal(patientPortalNotice.title, 'Yêu cầu không khả dụng')
  assert.ok(patientPortalNotice.message.includes('Không tìm thấy nội dung yêu cầu'))

  // Nội bộ phòng khám: Thân thiện, hướng dẫn liên hệ quản lý
  const clinicStaffNotice = resolveAccessDeniedNotice(false)
  assert.equal(clinicStaffNotice.title, 'Từ chối truy cập')
  assert.ok(clinicStaffNotice.message.includes('Bạn không có quyền thực hiện thao tác này'))
})

test('8. Tóm tắt lỗi nhập liệu biểu mẫu & tệp bảng tính (Excel import)', () => {
  // Biểu mẫu thông thường: chỉ 1 dòng tóm tắt
  const formSummary = formatValidationSummary(3)
  assert.equal(formSummary, 'Có 3 trường thông tin cần chỉnh sửa. Vui lòng kiểm tra lại biểu mẫu.')

  // Nhập hồ sơ từ Excel: tóm tắt số lượng dòng lỗi
  const excelSummary = formatExcelValidationSummary(7)
  assert.equal(excelSummary, 'Tệp dữ liệu tải lên có 7 dòng chưa hợp lệ. Vui lòng kiểm tra danh sách chi tiết bên dưới.')
})

test('9. Cảnh báo an toàn lâm sàng (tương tác thuốc, dị ứng, vượt liều tối đa) & Cảnh báo hết phiên', () => {
  clearAllNotices()
  noticeBellStore.clearBellNotifications()

  // 1. Cảnh báo an toàn lâm sàng: Critical, Persistent, lưu vào chuông
  const alertId = showNotice.clinicalAlert({
    title: 'Cảnh báo tương tác thuốc nghiêm trọng',
    message: 'Thuốc A và Thuốc B có tương tác mức độ nặng.',
  })

  const snap = noticeManager.getSnapshot()
  const alertNotice = snap.allNotices.find((n) => n.id === alertId)
  assert.equal(alertNotice.level, NOTICE_LEVELS.CRITICAL, 'Phải là mức critical')
  assert.equal(alertNotice.persistent, true, 'Bắt buộc không tự tắt')

  // Kiểm tra đã lưu vào chuông
  const bellItems = noticeBellStore.getBellNotifications()
  assert.ok(bellItems.length >= 1, 'Cảnh báo an toàn lâm sàng phải được lưu vào chuông')
  assert.equal(bellItems[0].category, 'CLINICAL')

  // 2. Cảnh báo hết phiên làm việc
  let extendCalled = false
  const timeoutId = showNotice.sessionTimeout({
    remainingSeconds: 45,
    onExtend: () => {
      extendCalled = true
    },
  })
  const timeoutNotice = noticeManager.getSnapshot().allNotices.find((n) => n.id === timeoutId)
  assert.ok(timeoutNotice, 'Phải tạo notice cảnh báo hết phiên')
  assert.equal(timeoutNotice.action.label, 'Tiếp tục làm việc')

  timeoutNotice.action.onClick()
  assert.ok(extendCalled, 'Click nút Tiếp tục làm việc phải kích hoạt hàm onExtend')

  clearAllNotices()
  noticeBellStore.clearBellNotifications()
})

test('10. Chuông thông báo (Header Bell Store) lưu trữ cho Quản trị viên & Dược sĩ', () => {
  noticeBellStore.clearBellNotifications()
  assert.equal(noticeBellStore.getUnreadCount(), 0)

  // 1. Cảnh báo sao lưu tự động thất bại
  noticeBellStore.addBellNotification({
    category: 'BACKUP',
    title: 'Sao lưu tự động thất bại',
    message: 'Không thể ghi bản sao lưu vào thư mục lưu trữ.',
    level: 'critical',
  })

  // 2. Cảnh báo tồn kho thấp
  noticeBellStore.addBellNotification({
    category: 'INVENTORY',
    title: 'Thuốc sắp hết trong kho',
    message: 'Paracetamol 500mg còn 15 viên (dưới ngưỡng 50).',
    level: 'warning',
  })

  // 3. Cảnh báo thuốc gần hết hạn
  noticeBellStore.addBellNotification({
    category: 'MEDICINE',
    title: 'Thuốc gần hết hạn sử dụng',
    message: 'Lô thuốc Kháng sinh Amoxicillin hết hạn trong 15 ngày.',
    level: 'warning',
  })

  assert.equal(noticeBellStore.getUnreadCount(), 3, 'Phải có 3 thông báo chưa đọc')

  // Đánh dấu đã đọc 1 cái
  const list = noticeBellStore.getBellNotifications()
  noticeBellStore.markAsRead(list[0].id)
  assert.equal(noticeBellStore.getUnreadCount(), 2)

  // Đánh dấu đã đọc tất cả
  noticeBellStore.markAllAsRead()
  assert.equal(noticeBellStore.getUnreadCount(), 0)

  noticeBellStore.clearBellNotifications()
  assert.equal(noticeBellStore.getBellNotifications().length, 0)
})
