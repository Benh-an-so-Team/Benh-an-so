import axios from 'axios'
import { normalizeApiError } from '../utils/apiError.js'
import { API_TIMEOUT } from '../utils/constants.js'

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

const axiosClient = axios.create({
  baseURL: configuredBaseUrl || 'http://localhost:8080/api/v1',
  timeout: API_TIMEOUT || 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

axiosClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error && typeof error === 'object') {
      error.apiError = normalizeApiError(error)
    }
    const errorCode = error.response?.data?.code || error.apiError?.code
    if (error.response?.status === 403 && errorCode === 'MUST_CHANGE_PASSWORD') {
      try {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          const parsed = JSON.parse(storedUser)
          if (parsed && typeof parsed === 'object') {
            parsed.mustChangePassword = true
            localStorage.setItem('user', JSON.stringify(parsed))
          }
        }
      } catch {
        // ignore parse error
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('auth:must-change-password'))
      }
    } else if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (
        typeof window !== 'undefined' &&
        window.location?.pathname?.startsWith('/portal') &&
        window.location.pathname !== '/portal/login' &&
        window.location.pathname !== '/portal' &&
        window.location.pathname !== '/portal/register'
      ) {
        window.location.href = '/portal/login'
      } else if (
        typeof window !== 'undefined' &&
        !window.location?.pathname?.startsWith('/portal') &&
        window.location?.pathname !== '/login'
      ) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default axiosClient

