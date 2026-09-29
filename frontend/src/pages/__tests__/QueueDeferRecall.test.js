import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESET_DEFER_REASONS,
  validateDeferReason,
  evaluateDeferAction,
  evaluateReQueueAction,
  formatQueueActionVi,
  formatQueueStatusVi,
  formatCallCountBadge,
  cleanQueueActionErrorMessage,
} from '../../utils/queueDeferRecallHelpers.js'

test('NCL-03-CN-009-TC-01: Bệnh nhân vắng mặt được chuyển sang Tạm hoãn (SKIPPED), lưu lý do và số lần gọi', () => {
  const permissions = {
    isAdmin: false,
    isReceptionist: true,
    isDoctor: false,
    canSkip: true,
  }

  // 1. Kiểm tra evaluateDeferAction với bệnh nhân đang ở lượt khám (IN_PROGRESS)
  const inProgressItem = {
    id: 'queue-item-01',
    patientId: 'pat-001',
    patientName: 'Nguyễn Văn A',
    status: 'IN_PROGRESS',
    callCount: 2,
    queueNumber: 5,
  }

  const deferCheck = evaluateDeferAction(inProgressItem, permissions)
  assert.equal(deferCheck.allowed, true)
  assert.equal(deferCheck.message, null)

  // 2. Kiểm tra lý do tạm hoãn hợp lệ từ danh mục mẫu hoặc nhập tay
  assert.ok(PRESET_DEFER_REASONS.length >= 4)
  assert.ok(PRESET_DEFER_REASONS.includes('Bệnh nhân chưa có mặt khi gọi số thứ tự'))

  const validPresetReason = validateDeferReason(PRESET_DEFER_REASONS[0])
  assert.equal(validPresetReason.valid, true)
  assert.equal(validPresetReason.reason, PRESET_DEFER_REASONS[0])

  const customReason = validateDeferReason('   Đi làm thủ tục bảo hiểm y tế tại quầy 2   ')
  assert.equal(customReason.valid, true)
  assert.equal(customReason.reason, 'Đi làm thủ tục bảo hiểm y tế tại quầy 2')

  // 3. Mô phỏng chuyển trạng thái sang SKIPPED sau khi gọi API skip
  const skippedItem = {
    ...inProgressItem,
    status: 'SKIPPED',
    skipReason: customReason.reason,
    skippedAt: '2026-09-16T09:15:00Z',
  }
  assert.equal(skippedItem.status, 'SKIPPED')
  assert.equal(skippedItem.skipReason, 'Đi làm thủ tục bảo hiểm y tế tại quầy 2')
  assert.equal(skippedItem.callCount, 2) // Bảo toàn số lần gọi trước đó

  // 4. Kiểm tra format nhãn tiếng Việt cho hành động SKIP
  assert.equal(formatQueueActionVi('SKIP'), 'Tạm hoãn lượt khám')
  assert.equal(formatQueueStatusVi('SKIPPED'), 'Tạm hoãn (Vắng mặt)')
  assert.equal(formatCallCountBadge(skippedItem.callCount), 'Đã gọi: 2 lần')
})

test('NCL-03-CN-009-TC-02: Bệnh nhân tạm hoãn (SKIPPED) được đưa lại vào hàng đợi (Re-queue), bảo toàn callCount', () => {
  const receptionistPerms = {
    isAdmin: false,
    isReceptionist: true,
    isDoctor: false,
    canUpdateQueueStatus: true,
  }

  const skippedItem = {
    id: 'queue-item-02',
    patientId: 'pat-002',
    patientName: 'Trần Thị B',
    status: 'SKIPPED',
    callCount: 3,
    skipReason: 'Bệnh nhân chưa có mặt tại phòng chờ',
  }

  // 1. Kiểm tra evaluateReQueueAction đối với trạng thái SKIPPED
  const reQueueCheck = evaluateReQueueAction(skippedItem, receptionistPerms)
  assert.equal(reQueueCheck.allowed, true)
  assert.equal(reQueueCheck.message, null)

  // 2. Mô phỏng dữ liệu phản hồi từ POST /queue-items/{itemId}/re-queue
  const reQueuedItem = {
    ...skippedItem,
    status: 'WAITING',
    skipReason: null,
    skippedAt: null,
    // callCount được giữ nguyên 3 lần từ backend
    callCount: 3,
  }

  assert.equal(reQueuedItem.status, 'WAITING')
  assert.equal(reQueuedItem.callCount, 3)
  assert.equal(reQueuedItem.skipReason, null)

  // 3. Kiểm tra format nhãn tiếng Việt cho hành động RE_QUEUE
  assert.equal(formatQueueActionVi('RE_QUEUE'), 'Đưa lại vào hàng đợi')
  assert.equal(formatQueueStatusVi('WAITING'), 'Đang chờ khám')
  assert.equal(formatCallCountBadge(reQueuedItem.callCount), 'Đã gọi: 3 lần')
})

