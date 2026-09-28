import axiosClient from './axiosClient.js'

const sessionApi = {
  /**
   * GET /admin/sessions
   * Requires permission: SESSION_READ (Admin only)
   */
  getActiveSessions: (params = {}) => {
    return axiosClient.get('/admin/sessions', {
      params: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'lastUsedAt,desc',
        ...params,
      },
    })
  },

  /**
   * POST /admin/sessions/{id}/terminate
   * Requires permission: SESSION_TERMINATE (Admin only)
   */
  terminateSession: (sessionId) => {
    return axiosClient.post(`/admin/sessions/${sessionId}/terminate`)
  },

  /**
   * POST /auth/sessions/current/extend
   * Extends the currently authenticated session by resetting lastUsedAt
   */
  extendCurrentSession: () => {
    return axiosClient.post('/auth/sessions/current/extend')
  },

  /**
   * GET /system/clinic
   * Retrieves clinic configuration including sessionIdleTimeoutMinutes
   */
  getClinicConfiguration: () => {
    return axiosClient.get('/system/clinic')
  },

  /**
   * PUT /system/clinic
   * Updates clinic configuration
   */
  updateClinicConfiguration: (data) => {
    return axiosClient.put('/system/clinic', data)
  },

  /**
   * Helper to specifically update sessionIdleTimeoutMinutes while preserving other clinic settings
   */
  updateSessionIdleTimeout: async (minutes) => {
    const currentRes = await axiosClient.get('/system/clinic')
    const currentConfig = currentRes.data || {}

    const payload = {
      clinicName: currentConfig.clinicName || 'Phòng khám đa khoa',
      address: currentConfig.address || '',
      phone: currentConfig.phone || '',
      openingTime: currentConfig.openingTime || '07:30:00',
      closingTime: currentConfig.closingTime || '17:30:00',
      retentionYears: currentConfig.retentionYears || 10,
      signingDeadlineHours: currentConfig.signingDeadlineHours || 24,
      activeRecordDurationMonths: currentConfig.activeRecordDurationMonths || 12,
      sessionIdleTimeoutMinutes: minutes,
    }

    return axiosClient.put('/system/clinic', payload)
  },
}

export default sessionApi
