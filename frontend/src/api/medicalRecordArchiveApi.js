import axiosClient from './axiosClient.js'

/**
 * API client cho module Kho lưu trữ hồ sơ bệnh án hết thời hạn (NCL-11-CN-008)
 */
const medicalRecordArchiveApi = {
  /**
   * Lấy danh sách hồ sơ đủ điều kiện chuyển lưu trữ (đã ký & quá thời hạn hoạt động)
   * Yêu cầu quyền: MEDICAL_RECORD_ARCHIVE_MANAGE
   * @param {Object} params - { page, size, sort }
   */
  getEligibleRecords: (params = {}) => {
    return axiosClient.get('/medical-records/archive/eligible', { params })
  },

  /**
   * Tra cứu hồ sơ bệnh án trong kho lưu trữ
   * Yêu cầu quyền: MEDICAL_RECORD_ARCHIVE_READ
   * @param {Object} params - { keyword, fromDate, toDate, doctorId, page, size, sort }
   */
  searchArchivedRecords: (params = {}) => {
    return axiosClient.get('/medical-records/archive', { params })
  },

  /**
   * Chuyển hàng loạt hồ sơ vào kho lưu trữ
   * Yêu cầu quyền: MEDICAL_RECORD_ARCHIVE_MANAGE (chỉ Quản trị viên thực hiện xác nhận)
   * @param {Object} payload - { medicalRecordIds: UUID[], archiveAllEligible: boolean }
   */
  batchArchive: (payload) => {
    return axiosClient.post('/medical-records/archive/batch', payload)
  },

  /**
   * Chuyển 1 hồ sơ đơn lẻ vào kho lưu trữ
   * Yêu cầu quyền: MEDICAL_RECORD_ARCHIVE_MANAGE
   * @param {string} medicalRecordId
   */
  archiveSingle: (medicalRecordId) => {
    return axiosClient.post(`/medical-records/${medicalRecordId}/archive`)
  },
}

export default medicalRecordArchiveApi