test('NCL-03-CN-009-TC-03: Từ chối tạm hoãn hoặc đưa lại hàng đợi khi lượt khám đã hoàn tất/hủy hoặc sai quyền', () => {
  const receptionistPerms = {
    isAdmin: false,
    isReceptionist: true,
    isDoctor: false,
    canSkip: true,
    canUpdateQueueStatus: true,
  }

  // 1. Lượt khám đã hoàn tất (COMPLETED)
  const completedItem = {
    id: 'queue-item-03',
    status: 'COMPLETED',
    callCount: 1,
  }
  const deferCompleted = evaluateDeferAction(completedItem, receptionistPerms)
  assert.equal(deferCompleted.allowed, false)
  assert.match(deferCompleted.message, /đã hoàn tất/i)

  const reQueueCompleted = evaluateReQueueAction(completedItem, receptionistPerms)
  assert.equal(reQueueCompleted.allowed, false)
  assert.match(reQueueCompleted.message, /chỉ áp dụng cho bệnh nhân đang ở trạng thái tạm hoãn/i)

  // 2. Lượt khám đã bị hủy (CANCELLED)
  const cancelledItem = {
    id: 'queue-item-04',
    status: 'CANCELLED',
    callCount: 0,
  }
  const deferCancelled = evaluateDeferAction(cancelledItem, receptionistPerms)
  assert.equal(deferCancelled.allowed, false)
  assert.match(deferCancelled.message, /đã bị hủy/i)

  const reQueueCancelled = evaluateReQueueAction(cancelledItem, receptionistPerms)
  assert.equal(reQueueCancelled.allowed, false)

  // 3. Lượt khám đang WAITING không thể gọi re-queue
  const waitingItem = {
    id: 'queue-item-05',
    status: 'WAITING',
    callCount: 0,
  }
  const reQueueWaiting = evaluateReQueueAction(waitingItem, receptionistPerms)
  assert.equal(reQueueWaiting.allowed, false)

  // 4. Kiểm tra phân quyền RBAC: Bác sĩ chỉ khám, không có quyền đưa lại vào hàng đợi tại quầy
  const doctorOnlyPerms = {
    isAdmin: false,
    isReceptionist: false,
    isDoctor: true,
    canUpdateQueueStatus: false,
  }
  const skippedItem = { id: 'queue-item-06', status: 'SKIPPED', callCount: 1 }
  const doctorReQueue = evaluateReQueueAction(skippedItem, doctorOnlyPerms)
  assert.equal(doctorReQueue.allowed, false)
  assert.match(doctorReQueue.message, /chỉ lễ tân hoặc quản trị viên/i)

  // 5. Kiểm tra phân quyền RBAC: User không đủ quyền (không phải Bác sĩ/Lễ tân/Admin) khi thao tác Tạm hoãn
  const unauthorizedPerms = {
    isAdmin: false,
    isReceptionist: false,
    isDoctor: false,
    canSkip: false,
  }
  const inProgressItem = { id: 'queue-item-07', status: 'IN_PROGRESS', callCount: 1 }
  const deferUnauthorized = evaluateDeferAction(inProgressItem, unauthorizedPerms)
  assert.equal(deferUnauthorized.allowed, false)
  assert.match(deferUnauthorized.message, /bạn không có quyền thực hiện thao tác tạm hoãn/i)
})

