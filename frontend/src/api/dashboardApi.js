import axiosClient from './axiosClient.js'

const dashboardApi = {
  getOperational: (config = {}) => axiosClient.get('/dashboard/operational', config),
  getDoctorDashboard: (params = {}, config = {}) =>
    axiosClient.get('/dashboard/doctor', { params, ...config }),
}

export default dashboardApi
