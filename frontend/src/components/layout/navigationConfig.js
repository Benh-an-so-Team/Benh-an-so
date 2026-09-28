import {
  AppstoreOutlined,
  AuditOutlined,
  CalendarOutlined,
  CloudServerOutlined,
  CopyOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FormOutlined,
  HeartOutlined,
  HistoryOutlined,
  InboxOutlined,
  MedicineBoxOutlined,
  SettingOutlined,
  ShopOutlined,
  SolutionOutlined,
  TableOutlined,
  UserOutlined,
  EyeInvisibleOutlined,
  TeamOutlined,
  BellOutlined,
  BarChartOutlined,
  DollarCircleOutlined,
  PrinterOutlined,
  FileExcelOutlined,
  PercentageOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  SyncOutlined,
} from '@ant-design/icons'

export const roleNames = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  clinic_manager: 'Quản lý phòng khám',
  doctor: 'Bác sĩ',
  receptionist: 'Lễ tân',
  pharmacist: 'Dược sĩ',
}

export const navigationSections = [
  { key: 'overview', paths: ['/'] },
  { key: 'reception', label: 'Tiếp nhận & Chăm sóc', paths: ['/patients', '/patients/import', '/appointments', '/appointments/weekly-schedule', '/after-care', '/visit-summaries', '/doctor-schedules'] },
  { key: 'examination', label: 'Khám bệnh', paths: ['/medical-records', '/medical-records/overdue-signing', '/medical-records/version-history', '/medical-records/copy-issuance', '/medical-records/visit-summaries', '/prescriptions', '/clinical-orders', '/clinical-results', '/results'] },
  { key: 'pharmacy', label: 'Nhà thuốc', paths: ['/pharmacy', '/medicines', '/pharmacy/receipts', '/inventory/stock-report', '/pharmacy/special-control-register', '/pharmacy/procurement-plans', '/prescription-reconciliation'] },
  { key: 'finance', label: 'Tài chính', paths: ['/billing', '/invoices/lookup', '/cashier-shifts/close', '/cashier-shifts/history', '/invoices/discount-requests'] },
  { key: 'reports', label: 'Báo cáo', paths: ['/reports', '/reports/disease-patterns', '/reports/revenue-breakdown', '/reports/appointment-effectiveness'] },
  { key: 'system', label: 'Hệ thống & Bảng giá', paths: ['/users', '/services', '/system/specialties', '/system/clinical-services', '/system/diagnosis-catalog', '/system/medical-record-templates', '/system-management', '/admin/operation-logs', '/prescription-interconnections', '/system/anonymization', '/contraindication-rules', '/admin/sessions'] },
]

