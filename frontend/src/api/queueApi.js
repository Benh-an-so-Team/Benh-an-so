import axiosClient from './axiosClient.js'
import dayjs from 'dayjs'

const queueApi = {
  getQueues: (params = {}) => {
    const formattedParams = {
      date: dayjs().format('YYYY-MM-DD'),
      doctorId: params.doctorId,
      roomId: params.roomId,
      ...('date' in params ? { date: params.date } : {}),
    }
    Object.keys(formattedParams).forEach((key) => {
      if (formattedParams[key] === null || formattedParams[key] === undefined || formattedParams[key] === '') {
        delete formattedParams[key]
      }
    })
    return axiosClient.get('/queues', { params: formattedParams })
  },

  getMyQueue: (params = {}) => {
    const formattedParams = {
      date: dayjs().format('YYYY-MM-DD'),
      ...params,
    }
    return axiosClient.get('/queues/me', { params: formattedParams })
  },

  getById: (itemId) => axiosClient.get(`/queue-items/${itemId}`),

  checkInAppointment: (appointmentId) => axiosClient.post(`/appointments/${appointmentId}/check-in`),

  checkInWalkIn: (data) => axiosClient.post('/queue-items/walk-in', data),

  callNext: (queueId) => axiosClient.post(`/queues/${queueId}/call-next`),

  updateStatus: (itemId, targetStatus, cancelReason) =>
    axiosClient.patch(`/queue-items/${itemId}/status`, {
      targetStatus,
      ...(cancelReason ? { cancelReason } : {}),
    }),

  skip: (itemId, reason = 'Vắng mặt khi gọi') => axiosClient.post(`/queue-items/${itemId}/skip`, { reason }),

  reQueue: (itemId) => axiosClient.post(`/queue-items/${itemId}/re-queue`),

  getHistory: (itemId) => axiosClient.get(`/queue-items/${itemId}/history`),

  complete: (itemId) => axiosClient.post(`/queue-items/${itemId}/complete`),

  close: (itemId, outcome, reason) =>
    axiosClient.post(`/queue-items/${itemId}/close`, { outcome, reason }),

  prioritize: (itemId, priority, reason) =>
    axiosClient.post(`/queue-items/${itemId}/prioritize`, { priority, reason }),

  getWaitingRoomDisplay: (params) =>
    axiosClient.get('/queues/display', { params }),
}

export default queueApi
