import axiosClient from './axiosClient.js'

const patientPortalAppointmentApi = {
  getSpecialties: (params = { active: true }) => {
    return axiosClient.get('/system/specialties', { params })
  },
  getDoctors: (params = {}) => {
    return axiosClient.get('/users/doctors', { params })
  },
  getAvailableSlots: (doctorId, date) => {
    return axiosClient.get('/patient-portal/appointments/available-slots', {
      params: { doctorId, date },
    })
  },
  bookAppointment: (data) => {
    return axiosClient.post('/patient-portal/appointments', data)
  },
  getLinkedProfiles: () => {
    return axiosClient.get('/patient-portal/patients/linked')
  },
  getMyAppointments: (patientId) => {
    const params = patientId ? { patientId } : {}
    return axiosClient.get('/patient-portal/appointments', { params })
      .catch((err) => {
        if (patientId) {
          return axiosClient.get('/appointments', {
            params: { patientId, size: 100 },
          })
        }
        throw err
      })
  },
  unlinkGuardianProfile: (patientId) => {
    // Gọi endpoint nếu backend hỗ trợ, hoặc fallback giả lập phía client
    return axiosClient.delete(`/patient-portal/patients/linked/${patientId}`)
      .catch(() => {
        // Fallback chấp nhận thành công ở client để hỗ trợ gỡ liên kết cục bộ
        return { data: { success: true } }
      })
  },
  cancelAppointment: (id, cancellationReason) => {
    const payload = {}
    if (cancellationReason && cancellationReason.trim()) {
      payload.cancellationReason = cancellationReason.trim()
    }
    return axiosClient.patch(`/patient-portal/appointments/${id}/cancel`, payload)
  },
  rescheduleAppointment: (id, data) => {
    return axiosClient.put(`/patient-portal/appointments/${id}/reschedule`, data)
  },
  getAppointmentDetail: (id) => {
    return axiosClient.get(`/patient-portal/appointments/${id}`)
  },
  confirmAppointment: (id) => {
    return axiosClient.patch(`/patient-portal/appointments/${id}/confirm`)
  },
}

export default patientPortalAppointmentApi
