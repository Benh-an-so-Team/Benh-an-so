import axios from 'axios'
import { normalizeApiError } from '../utils/apiError.js'

if (typeof import.meta.env === 'undefined') {
  import.meta.env = (typeof globalThis !== 'undefined' && globalThis.process?.env) ? globalThis.process.env : {}
}

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

const publicApiClient = axios.create({
  baseURL: configuredBaseUrl || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

publicApiClient.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

publicApiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error && typeof error === 'object') {
      error.apiError = normalizeApiError(error)
    }
    return Promise.reject(error)
  }
)

export default publicApiClient

