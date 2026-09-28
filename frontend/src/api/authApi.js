import axiosClient from './axiosClient.js'

export const parseRetryAfterSeconds = (error) => {
  if (!error) return 0

  const bodySeconds =
    error.response?.data?.details?.retryAfterSeconds ??
    error.response?.data?.retryAfterSeconds ??
    error.apiError?.details?.retryAfterSeconds
  if (bodySeconds !== undefined && bodySeconds !== null && !isNaN(Number(bodySeconds))) {
    return Math.max(0, Math.ceil(Number(bodySeconds)))
  }

  const headerVal =
    error.response?.headers?.['retry-after'] ||
    (typeof error.response?.headers?.get === 'function' ? error.response.headers.get('retry-after') : null)
  if (headerVal !== undefined && headerVal !== null && !isNaN(Number(headerVal))) {
    return Math.max(0, Math.ceil(Number(headerVal)))
  }

  const msg = error.response?.data?.message || error.message || ''
  const match = typeof msg === 'string' && msg.match(/(\d+)\s*giây/i)
  if (match && match[1]) {
    return Math.max(0, parseInt(match[1], 10))
  }

  return 0
}

export const isLockoutError = (error) => {
  if (!error) return false
  const status = error.response?.status || error.status || error.apiError?.status
  const code = error.response?.data?.code || error.code || error.apiError?.code
  return status === 429 || code === 'TOO_MANY_LOGIN_ATTEMPTS' || code === 'ACCOUNT_LOCKED'
}

const authApi = {
  login: (credentials) => {
    return axiosClient.post('/auth/login', credentials)
  },
  patientLogin: (credentials) => {
    return axiosClient.post('/auth/patient/login', credentials)
  },
  patientRegister: (data) => {
    return axiosClient.post('/auth/patient/register', data)
  },
  patientForgotPassword: (phone) => {
    return axiosClient.post('/auth/patient/forgot-password', { phone })
  },
  patientVerifyRecoveryCode: (phone, code) => {
    return axiosClient.post('/auth/patient/verify-recovery-code', { phone, code })
  },
  patientResetPassword: (data) => {
    return axiosClient.post('/auth/patient/reset-password', data)
  },
  changePassword: (data) => {
    return axiosClient.post('/auth/change-password', data)
  },
  parseRetryAfterSeconds,
  isLockoutError,
}

export default authApi
