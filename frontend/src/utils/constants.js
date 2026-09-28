export const API_TIMEOUT = 60000


export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
]

export const RECORD_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Bản nháp', color: 'default' },
  { value: 'OPEN', label: 'Đang mở', color: 'processing' },
  { value: 'SIGNED', label: 'Đã ký', color: 'cyan' },
  { value: 'LOCKED', label: 'Đã khóa', color: 'green' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ', color: 'purple' },
  { value: 'NEW', label: 'Mới', color: 'blue' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý', color: 'orange' },
  { value: 'COMPLETED', label: 'Hoàn thành', color: 'green' },
  { value: 'CANCELLED', label: 'Đã hủy', color: 'red' },
]

export const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Quản trị viên' },
  { value: 'DOCTOR', label: 'Bác sĩ' },
  { value: 'RECEPTIONIST', label: 'Lễ tân' },
  { value: 'PHARMACIST', label: 'Dược sĩ' },
  { value: 'STAFF', label: 'Nhân viên' },
]

export const ROLE_COLORS = {
  ADMIN: '#f5222d',
  DOCTOR: '#1890ff',
  RECEPTIONIST: '#faad14',
  PHARMACIST: '#722ed1',
  STAFF: '#8c8c8c',
}

export const PERMISSION_LABELS = {
  USER_CREATE: 'Tạo người dùng',
  USER_READ: 'Xem người dùng',
  USER_UPDATE: 'Cập nhật người dùng',
  USER_DELETE: 'Xóa người dùng',
  USER_ASSIGN_ROLE: 'Gán vai trò',
  PATIENT_CREATE: 'Tạo bệnh nhân',
  PATIENT_READ: 'Xem bệnh nhân',
  PATIENT_UPDATE: 'Cập nhật bệnh nhân',
  PATIENT_DELETE: 'Xóa bệnh nhân',
  RECORD_CREATE: 'Tạo hồ sơ bệnh án',
  RECORD_READ: 'Xem hồ sơ bệnh án',
  RECORD_UPDATE: 'Cập nhật hồ sơ bệnh án',
  RECORD_DELETE: 'Xóa hồ sơ bệnh án',
  RECORD_UPDATE_STATUS: 'Cập nhật trạng thái',
  MEDICAL_RECORD_CREATE: 'Tạo hồ sơ bệnh án',
  MEDICAL_RECORD_READ: 'Xem hồ sơ bệnh án',
  MEDICAL_RECORD_UPDATE: 'Cập nhật hồ sơ bệnh án',
  MEDICAL_RECORD_DELETE: 'Xóa hồ sơ bệnh án',
  MEDICAL_RECORD_UPDATE_STATUS: 'Lưu trữ / Đổi trạng thái bệnh án',
  CLINIC_CONFIGURATION_READ: 'Xem cấu hình phòng khám',
  CLINIC_CONFIGURATION_UPDATE: 'Cập nhật cấu hình phòng khám',
  PRESCRIPTION_CREATE: 'Tạo đơn thuốc',
  PRESCRIPTION_READ: 'Xem đơn thuốc',
  PRESCRIPTION_UPDATE: 'Cập nhật đơn thuốc',
  PRESCRIPTION_DELETE: 'Xóa đơn thuốc',
  PRESCRIPTION_UPDATE_STATUS: 'Duyệt đơn thuốc',
  APPOINTMENT_CREATE: 'Tạo lịch hẹn',
  APPOINTMENT_READ: 'Xem lịch hẹn',
  APPOINTMENT_UPDATE: 'Cập nhật lịch hẹn',
  APPOINTMENT_DELETE: 'Xóa lịch hẹn',
  VITAL_SIGN_CREATE: 'Ghi dấu hiệu sinh tồn',
  VITAL_SIGN_READ: 'Xem dấu hiệu sinh tồn',
  VITAL_SIGN_UPDATE: 'Cập nhật dấu hiệu sinh tồn',
  DIAGNOSIS_CREATE: 'Tạo chẩn đoán',
  DIAGNOSIS_READ: 'Xem chẩn đoán',
  DIAGNOSIS_UPDATE: 'Cập nhật chẩn đoán',
  PHARMACY_CREATE: 'Nhập kho',
  PHARMACY_READ: 'Xem kho thuốc',
  PHARMACY_UPDATE: 'Cập nhật kho',
  PHARMACY_DELETE: 'Xóa khỏi kho',
  INVOICE_CREATE: 'Tạo hóa đơn',
  INVOICE_READ: 'Xem hóa đơn',
  INVOICE_UPDATE: 'Cập nhật hóa đơn',
  INVOICE_DELETE: 'Xóa hóa đơn',
  AUDIT_READ: 'Xem nhật ký',
  ROLE_READ: 'Xem vai trò',
  ROLE_CREATE: 'Tạo vai trò',
  ROLE_UPDATE: 'Cập nhật vai trò',
  ROLE_DELETE: 'Xóa vai trò',
  PERMISSION_READ: 'Xem quyền',
}

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
