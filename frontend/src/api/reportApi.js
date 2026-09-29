import axiosClient from './axiosClient.js'

const reportApi = {
  summary: (params) => axiosClient.get('/reports/summary', { params }),
  timeline: (params) => axiosClient.get('/reports/visits-timeline', { params }),
  export: (params) =>
    axiosClient.get('/reports/export', {
      params,
      responseType: 'blob',
    }),
  exportReport: ({ reportType, from, to, ...rest }) =>
    axiosClient.get('/reports/export', {
      params: { reportType, from, to, ...rest },
      responseType: 'blob',
    }),
  exportOperational: (params) =>
    axiosClient.get('/reports/export', {
      params: { reportType: 'OPERATIONAL_REPORT', ...params },
      responseType: 'blob',
    }),
  exportVisits: (params) =>
    axiosClient.get('/reports/export', {
      params: { reportType: 'VISIT_REPORT', ...params },
      responseType: 'blob',
    }),
  exportRevenue: (params) =>
    axiosClient.get('/reports/export', {
      params: { reportType: 'REVENUE_REPORT', ...params },
      responseType: 'blob',
    }),
  topMedicines: (params) => axiosClient.get('/reports/top-medicines', { params }),
  doctorVisits: (params) => axiosClient.get('/reports/doctor-visits', { params }),
  audit: (params) => axiosClient.get('/reports/audit-logs', { params }),
  exportAccessLog: ({ from, to }) =>
    axiosClient.get('/reports/access-log/export', {
      params: { from, to },
      responseType: 'blob',
    }),
  dashboard: () => axiosClient.get('/reports/dashboard'),
}

export default reportApi
