import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Alert } from 'antd'
import { useAuthContext } from '../context/AuthContext'
import MainLayout from '../components/layout/MainLayout'
import { getDefaultHomePath } from '../utils/roleRouting'

import PatientRoute from '../components/common/PatientRoute'

const Login = React.lazy(() => import('../pages/Login'))
const TwoFactorVerifyPage = React.lazy(() => import('../pages/TwoFactorVerifyPage.jsx'))
const PortalLogin = React.lazy(() => import('../pages/PortalLogin'))
const PortalRegister = React.lazy(() => import('../pages/PortalRegister'))
const PortalDashboard = React.lazy(() => import('../pages/PortalDashboard'))
const PatientPortalBookingPage = React.lazy(() => import('../pages/PatientPortalBookingPage'))
const PatientMyAppointmentsPage = React.lazy(() => import('../pages/PatientMyAppointmentsPage'))
const PatientMedicalHistoryPage = React.lazy(() => import('../pages/PatientMedicalHistoryPage'))
const PatientMyInvoicesPage = React.lazy(() => import('../pages/PatientMyInvoicesPage'))
const PatientMyClinicalResultsPage = React.lazy(() => import('../pages/PatientMyClinicalResultsPage'))
const Dashboard = React.lazy(() => import('../pages/Dashboard'))
const PatientList = React.lazy(() => import('../pages/PatientList'))
const PatientImportPage = React.lazy(() => import('../pages/PatientImportPage'))
const PatientDetail = React.lazy(() => import('../pages/PatientDetail'))
const AppointmentQueue = React.lazy(() => import('../pages/AppointmentQueue'))
const AfterCarePage = React.lazy(() => import('../pages/AfterCarePage'))
const MedicalEncounter = React.lazy(() => import('../pages/MedicalEncounter'))
const PrescriptionPage = React.lazy(() => import('../pages/PrescriptionPage'))
const PharmacyPage = React.lazy(() => import('../pages/PharmacyPage'))
const InventoryReceiptPage = React.lazy(() => import('../pages/InventoryReceiptPage'))
const MedicineCatalogPage = React.lazy(() => import('../pages/MedicineCatalogPage'))
const SpecialControlledDrugRegisterPage = React.lazy(() => import('../pages/SpecialControlledDrugRegisterPage'))
const MedicationProcurementPage = React.lazy(() => import('../pages/MedicationProcurementPage'))
const BillingPage = React.lazy(() => import('../pages/BillingPage'))
const UnpaidVisitsPage = React.lazy(() => import('../pages/UnpaidVisitsPage'))
const InvoiceLookupPage = React.lazy(() => import('../pages/InvoiceLookupPage'))
const ReportsPage = React.lazy(() => import('../pages/ReportsPage'))
const UsersPage = React.lazy(() => import('../pages/UsersPage'))
const ServicesPage = React.lazy(() => import('../pages/ServicesPage'))
const ResultPage = React.lazy(() => import('../pages/ResultPage'))
const PublicLookupPage = React.lazy(() => import('../pages/PublicLookupPage'))
const SystemManagementPage = React.lazy(() => import('../pages/SystemManagementPage'))
const DiagnosisCatalogPage = React.lazy(() => import('../pages/DiagnosisCatalogPage'))
const ClinicalServiceManagementPage = React.lazy(() => import('../pages/ClinicalServiceManagementPage'))
const MedicalRecordTemplateManagementPage = React.lazy(() => import('../pages/MedicalRecordTemplateManagementPage'))
const SpecialtyManagementPage = React.lazy(() => import('../pages/SpecialtyManagementPage'))
const SessionManagementPage = React.lazy(() => import('../pages/SessionManagementPage'))
const BackupRestorePage = React.lazy(() => import('../pages/BackupRestorePage'))

