import axiosClient from './axiosClient.js'

/**
 * API Client for Post-Visit Satisfaction Survey (NCL-10-CN-005).
 */
const satisfactionSurveyApi = {
  /**
   * Bệnh nhân gửi đánh giá mới cho lượt khám
   * @param {{ visitId: string, score: number, comment?: string }} data
   */
  submitSurvey: (data) => axiosClient.post('/patient-portal/satisfaction-surveys', data),

  /**
   * Bệnh nhân cập nhật đánh giá đã gửi cho lượt khám
   * @param {string} id ID bản ghi khảo sát
   * @param {{ score: number, comment?: string }} data
   */
  updateSurvey: (id, data) => axiosClient.put(`/patient-portal/satisfaction-surveys/${id}`, data),

  /**
   * Lấy thông tin đánh giá của lượt khám theo visitId
   * @param {string} visitId
   */
  getByVisitId: (visitId) =>
    axiosClient.get(`/patient-portal/satisfaction-surveys/by-visit/${visitId}`)
      .catch((err) => {
        // Nếu 404 có nghĩa là lượt khám chưa được đánh giá
        if (err.response?.status === 404) {
          return { data: null }
        }
        throw err
      }),

  /**
   * Lấy chi tiết khảo sát theo ID khảo sát
   * @param {string} id
   */
  getById: (id) => axiosClient.get(`/patient-portal/satisfaction-surveys/${id}`),

  /**
   * Quản lý phòng khám lấy báo cáo tổng hợp chất lượng phục vụ & đánh giá
   * @param {{ from: string, to: string, doctorId?: string }} params
   */
  getSatisfactionReport: (params) => axiosClient.get('/reports/satisfaction', { params }),
}

export default satisfactionSurveyApi
