import axiosClient from './axiosClient.js'

const appointmentApi = {
  getAll: (params) => axiosClient.get('/appointments', { params: { size: 100, ...params } }),
  getById: (id) => axiosClient.get(`/appointments/${id}`),
  create: (data) => axiosClient.post('/appointments', data),
  cancel: (id, reason) => axiosClient.patch(`/appointments/${id}/cancel`, {
    cancelReason: reason || 'Khai báo hủy lịch',
    reason: reason || 'Khai báo hủy lịch',
  }),
  noShow: (id) => axiosClient.patch(`/appointments/${id}/no-show`),
  sendReminder: (id) => axiosClient.post(`/appointments/${id}/reminder`),
  getOverdue: (params) => axiosClient.get('/appointments/overdue', { params }),
  checkIn: (id) => axiosClient.post(`/appointments/${id}/check-in`),
  reschedule: (id, data) => axiosClient.patch(`/appointments/${id}/reschedule`, data),
  getAvailableSlots: (doctorId, date) => axiosClient.get('/patient-portal/appointments/available-slots', { params: { doctorId, date } }),
  confirm: (id) => axiosClient.patch(`/appointments/${id}/confirm`),
  getUnconfirmed: (params) => axiosClient.get('/appointments/unconfirmed', { params }),
  getDoctorWeeklyTable: (params) => axiosClient.get('/appointments/doctor-weekly-table', { params }),
  previewSeries: (data) => axiosClient.post('/appointments/series/preview', data),
  createSeries: (data) => axiosClient.post('/appointments/series', data),
  getSeriesById: (id) => axiosClient.get(`/appointments/series/${id}`),
  getSeriesByPatient: (patientId) => axiosClient.get(`/appointments/series/patient/${patientId}`),
}

export default appointmentApi