export const getNavigationItems = (rolesOrUser = [], permissionsArg = []) => {
  const isObjectArg = rolesOrUser && typeof rolesOrUser === 'object' && !Array.isArray(rolesOrUser)
  const roles = isObjectArg ? (rolesOrUser.roles || []) : rolesOrUser
  const permissions = isObjectArg ? (rolesOrUser.permissions || permissionsArg) : permissionsArg

  const normalizedRoles = (Array.isArray(roles) ? roles : [roles])
    .map((role) => String(role || '').toLowerCase().replace(/^role_/, ''))
    .filter(Boolean)
  const userPerms = (Array.isArray(permissions) ? permissions : [permissions])
    .map((perm) => String(perm || '').toUpperCase().replace(/^PERMISSION_/, ''))
    .filter(Boolean)

  const hasPerm = (code) => userPerms.includes(code)
  const hasRole = (r) => normalizedRoles.includes(r)
  const isAdmin = hasRole('admin')
  const isDoctor = hasRole('doctor')
  const isManager = hasRole('manager') || hasRole('clinic_manager')
  const isPharmacist = hasRole('pharmacist')
  const isReceptionist = hasRole('receptionist')

  const summaryKey = isReceptionist && !isDoctor && !isAdmin
    ? '/visit-summaries'
    : '/medical-records/visit-summaries'

  const items = [
    { key: '/', label: 'Tổng quan', icon: DashboardOutlined, check: () => hasPerm('DASHBOARD_OPERATIONAL_READ') || isAdmin || isManager },
    { key: '/patients', label: 'Quản lý hồ sơ bệnh nhân', icon: UserOutlined, check: () => !isAdmin && (hasPerm('PATIENT_READ') || hasPerm('PATIENT_CREATE') || isDoctor || isReceptionist || isManager) },
    { key: '/patients/import', label: 'Nhập hồ sơ từ Excel', icon: FileExcelOutlined, check: () => (hasPerm('PATIENT_IMPORT') || isAdmin || isReceptionist) && !isDoctor && !isPharmacist },
    { key: '/appointments', label: 'Lịch hẹn và hàng đợi khám', icon: CalendarOutlined, check: () => !isAdmin && !isManager && (hasPerm('APPOINTMENT_READ') || hasPerm('APPOINTMENT_CREATE') || isDoctor || isReceptionist) },
    { key: '/appointments/weekly-schedule', label: 'Lịch tuần theo bác sĩ', icon: TableOutlined, check: () => !isAdmin && !isDoctor && (isReceptionist || isManager || hasPerm('APPOINTMENT_READ')) },
    { key: '/after-care', label: 'Chăm sóc sau khám', icon: HeartOutlined, check: () => !isAdmin && !isDoctor && !isManager && (hasPerm('FOLLOW_UP_REMINDER_READ') || hasPerm('CARE_LOG_READ') || isReceptionist) },
    { key: '/doctor-schedules', label: 'Lịch làm việc bác sĩ', icon: CalendarOutlined, check: () => !isReceptionist && !isPharmacist && !isDoctor && (isAdmin || isManager || hasPerm('DOCTOR_SCHEDULE_UPDATE')) },
    { key: '/medical-records', label: 'Khám bệnh & Bệnh án', icon: SolutionOutlined, check: () => !isAdmin && !isManager && (hasPerm('MEDICAL_RECORD_READ') || hasPerm('MEDICAL_RECORD_CREATE') || isDoctor) },
    { key: '/medical-records/overdue-signing', label: isDoctor ? 'Bệnh án quá hạn ký' : 'Nhắc ký bệnh án quá hạn', icon: BellOutlined, check: () => (isAdmin || isManager || isDoctor || hasPerm('MEDICAL_RECORD_OVERDUE_READ')) && !isReceptionist && !isPharmacist },
    { key: '/medical-records/version-history', label: 'Lịch sử phiên bản bệnh án', icon: HistoryOutlined, check: () => isAdmin || isManager || hasPerm('MEDICAL_RECORD_VERSION_HISTORY_READ') || hasPerm('AUDIT_READ') },
    { key: '/medical-records/copy-issuance', label: 'Cấp bản sao hồ sơ', icon: CopyOutlined, check: () => isAdmin || isManager || hasPerm('REPORT_EXPORT') },
    { key: summaryKey, label: 'Phiếu tóm tắt lượt khám', icon: PrinterOutlined, check: () => hasPerm('VISIT_SUMMARY_PRINT') || isAdmin || isDoctor || isReceptionist || isManager },
    { key: '/prescriptions', label: 'Kê đơn thuốc', icon: FormOutlined, check: () => !isAdmin && !isManager && (hasPerm('PRESCRIPTION_READ') || hasPerm('PRESCRIPTION_CREATE') || isDoctor) },
    { key: '/clinical-orders', label: 'Theo dõi chỉ định CĐLS', icon: ExperimentOutlined, check: () => !isAdmin && !isManager && (hasPerm('CLINICAL_ORDER_READ') || isDoctor) },
    { key: '/clinical-results', label: 'Nhập kết quả CĐLS', icon: FileTextOutlined, check: () => !isAdmin && !isManager && (hasPerm('CLINICAL_RESULT_READ') || hasPerm('CLINICAL_RESULT_CREATE') || isDoctor) },
    { key: '/pharmacy', label: 'Cấp phát thuốc', icon: MedicineBoxOutlined, check: () => !isAdmin && !isDoctor && !isManager && (hasPerm('PHARMACY_READ') || isPharmacist) },
    { key: '/medicines', label: 'Danh mục & Ngưỡng tồn', icon: ShopOutlined, check: () => !isAdmin && !isDoctor && !isManager && (hasPerm('PHARMACY_READ') || isPharmacist) },
    { key: '/pharmacy/receipts', label: 'Nhập kho theo lô', icon: InboxOutlined, check: () => !isAdmin && !isDoctor && !isManager && (hasPerm('PHARMACY_CREATE') || isPharmacist) },
    { key: '/inventory/stock-report', label: 'Báo cáo xuất nhập tồn', icon: BarChartOutlined, check: () => !isDoctor && !isReceptionist && (hasPerm('INVENTORY_REPORT_VIEW') || isPharmacist || isManager || isAdmin) },
    { key: '/pharmacy/special-control-register', label: 'Sổ theo dõi thuốc KSĐB', icon: AuditOutlined, check: () => isPharmacist || isDoctor || isAdmin },
    { key: '/pharmacy/procurement-plans', label: 'Dự trù mua thuốc', icon: ShoppingCartOutlined, check: () => !isDoctor && !isReceptionist && (hasPerm('MEDICATION_PROCUREMENT_READ') || isPharmacist || isManager || isAdmin) },
    { key: '/prescription-reconciliation', label: 'Đối chiếu đơn liên thông', icon: SyncOutlined, check: () => hasPerm('PRESCRIPTION_RECONCILIATION_VIEW') || isAdmin || isPharmacist },
    { key: '/billing', label: 'Thu phí & hóa đơn', icon: FileTextOutlined, check: () => !isAdmin && !isDoctor && (hasPerm('INVOICE_READ') || hasPerm('INVOICE_CREATE') || isManager || isReceptionist) },
    { key: '/invoices/discount-requests', label: 'Duyệt giảm giá & miễn phí', icon: PercentageOutlined, check: () => !isDoctor && !isPharmacist && (hasPerm('INVOICE_READ') || isReceptionist || isManager || isAdmin) },
    { key: '/invoices/lookup', label: 'Tra cứu & in lại hóa đơn', icon: PrinterOutlined, check: () => !isDoctor && !isPharmacist && (hasPerm('INVOICE_READ') || isReceptionist || isManager || isAdmin) },
    { key: '/reports', label: 'Báo cáo vận hành', icon: FileTextOutlined, check: () => hasPerm('REPORT_VIEW') || isAdmin || isManager },
    { key: '/reports/disease-patterns', label: 'Mô hình bệnh tật', icon: BarChartOutlined, check: () => isManager && !isAdmin },
    { key: '/reports/revenue-breakdown', label: 'Doanh thu theo dịch vụ & bác sĩ', icon: DollarCircleOutlined, check: () => isManager && !isAdmin },
    { key: '/reports/appointment-effectiveness', label: 'Hiệu quả lịch hẹn', icon: CalendarOutlined, check: () => isManager && !isAdmin },
    { key: '/users', label: 'Quản trị tài khoản', icon: TeamOutlined, check: () => isAdmin },
    { key: '/services', label: 'Danh mục dịch vụ & giá', icon: AppstoreOutlined, check: () => hasPerm('SERVICE_CATALOG_READ') || isAdmin || isManager },
    { key: '/system/clinical-services', label: 'Danh mục cận lâm sàng & ngưỡng', icon: ExperimentOutlined, check: () => hasPerm('CLINICAL_SERVICE_MANAGE') || isAdmin },
    { key: '/system/diagnosis-catalog', label: 'Danh mục mã bệnh (ICD-10)', icon: ExperimentOutlined, check: () => hasPerm('DIAGNOSIS_CATALOG_MANAGE') || isAdmin },
    { key: '/system/medical-record-templates', label: 'Mẫu bệnh án chuyên khoa', icon: FileTextOutlined, check: () => hasPerm('MEDICAL_RECORD_TEMPLATE_MANAGE') || isAdmin },
    { key: '/system/specialties', label: 'Danh mục chuyên khoa & phòng khám', icon: MedicineBoxOutlined, check: () => hasPerm('SPECIALTY_MANAGE') || isAdmin },
    { key: '/system-management', label: 'Quản trị hệ thống', icon: SettingOutlined, check: () => isAdmin },
    { key: '/admin/operation-logs', label: 'Nhật ký thao tác', icon: AuditOutlined, check: () => !isDoctor && !isReceptionist && !isPharmacist && (isAdmin || isManager || hasPerm('ADMIN_OPERATION_LOG_READ')) },
    { key: '/admin/sessions', label: 'Quản lý phiên làm việc', icon: SafetyCertificateOutlined, check: () => hasPerm('SESSION_READ') || isAdmin },
    { key: '/prescription-interconnections', label: 'Liên thông đơn thuốc', icon: CloudServerOutlined, check: () => hasPerm('PRESCRIPTION_INTERCONNECTION_READ') || isAdmin },
    { key: '/system/anonymization', label: 'Chế độ ẩn danh dữ liệu', icon: EyeInvisibleOutlined, check: () => hasPerm('SYSTEM_CONFIG_READ') || isAdmin },
    { key: '/contraindication-rules', label: 'Quy tắc chống chỉ định', icon: MedicineBoxOutlined, check: () => hasPerm('CONTRAINDICATION_RULE_MANAGE') || isAdmin },
    { key: '/cashier-shifts/close', label: 'Chốt ca thu ngân', icon: DollarCircleOutlined, check: () => hasPerm('CASHIER_SHIFT_CREATE') || isReceptionist || isAdmin },
    { key: '/cashier-shifts/history', label: 'Lịch sử chốt ca', icon: HistoryOutlined, check: () => hasPerm('CASHIER_SHIFT_READ') || isReceptionist || isManager || isAdmin },
  ]

  return items.filter((item) => item.check())
}

export { getDefaultHomePath } from '../../utils/roleRouting.js'
