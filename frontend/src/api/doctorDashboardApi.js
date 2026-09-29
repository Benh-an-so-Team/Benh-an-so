import axiosClient from './axiosClient.js'

const doctorDashboardApi = {
  /**
   * Fetch aggregated doctor dashboard data for currently logged-in doctor.
   * Backend strictly enforces doctor-only data scope.
   * @param {Object} [params]
   * @param {string} [params.date] - YYYY-MM-DD
   * @param {Object} [config]
   */
  getDoctorDashboard: (params = {}, config = {}) =>
    axiosClient.get('/dashboard/doctor', { params, ...config }),

  /**
   * Fetch queue items for logged-in doctor.
   * @param {Object} [params]
   */
  getMyQueue: (params = {}) =>
    axiosClient.get('/queues/me', { params }),

  /**
   * Fetch appointments for the day.
   * @param {Object} [params]
   */
  getAppointments: (params = {}) =>
    axiosClient.get('/appointments', { params }),

  /**
   * Fetch overdue/pending medical records for signing.
   * @param {Object} [params]
   */
  getPendingRecords: (params = {}) =>
    axiosClient.get('/medical-records/overdue-signing', { params }),

  /**
   * Fetch recent clinical results.
   * @param {Object} [params]
   */
  getRecentClinicalResults: (params = {}) =>
    axiosClient.get('/clinical-results', { params }),
}

export default doctorDashboardApi
