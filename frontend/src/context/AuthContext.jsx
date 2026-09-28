import React, { createContext, useState, useContext, useEffect } from 'react'
import authApi, { parseRetryAfterSeconds, isLockoutError } from '../api/authApi.js'

const AuthContext = createContext(null)

const normalizeRoles = (rawRoles) => {
  if (!rawRoles) return []
  const arr = Array.isArray(rawRoles) ? rawRoles : [rawRoles]
  const normalized = new Set()
  arr.forEach((r) => {
    if (!r) return
    const str = String(r).toLowerCase()
    const clean = str.replace(/^role_/, '')
    normalized.add(clean)
    normalized.add(`role_${clean}`)
    if (clean === 'clinic_manager') {
      normalized.add('manager')
      normalized.add('role_manager')
    }
  })
  return Array.from(normalized)
}

const normalizePermissions = (rawPermissions) => {
  if (!rawPermissions) return []
  const permissions = Array.isArray(rawPermissions) ? rawPermissions : [rawPermissions]
  return Array.from(new Set(permissions
    .map((permission) => String(permission || '').toUpperCase().replace(/^PERMISSION_/, ''))
    .filter(Boolean)))
}

const getJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = window.atob(payloadBase64)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')
    if (storedUser && storedToken) {
      try {
        const payload = getJwtPayload(storedToken)
        if (payload && payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('user')
          localStorage.removeItem('token')
          setUser(null)
        } else {
          const parsed = JSON.parse(storedUser)
          if (parsed && typeof parsed === 'object') {
            const tokenRole = payload?.role || payload?.roles || parsed.roles || parsed.role
            const tokenUsername = payload?.username || parsed.username
            parsed.username = tokenUsername || parsed.username
            parsed.fullName = tokenUsername || parsed.fullName || parsed.username
            parsed.roles = normalizeRoles(tokenRole)
            parsed.permissions = normalizePermissions(payload?.permissions || parsed.permissions)
            parsed.mustChangePassword = Boolean(parsed.mustChangePassword)
            localStorage.setItem('user', JSON.stringify(parsed))
            setUser(parsed)
          } else {
            localStorage.removeItem('user')
            localStorage.removeItem('token')
            setUser(null)
          }
        }
      } catch (e) {
        console.warn('Invalid user data in localStorage, resetting...', e)
        localStorage.removeItem('user')
        localStorage.removeItem('token')
        setUser(null)
      }
    } else if (storedToken && !storedUser) {
      const payload = getJwtPayload(storedToken)
      if (payload && (payload.role || payload.sub)) {
        const reconstructedUser = {
          id: payload.userId || payload.sub,
          username: payload.username || 'User',
          fullName: payload.username || 'User',
          roles: normalizeRoles(payload.role),
          permissions: normalizePermissions(payload.permissions),
        }
        localStorage.setItem('user', JSON.stringify(reconstructedUser))
        setUser(reconstructedUser)
      }
    }
    setLoading(false)
  }, [])

  const handleLoginSuccess = (data, fallbackUsername) => {
    const payload = getJwtPayload(data.accessToken)
    const rawRoles = payload?.role || data.roles || (data.role ? [data.role] : [])
    const username = payload?.username || data.username || fallbackUsername

    const normalizedUser = {
      id: data.userId || data.id || payload?.userId || payload?.sub,
      username: username,
      fullName: username,
      roles: normalizeRoles(rawRoles),
      permissions: normalizePermissions(payload?.permissions || data.permissions),
      expiredAt: data.expiredAt,
      mustChangePassword: Boolean(data.mustChangePassword),
    }

    localStorage.setItem('token', data.accessToken)
    localStorage.setItem('user', JSON.stringify(normalizedUser))
    setUser(normalizedUser)

    return { success: true, user: normalizedUser }
  }

  const completeTwoFactorLogin = (data) => {
    return handleLoginSuccess(data, data?.username || 'User')
  }

  const login = async (credentials) => {
    try {
      const response = await authApi.login(credentials)
      const data = response.data

      if (data?.twoFactorRequired) {
        return {
          success: true,
          twoFactorRequired: true,
          twoFactorToken: data.twoFactorToken,
          twoFactorExpiresAt: data.twoFactorExpiresAt,
          username: data.username || credentials.username,
        }
      }

      return handleLoginSuccess(data, credentials.username)
    } catch (error) {
      const status = error.response?.status
      const isLockout = isLockoutError(error)
      const retryAfterSeconds = parseRetryAfterSeconds(error)
      const errorData = error.response?.data
      const errorCode = errorData?.code || error.apiError?.code
      const isTempPasswordExpired = errorCode === 'TEMP_PASSWORD_EXPIRED'

      let message = ''
      if (isLockout) {
        message =
          retryAfterSeconds > 0
            ? `Tài khoản tạm khóa. Vui lòng thử lại sau ${retryAfterSeconds} giây.`
            : 'Tài khoản tạm khóa. Vui lòng thử lại sau.'
      } else if (isTempPasswordExpired) {
        message = 'Mật khẩu tạm thời đã hết hạn. Vui lòng liên hệ Quản trị viên để được cấp lại.'
      } else if (status === 403) {
        message = 'Tài khoản đã bị vô hiệu hóa / khóa. Vui lòng liên hệ quản trị viên.'
      } else if (errorData?.message) {
        message = errorData.message
      } else if (status === 500) {
        message = 'Máy chủ Backend đang bị lỗi hoặc chưa sẵn sàng kết nối (Lỗi 500)'
      } else if (status === 401) {
        message = 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      } else {
        message = error.message || 'Tên đăng nhập hoặc mật khẩu không đúng'
      }

      return {
        success: false,
        status,
        errorCode,
        isLockout,
        isTempPasswordExpired,
        retryAfterSeconds,
        data: errorData,
        error,
        message,
      }
    }
  }

  const patientLogin = async (credentials) => {
    try {
      const response = await authApi.patientLogin(credentials)
      const data = response.data

      const payload = getJwtPayload(data.accessToken)
      const rawRoles = payload?.role || (data.role ? [data.role] : ['PATIENT'])
      const username = payload?.username || data.username || credentials.phone

      const normalizedUser = {
        id: data.userId || payload?.userId || payload?.sub,
        patientId: data.patientId || payload?.patientId,
        patientCode: data.patientCode || payload?.patientCode || null,
        username: username,
        fullName: username,
        roles: normalizeRoles(rawRoles),
        permissions: normalizePermissions(payload?.permissions || []),
        expiredAt: data.expiredAt,
        refreshToken: data.refreshToken,
      }

      localStorage.setItem('token', data.accessToken)
      localStorage.setItem('user', JSON.stringify(normalizedUser))
      setUser(normalizedUser)

      return { success: true, data: normalizedUser }
    } catch (error) {
      const status = error.response?.status
      const errorData = error.response?.data
      const isLockout = isLockoutError(error)
      const retryAfterSeconds = parseRetryAfterSeconds(error) || (status === 429 ? 60 : 0)
      return {
        success: false,
        status,
        isLockout,
        retryAfterSeconds,
        data: errorData,
        error,
        message:
          isLockout
            ? (retryAfterSeconds > 0
                ? `Tài khoản tạm khóa. Vui lòng thử lại sau ${retryAfterSeconds} giây.`
                : 'Tài khoản tạm khóa. Vui lòng thử lại sau.')
            : status === 403
              ? 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ phòng khám để được hỗ trợ.'
              : status === 401 || status === 400
                ? (errorData?.message || 'Số điện thoại hoặc mật khẩu không đúng.')
                : (error.message || 'Không thể kết nối đến máy chủ.'),
      }
    }
  }

  const patientRegister = async (registrationData) => {
    try {
      const response = await authApi.patientRegister(registrationData)
      const data = response.data
      return { success: true, data }
    } catch (error) {
      const status = error.response?.status
      const errorData = error.response?.data
      const rawMessage = errorData?.message || error.message
      const friendlyMessage = rawMessage === 'Validation failed.'
        ? 'Dữ liệu đăng ký chưa hợp lệ.'
        : (rawMessage || 'Đăng ký không thành công.')
      return {
        success: false,
        status,
        data: errorData,
        error,
        message: friendlyMessage,
      }
    }
  }

  const updateCurrentUserPermissions = (newPermissions) => {
    if (!user) return
    const normalized = normalizePermissions(newPermissions)
    const updated = {
      ...user,
      permissions: normalized,
    }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  // Session idle timeout and warning countdown is handled dynamically by SessionTimeoutWarningModal (NCL-01-CN-007)

  const updateMustChangePassword = (val) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, mustChangePassword: Boolean(val) }
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    const handleMustChangePassword = () => {
      setUser((prev) => {
        if (!prev) return prev
        const updated = { ...prev, mustChangePassword: true }
        localStorage.setItem('user', JSON.stringify(updated))
        return updated
      })
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('auth:must-change-password', handleMustChangePassword)
      return () => {
        window.removeEventListener('auth:must-change-password', handleMustChangePassword)
      }
    }
    return undefined
  }, [])

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      login,
      completeTwoFactorLogin,
      patientLogin,
      patientRegister,
      logout,
      loading,
      isAuthenticated,
      updateCurrentUserPermissions,
      updateMustChangePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