test('NCL-03-CN-009-TC-04: Tra cứu và phân tích lịch sử luân chuyển hàng đợi (Queue History Audit)', () => {
  // 1. Mock dữ liệu trả về từ GET /queue-items/{itemId}/history
  const mockHistoryData = [
    {
      id: 'qh-01',
      queueItemId: 'item-100',
      operatorId: 'user-rec-01',
      operatorName: 'Lễ tân Hoàng Thị Mai',
      action: 'CHECK_IN',
      status: 'WAITING',
      callCount: 0,
      reason: 'Tiếp nhận bệnh nhân tại quầy',
      timestamp: '2026-09-16T08:00:00Z',
    },
    {
      id: 'qh-02',
      queueItemId: 'item-100',
      operatorId: 'user-doc-01',
      operatorName: 'BS. Phạm Hồng Anh',
      action: 'CALL_NEXT',
      status: 'IN_PROGRESS',
      callCount: 1,
      reason: null,
      timestamp: '2026-09-16T08:15:00Z',
    },
    {
      id: 'qh-03',
      queueItemId: 'item-100',
      operatorId: 'user-doc-01',
      operatorName: 'BS. Phạm Hồng Anh',
      action: 'SKIP',
      status: 'SKIPPED',
      callCount: 1,
      reason: 'Bệnh nhân chưa có mặt khi gọi số thứ tự',
      timestamp: '2026-09-16T08:20:00Z',
    },
    {
      id: 'qh-04',
      queueItemId: 'item-100',
      operatorId: 'user-rec-01',
      operatorName: 'Lễ tân Hoàng Thị Mai',
      action: 'RE_QUEUE',
      status: 'WAITING',
      callCount: 1,
      reason: 'Bệnh nhân có mặt trở lại quầy tiếp đón',
      timestamp: '2026-09-16T08:35:00Z',
    },
  ]

  // 2. Kiểm tra tính toàn vẹn và thông tin trường dữ liệu
  assert.equal(mockHistoryData.length, 4)
  for (const entry of mockHistoryData) {
    assert.ok(entry.operatorName, 'operatorName phải có mặt')
    assert.ok(entry.action, 'action phải có mặt')
    assert.ok(entry.status, 'status phải có mặt')
    assert.ok(typeof entry.callCount === 'number', 'callCount phải là dạng số')
    assert.ok(entry.timestamp, 'timestamp phải có mặt')
  }

  // 3. Kiểm tra mapping tiếng Việt từng hành động trong lịch sử
  assert.equal(formatQueueActionVi(mockHistoryData[0].action), 'Tiếp nhận vào hàng đợi')
  assert.equal(formatQueueActionVi(mockHistoryData[1].action), 'Gọi vào khám')
  assert.equal(formatQueueActionVi(mockHistoryData[2].action), 'Tạm hoãn lượt khám')
  assert.equal(formatQueueActionVi(mockHistoryData[3].action), 'Đưa lại vào hàng đợi')

  // 4. Kiểm tra xử lý thông điệp lỗi API theo cấu trúc ApiErrorResponse chuẩn của Backend
  const simulatedBackendError = {
    response: {
      status: 400,
      data: {
        timestamp: '2026-09-17T03:14:00Z',
        status: 400,
        error: 'Bad Request',
        code: 'QUEUE_ITEM_INVALID_STATUS',
        message: 'Queue item status WAITING does not allow this action. Expected IN_PROGRESS.',
        path: '/api/v1/queue-items/item-100/skip',
      },
    },
  }
  const cleanError = cleanQueueActionErrorMessage(simulatedBackendError, 'Thao tác không thành công')
  assert.equal(cleanError, 'Lượt khám không ở trạng thái phù hợp để thực hiện thao tác này.')

  // Kiểm tra xử lý lỗi không có quyền (403 / UNAUTHORIZED_QUEUE_OPERATION)
  const forbiddenError = {
    response: {
      status: 403,
      data: {
        code: 'UNAUTHORIZED_QUEUE_OPERATION',
        message: 'Access denied.',
      },
    },
  }
  assert.equal(cleanQueueActionErrorMessage(forbiddenError), 'Bạn không có quyền thực hiện thao tác này.')
})