const MedicalRecordAccessLogsPage = React.lazy(() => import('../pages/MedicalRecordAccessLogsPage'))
const MedicalRecordCopyPage = React.lazy(() => import('../pages/MedicalRecordCopyPage'))
const MedicalRecordVersionHistoryPage = React.lazy(() => import('../pages/MedicalRecordVersionHistoryPage'))
const OverdueMedicalRecordSigningPage = React.lazy(() => import('../pages/OverdueMedicalRecordSigningPage'))
const VisitSummaryManagementPage = React.lazy(() => import('../pages/VisitSummaryManagementPage.jsx'))
const PrescriptionInterconnectionPage = React.lazy(() => import('../pages/PrescriptionInterconnectionPage'))
const DoctorScheduleManagementPage = React.lazy(() => import('../pages/DoctorScheduleManagementPage'))
const DoctorWeeklySchedulePage = React.lazy(() => import('../pages/DoctorWeeklySchedulePage'))
const AnonymizationPage = React.lazy(() => import('../pages/AnonymizationPage'))
const PendingClinicalOrdersPage = React.lazy(() => import('../pages/PendingClinicalOrdersPage'))
const AdminOperationLogPage = React.lazy(() => import('../pages/AdminOperationLogPage'))
const DiseasePatternReportPage = React.lazy(() => import('../pages/DiseasePatternReportPage'))
const RevenueBreakdownReportPage = React.lazy(() => import('../pages/RevenueBreakdownReportPage'))
const AppointmentEffectivenessReportPage = React.lazy(() => import('../pages/AppointmentEffectivenessReportPage.jsx'))
const InventoryStockReportPage = React.lazy(() => import('../pages/InventoryStockReportPage.jsx'))
const ContraindicationRuleManagementPage = React.lazy(() => import('../pages/ContraindicationRuleManagementPage'))
const CashierShiftClosingPage = React.lazy(() => import('../pages/CashierShiftClosingPage.jsx'))
const CashierShiftHistoryPage = React.lazy(() => import('../pages/CashierShiftHistoryPage.jsx'))
const DiscountRequestManagementPage = React.lazy(() => import('../pages/DiscountRequestManagementPage.jsx'))
const WaitingRoomDisplayPage = React.lazy(() => import('../pages/WaitingRoomDisplayPage'))
const PrescriptionReconciliationPage = React.lazy(() => import('../pages/PrescriptionReconciliationPage'))
const NotFound = React.lazy(() => import('../pages/NotFound'))

const LazyPage = ({ children }) => (
  <React.Suspense fallback={null}>
    {children}
  </React.Suspense>
)

