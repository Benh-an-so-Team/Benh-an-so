export const getDefaultHomePath = (roles = [], permissions = []) => {
  const normalizedRoles = (Array.isArray(roles) ? roles : [roles])
    .map((role) => String(role || '').toLowerCase().replace(/^role_/, ''))
    .filter(Boolean)
  const userPerms = (Array.isArray(permissions) ? permissions : [permissions])
    .map((perm) => String(perm || '').toUpperCase().replace(/^PERMISSION_/, ''))
    .filter(Boolean)

  const hasPerm = (code) => userPerms.includes(code)
  const hasRole = (r) => normalizedRoles.includes(r)

  if (
    hasPerm('DASHBOARD_OPERATIONAL_READ') ||
    hasRole('admin') ||
    hasRole('manager') ||
    hasRole('clinic_manager')
  ) {
    return '/'
  }

  if (hasRole('doctor')) {
    return '/doctor/dashboard'
  }

  if (hasPerm('MEDICAL_RECORD_READ') || hasPerm('MEDICAL_RECORD_CREATE')) {
    return '/medical-records'
  }

  if (hasRole('receptionist') || hasPerm('APPOINTMENT_READ') || hasPerm('PATIENT_READ')) {
    return '/appointments'
  }

  if (hasRole('pharmacist') || hasPerm('PHARMACY_READ')) {
    return '/pharmacy'
  }

  if (hasRole('patient')) {
    return '/portal/dashboard'
  }

  return '/login'
}
