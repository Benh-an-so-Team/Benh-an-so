import axiosClient from './axiosClient.js'

/**
 * API client cho nghiệp vụ Tiếp nhận và xử lý yêu cầu về dữ liệu cá nhân
 * (NCL-15-CN-006 / QTN-24, QTN-19)
 */
const personalDataRequestApi = {
  create: (payload) => axiosClient.post('/personal-data-requests', payload),
  getById: (id) => axiosClient.get(`/personal-data-requests/${id}`),
  complete: (id, result) => axiosClient.patch(`/personal-data-requests/${id}/complete`, { result }),
  search: (params) => axiosClient.get('/personal-data-requests', { params }),
  getDeadlineAlerts: (params) => axiosClient.get('/personal-data-request-deadline-alerts', { params }),
}

export default personalDataRequestApi