const PrivateRoute = ({ children, allowedRoles = [], allowedPermissions = [], disallowAdmin = false }) => {
  const { isAuthenticated, loading, user } = useAuthContext()

  if (loading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const userRoles = (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  const userPerms = (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))

  const isPatient = userRoles.includes('patient')
  if (isPatient) {
    return <Navigate to="/portal/dashboard" replace />
  }

  const isAdmin = userRoles.includes('admin')

  if (disallowAdmin && isAdmin) {
    const defaultHome = getDefaultHomePath(user?.roles, user?.permissions)
    return <Navigate to={defaultHome} replace />
  }

  const hasRoleMatch = allowedRoles.length > 0 && allowedRoles.some((role) =>
    userRoles.includes(String(role).toLowerCase().replace(/^role_/, ''))
  )

  const hasPermMatch = allowedPermissions.length > 0 && allowedPermissions.some((perm) =>
    userPerms.includes(String(perm).toUpperCase().replace(/^PERMISSION_/, ''))
  )


  if (allowedRoles.length === 0 && allowedPermissions.length === 0) {
    return children
  }

  if (isAdmin || hasPermMatch || hasRoleMatch) {
    return children
  }

  const defaultHome = getDefaultHomePath(user?.roles, user?.permissions)
  return <Navigate to={defaultHome} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LazyPage><Login /></LazyPage>} />
      <Route path="/login/verify-2fa" element={<LazyPage><TwoFactorVerifyPage /></LazyPage>} />
      <Route path="/portal/login" element={<LazyPage><PortalLogin /></LazyPage>} />
      <Route path="/portal/register" element={<LazyPage><PortalRegister /></LazyPage>} />
      <Route path="/portal/dashboard" element={<PatientRoute><LazyPage><PortalDashboard /></LazyPage></PatientRoute>} />
      <Route path="/portal/book-appointment" element={<PatientRoute><LazyPage><PatientPortalBookingPage /></LazyPage></PatientRoute>} />
      <Route path="/portal/my-appointments" element={<PatientRoute><LazyPage><PatientMyAppointmentsPage /></LazyPage></PatientRoute>} />
      <Route path="/portal/medical-history" element={<PatientRoute><LazyPage><PatientMedicalHistoryPage /></LazyPage></PatientRoute>} />
      <Route path="/portal/my-invoices" element={<PatientRoute><LazyPage><PatientMyInvoicesPage /></LazyPage></PatientRoute>} />
      <Route path="/portal/invoices" element={<Navigate to="/portal/my-invoices" replace />} />
      <Route path="/portal/my-clinical-results" element={<PatientRoute><LazyPage><PatientMyClinicalResultsPage /></LazyPage></PatientRoute>} />
      <Route path="/portal/clinical-results" element={<Navigate to="/portal/my-clinical-results" replace />} />
      <Route path="/public-lookup" element={<LazyPage><PublicLookupPage /></LazyPage>} />
      <Route path="/portal" element={<LazyPage><PublicLookupPage /></LazyPage>} />
      <Route path="/tra-cuu-ket-qua" element={<LazyPage><PublicLookupPage /></LazyPage>} />
      <Route path="/tra-cuu" element={<Navigate to="/portal" replace />} />

      {/* NCL-03-CN-014 / QTN-43: Màn hình hiển thị số thứ tự sảnh chờ công cộng (Kiosk/Smart TV) - PUBLIC ROUTE (permitAll), KHÔNG bọc PrivateRoute */}
      <Route path="/display/waiting-room" element={<LazyPage><WaitingRoomDisplayPage /></LazyPage>} />
      <Route path="/queues/display-board" element={<Navigate to="/display/waiting-room" replace />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<LazyPage><Dashboard /></LazyPage>} />
        <Route path="patients" element={<PrivateRoute allowedPermissions={['PATIENT_READ', 'PATIENT_CREATE', 'PATIENT_UPDATE']} allowedRoles={['admin', 'doctor', 'receptionist']}><LazyPage><PatientList /></LazyPage></PrivateRoute>} />
        <Route path="patients/import" element={<PrivateRoute allowedPermissions={['PATIENT_IMPORT']} allowedRoles={['admin', 'receptionist']}><LazyPage><PatientImportPage /></LazyPage></PrivateRoute>} />
        <Route path="patients/:id" element={<PrivateRoute allowedPermissions={['PATIENT_READ', 'PATIENT_CREATE', 'PATIENT_UPDATE']} allowedRoles={['admin', 'doctor', 'receptionist']}><LazyPage><PatientDetail /></LazyPage></PrivateRoute>} />
        <Route path="appointments" element={<PrivateRoute allowedPermissions={['APPOINTMENT_READ', 'APPOINTMENT_CREATE', 'APPOINTMENT_UPDATE', 'QUEUE_VIEW', 'QUEUE_CREATE']} allowedRoles={['admin', 'doctor', 'receptionist']}><LazyPage><AppointmentQueue /></LazyPage></PrivateRoute>} />
        <Route path="appointments/weekly-schedule" element={<PrivateRoute allowedRoles={['admin', 'receptionist', 'manager', 'clinic_manager']}><LazyPage><DoctorWeeklySchedulePage /></LazyPage></PrivateRoute>} />
        <Route path="doctor-weekly-schedule" element={<Navigate to="/appointments/weekly-schedule" replace />} />
        <Route path="doctor-schedules" element={<PrivateRoute allowedPermissions={['DOCTOR_SCHEDULE_UPDATE']} allowedRoles={['admin', 'manager', 'clinic_manager']}><LazyPage><DoctorScheduleManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="system/doctor-schedules" element={<Navigate to="/doctor-schedules" replace />} />
        <Route path="after-care" element={<PrivateRoute allowedPermissions={['FOLLOW_UP_REMINDER_READ', 'FOLLOW_UP_REMINDER_CREATE', 'CARE_LOG_READ', 'CARE_LOG_CREATE']} allowedRoles={['receptionist', 'admin']}><LazyPage><AfterCarePage /></LazyPage></PrivateRoute>} />
        <Route path="medical-records" element={<PrivateRoute allowedPermissions={['MEDICAL_RECORD_READ', 'MEDICAL_RECORD_CREATE', 'MEDICAL_RECORD_UPDATE']} allowedRoles={['admin', 'doctor']}><LazyPage><MedicalEncounter /></LazyPage></PrivateRoute>} />
        <Route path="medical-records/visits/:visitId" element={<PrivateRoute allowedPermissions={['MEDICAL_RECORD_READ', 'MEDICAL_RECORD_CREATE', 'MEDICAL_RECORD_UPDATE']} allowedRoles={['admin', 'doctor']}><LazyPage><MedicalEncounter /></LazyPage></PrivateRoute>} />
        <Route path="encounters/:visitId" element={<PrivateRoute allowedPermissions={['MEDICAL_RECORD_READ', 'MEDICAL_RECORD_CREATE', 'MEDICAL_RECORD_UPDATE']} allowedRoles={['admin', 'doctor']}><LazyPage><MedicalEncounter /></LazyPage></PrivateRoute>} />
        <Route path="encounters" element={<Navigate to="/medical-records" replace />} />
        <Route path="medical-records/copy-issuance" element={<PrivateRoute allowedPermissions={['REPORT_EXPORT']} allowedRoles={['admin', 'manager', 'clinic_manager']}><LazyPage><MedicalRecordCopyPage /></LazyPage></PrivateRoute>} />
        <Route path="medical-records/copies" element={<Navigate to="/medical-records/copy-issuance" replace />} />
        <Route path="medical-records/version-history" element={<PrivateRoute allowedPermissions={['MEDICAL_RECORD_VERSION_HISTORY_READ', 'AUDIT_READ']} allowedRoles={['admin', 'manager', 'clinic_manager']}><LazyPage><MedicalRecordVersionHistoryPage /></LazyPage></PrivateRoute>} />
        <Route path="medical-records/versions" element={<Navigate to="/medical-records/version-history" replace />} />
        <Route path="medical-records/visit-summaries" element={<PrivateRoute allowedPermissions={['VISIT_SUMMARY_PRINT']} allowedRoles={['admin', 'doctor', 'receptionist', 'manager', 'clinic_manager']}><LazyPage><VisitSummaryManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="visit-summaries" element={<PrivateRoute allowedPermissions={['VISIT_SUMMARY_PRINT']} allowedRoles={['admin', 'doctor', 'receptionist', 'manager', 'clinic_manager']}><LazyPage><VisitSummaryManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="visits/summary" element={<Navigate to="/medical-records/visit-summaries" replace />} />
        <Route path="medical-records/overdue-signing" element={<PrivateRoute allowedPermissions={['MEDICAL_RECORD_OVERDUE_READ', 'MEDICAL_RECORD_REMIND_SIGN']} allowedRoles={['admin', 'manager', 'clinic_manager', 'doctor']}><LazyPage><OverdueMedicalRecordSigningPage /></LazyPage></PrivateRoute>} />
        <Route path="overdue-signing" element={<Navigate to="/medical-records/overdue-signing" replace />} />
        <Route path="prescriptions" element={<PrivateRoute allowedPermissions={['PRESCRIPTION_READ', 'PRESCRIPTION_CREATE', 'PRESCRIPTION_UPDATE', 'PRESCRIPTION_PRINT']} allowedRoles={['admin', 'doctor']}><LazyPage><PrescriptionPage /></LazyPage></PrivateRoute>} />
        <Route path="prescriptions/:medicalRecordId" element={<PrivateRoute allowedPermissions={['PRESCRIPTION_READ', 'PRESCRIPTION_CREATE', 'PRESCRIPTION_UPDATE', 'PRESCRIPTION_PRINT']} allowedRoles={['admin', 'doctor']}><LazyPage><PrescriptionPage /></LazyPage></PrivateRoute>} />
        <Route path="clinical-orders" element={<PrivateRoute allowedPermissions={['CLINICAL_ORDER_READ', 'CLINICAL_ORDER_CANCEL']} allowedRoles={['admin', 'doctor']}><LazyPage><PendingClinicalOrdersPage /></LazyPage></PrivateRoute>} />
        <Route path="clinical-orders/pending" element={<Navigate to="/clinical-orders" replace />} />
        <Route path="clinical-results" element={<PrivateRoute allowedPermissions={['CLINICAL_RESULT_READ', 'CLINICAL_RESULT_CREATE', 'CLINICAL_RESULT_UPDATE']} allowedRoles={['admin', 'doctor']}><LazyPage><ResultPage /></LazyPage></PrivateRoute>} />
        <Route path="results" element={<Navigate to="/clinical-results" replace />} />
        <Route path="pharmacy" element={<PrivateRoute allowedPermissions={['PHARMACY_READ', 'PRESCRIPTION_READ']} allowedRoles={['admin', 'pharmacist']}><LazyPage><PharmacyPage /></LazyPage></PrivateRoute>} />
        <Route path="pharmacy/receipts" element={<PrivateRoute allowedPermissions={['PHARMACY_CREATE', 'PHARMACY_READ']} allowedRoles={['admin', 'pharmacist']}><LazyPage><InventoryReceiptPage /></LazyPage></PrivateRoute>} />
        <Route path="pharmacy/special-control-register" element={<PrivateRoute allowedPermissions={['PHARMACY_READ', 'PRESCRIPTION_READ']} allowedRoles={['admin', 'pharmacist', 'doctor']}><LazyPage><SpecialControlledDrugRegisterPage /></LazyPage></PrivateRoute>} />
        <Route path="special-controlled-drugs" element={<Navigate to="/pharmacy/special-control-register" replace />} />
        <Route path="medicines" element={<PrivateRoute allowedPermissions={['PHARMACY_READ', 'PHARMACY_CREATE', 'PHARMACY_UPDATE']} allowedRoles={['admin', 'pharmacist']}><LazyPage><MedicineCatalogPage /></LazyPage></PrivateRoute>} />
        <Route path="medicine-catalog" element={<PrivateRoute allowedPermissions={['PHARMACY_READ', 'PHARMACY_CREATE', 'PHARMACY_UPDATE']} allowedRoles={['admin', 'pharmacist']}><LazyPage><MedicineCatalogPage /></LazyPage></PrivateRoute>} />
        <Route path="pharmacy/procurement-plans" element={<PrivateRoute allowedPermissions={['MEDICATION_PROCUREMENT_READ']} allowedRoles={['admin', 'pharmacist', 'manager', 'clinic_manager']}><LazyPage><MedicationProcurementPage /></LazyPage></PrivateRoute>} />
        <Route path="procurement-plans" element={<Navigate to="/pharmacy/procurement-plans" replace />} />
        <Route path="inventory/procurements" element={<Navigate to="/pharmacy/procurement-plans" replace />} />
        <Route path="billing" element={<PrivateRoute allowedPermissions={['INVOICE_READ', 'INVOICE_CREATE', 'INVOICE_UPDATE']} allowedRoles={['admin', 'manager', 'receptionist']}><LazyPage><BillingPage /></LazyPage></PrivateRoute>} />
        <Route path="billing/unpaid-visits" element={<PrivateRoute allowedPermissions={['INVOICE_READ', 'INVOICE_CREATE']} allowedRoles={['admin', 'manager', 'clinic_manager', 'receptionist']}><LazyPage><UnpaidVisitsPage /></LazyPage></PrivateRoute>} />
        <Route path="invoices/discount-requests" element={<PrivateRoute allowedPermissions={['INVOICE_READ', 'INVOICE_UPDATE', 'INVOICE_CREATE']} allowedRoles={['admin', 'manager', 'clinic_manager', 'receptionist']}><LazyPage><DiscountRequestManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="discount-requests" element={<Navigate to="/invoices/discount-requests" replace />} />
        <Route path="invoices/lookup" element={<PrivateRoute allowedPermissions={['INVOICE_READ']} allowedRoles={['admin', 'manager', 'clinic_manager', 'receptionist']}><LazyPage><InvoiceLookupPage /></LazyPage></PrivateRoute>} />
        <Route path="reports" element={<PrivateRoute allowedPermissions={['REPORT_VIEW', 'REPORT_EXPORT']} allowedRoles={['admin', 'manager']}><LazyPage><ReportsPage /></LazyPage></PrivateRoute>} />
        <Route path="reports/disease-patterns" element={<PrivateRoute allowedPermissions={['REPORT_VIEW']} allowedRoles={['manager', 'clinic_manager']} disallowAdmin={true}><LazyPage><DiseasePatternReportPage /></LazyPage></PrivateRoute>} />
        <Route path="reports/revenue-breakdown" element={<PrivateRoute allowedPermissions={['REPORT_VIEW']} allowedRoles={['manager', 'clinic_manager']} disallowAdmin={true}><LazyPage><RevenueBreakdownReportPage /></LazyPage></PrivateRoute>} />
        <Route path="reports/appointment-effectiveness" element={<PrivateRoute allowedPermissions={['REPORT_VIEW']} allowedRoles={['manager', 'clinic_manager']} disallowAdmin={true}><LazyPage><AppointmentEffectivenessReportPage /></LazyPage></PrivateRoute>} />
        <Route path="inventory/stock-report" element={<PrivateRoute allowedPermissions={['INVENTORY_REPORT_VIEW']} allowedRoles={['admin', 'manager', 'clinic_manager', 'pharmacist']}><LazyPage><InventoryStockReportPage /></LazyPage></PrivateRoute>} />
        <Route path="pharmacy/stock-report" element={<Navigate to="/inventory/stock-report" replace />} />
        <Route path="system-management" element={<PrivateRoute allowedRoles={['admin']}><LazyPage><SystemManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="backup-restore" element={<PrivateRoute allowedRoles={['admin']}><LazyPage><BackupRestorePage /></LazyPage></PrivateRoute>} />
        <Route path="audit-logs" element={<PrivateRoute allowedRoles={['admin']}><LazyPage><MedicalRecordAccessLogsPage /></LazyPage></PrivateRoute>} />
        <Route path="medical-records/access-logs" element={<PrivateRoute allowedRoles={['admin']}><LazyPage><MedicalRecordAccessLogsPage /></LazyPage></PrivateRoute>} />
        <Route path="users" element={<PrivateRoute allowedRoles={['admin']}><LazyPage><UsersPage /></LazyPage></PrivateRoute>} />
        <Route path="services" element={<PrivateRoute allowedPermissions={['SERVICE_CATALOG_READ', 'SERVICE_CATALOG_CREATE', 'SERVICE_CATALOG_UPDATE', 'SERVICE_PRICE_MANAGE']} allowedRoles={['admin', 'manager', 'clinic_manager']}><LazyPage><ServicesPage /></LazyPage></PrivateRoute>} />
        <Route path="system/clinical-services" element={<PrivateRoute allowedPermissions={['CLINICAL_SERVICE_MANAGE']} allowedRoles={['admin']}><LazyPage><ClinicalServiceManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="clinical-services" element={<Navigate to="/system/clinical-services" replace />} />
        <Route path="system/diagnosis-catalog" element={<PrivateRoute allowedPermissions={['DIAGNOSIS_CATALOG_MANAGE']} allowedRoles={['admin']}><LazyPage><DiagnosisCatalogPage /></LazyPage></PrivateRoute>} />
        <Route path="diagnosis-catalog" element={<Navigate to="/system/diagnosis-catalog" replace />} />
        <Route path="system/medical-record-templates" element={<PrivateRoute allowedPermissions={['MEDICAL_RECORD_TEMPLATE_MANAGE']} allowedRoles={['admin']}><LazyPage><MedicalRecordTemplateManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="medical-record-templates" element={<Navigate to="/system/medical-record-templates" replace />} />
        <Route path="system/specialties" element={<PrivateRoute allowedPermissions={['SPECIALTY_MANAGE']} allowedRoles={['admin']}><LazyPage><SpecialtyManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="specialties" element={<Navigate to="/system/specialties" replace />} />
        <Route path="prescription-interconnections" element={<PrivateRoute allowedPermissions={['PRESCRIPTION_INTERCONNECTION_READ']} allowedRoles={['admin']}><LazyPage><PrescriptionInterconnectionPage /></LazyPage></PrivateRoute>} />
        <Route path="prescription-reconciliation" element={<PrivateRoute allowedPermissions={['PRESCRIPTION_RECONCILIATION_VIEW']} allowedRoles={['admin', 'pharmacist']}><LazyPage><PrescriptionReconciliationPage /></LazyPage></PrivateRoute>} />
        <Route path="pharmacy/prescription-reconciliation" element={<Navigate to="/prescription-reconciliation" replace />} />
        <Route path="system/anonymization" element={<PrivateRoute allowedPermissions={['SYSTEM_CONFIG_READ']} allowedRoles={['admin']}><LazyPage><AnonymizationPage /></LazyPage></PrivateRoute>} />
        <Route path="anonymization" element={<Navigate to="/system/anonymization" replace />} />
        <Route path="admin/sessions" element={<PrivateRoute allowedPermissions={['SESSION_READ']} allowedRoles={['admin']}><LazyPage><SessionManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="sessions" element={<Navigate to="/admin/sessions" replace />} />
        <Route path="admin/operation-logs" element={<PrivateRoute allowedPermissions={['ADMIN_OPERATION_LOG_READ']} allowedRoles={['admin', 'manager', 'clinic_manager']}><LazyPage><AdminOperationLogPage /></LazyPage></PrivateRoute>} />
        <Route path="admin-operation-logs" element={<Navigate to="/admin/operation-logs" replace />} />
        <Route path="contraindication-rules" element={<PrivateRoute allowedPermissions={['CONTRAINDICATION_RULE_MANAGE']}><LazyPage><ContraindicationRuleManagementPage /></LazyPage></PrivateRoute>} />
        <Route path="system/contraindication-rules" element={<Navigate to="/contraindication-rules" replace />} />
        <Route path="cashier-shifts/close" element={<PrivateRoute allowedPermissions={['CASHIER_SHIFT_CREATE']} allowedRoles={['receptionist', 'admin']}><LazyPage><CashierShiftClosingPage /></LazyPage></PrivateRoute>} />
        <Route path="cashier-shifts/history" element={<PrivateRoute allowedPermissions={['CASHIER_SHIFT_READ']} allowedRoles={['receptionist', 'manager', 'clinic_manager', 'admin']}><LazyPage><CashierShiftHistoryPage /></LazyPage></PrivateRoute>} />
        <Route path="cashier-shifts" element={<Navigate to="/cashier-shifts/history" replace />} />

      </Route>

      <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
    </Routes>
  )
}

export default AppRoutes
