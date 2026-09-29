import axiosClient from './axiosClient.js'

export const backupScheduleApi = {
  /**
   * Lấy cấu hình lịch sao lưu tự động và trạng thái cảnh báo hiện tại
   * @returns {Promise<{data: import('../types').BackupScheduleResponse}>}
   */
  getSchedule: () => axiosClient.get('/backups/schedule'),

  /**
   * Cập nhật cấu hình lịch sao lưu tự động
   * @param {{ enabled: boolean, dailyTime: string }} data
   * @returns {Promise<{data: import('../types').BackupScheduleResponse}>}
   */
  updateSchedule: (data) => axiosClient.put('/backups/schedule', data),

  /**
   * Bỏ qua/xác nhận đã xử lý cảnh báo sao lưu thất bại
   * @returns {Promise<{data: import('../types').BackupScheduleResponse}>}
   */
  dismissAlert: () => axiosClient.post('/backups/schedule/dismiss-alert'),

  /**
   * Kiểm tra tính toàn vẹn của bản sao lưu thành công gần nhất
   * @returns {Promise<{data: import('../types').BackupVerificationResponse}>}
   */
  verifyLatest: () => axiosClient.post('/backups/verify-latest'),

  /**
   * Kiểm tra tính toàn vẹn của một bản sao lưu cụ thể theo ID
   * @param {string} id UUID bản sao lưu
   * @returns {Promise<{data: import('../types').BackupVerificationResponse}>}
   */
  verifyById: (id) => axiosClient.post(`/backups/${id}/verify`),

  /**
   * Lấy danh sách lịch sử tất cả các bản sao lưu trong hệ thống
   * @returns {Promise<{data: Array<import('../types').BackupResponse>}>}
   */
  getHistory: () => axiosClient.get('/backups'),
}

export default backupScheduleApi
