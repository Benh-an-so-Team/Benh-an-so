# Permission Matrix - Hệ thống phân quyền Bệnh số án

## Ma trận quyền chi tiết

| API Endpoint | Method | ADMIN | DOCTOR | RECEPTIONIST | PHARMACIST |
| --- | --- | --- | --- | --- | --- |
| **Authentication** |  |  |  |  |  |
| `/api/v1/auth/login` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/auth/register` | POST | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/auth/refresh` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/auth/logout` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/auth/change-password` | POST | ✅ | ✅ | ✅ | ✅ |
|  |  |  |  |  |  |
| **User Management** |  |  |  |  |  |
| `/api/v1/users` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/users` | POST | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/users/{id}` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/users/{id}` | PUT | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/users/{id}` | DELETE | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/users/{id}/roles` | PUT | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/users/{id}/reset-password` | POST | ✅ | ❌ | ❌ | ❌ |
|  |  |  |  |  |  |
| **Patient Management** |  |  |  |  |  |
| `/api/v1/patients` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/v1/patients` | POST | ✅ | ✅ | ✅ | ❌ |
| `/api/v1/patients/{id}` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/v1/patients/{id}` | PUT | ✅ | ✅ | ✅ | ❌ |
| `/api/v1/patients/import/template` | GET | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/patients/import/preview` | POST | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/patients/import` | POST | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/patients/import-logs` | GET | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/patients/import-logs/{id}` | GET | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/patients/me` | GET | ❌ | ✅ | ✅ | ❌ |
| `/patients/{patientId}/allergies` | GET | ✅ | ✅ | ❌ | ✅ |
| `/patients/{patientId}/allergies` | POST | ✅ | ✅ | ❌ | ❌ |
| `/patients/{patientId}/allergies/{allergyId}` | PUT | ✅ | ✅ | ❌ | ❌ |
| `/patients/{patientId}/allergies/{allergyId}` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/patients/{patientId}/allergies/{allergyId}/history` | GET | ✅ | ✅ | ❌ | ❌ |
| `/patients/{patientId}/chronic-diseases` | GET | ✅ | ✅ | ❌ | ✅ |
| `/patients/{patientId}/chronic-diseases` | POST | ✅ | ✅ | ❌ | ❌ |
| `/patients/{patientId}/chronic-diseases/{chronicDiseaseId}` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/patients/{patientId}/family-history` | GET | ✅ | ✅ | ❌ | ✅ |
| `/patients/{patientId}/family-history` | POST | ✅ | ✅ | ❌ | ❌ |
| `/patients/{patientId}/family-history/{familyHistoryId}` | DELETE | ✅ | ✅ | ❌ | ❌ |
|  |  |  |  |  |  |
| **Medical Records** |  |  |  |  |  |
| `/api/v1/medical-records` | GET | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/medical-records` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/medical-records/{id}` | GET | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/medical-records/{id}` | PUT | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/medical-records/{id}` | DELETE | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/medical-records/{id}/diagnoses` | PUT | ❌ | ✅ | ❌ | ❌ |
| `/api/v1/medical-records/{id}/diagnoses` | GET | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/medical-records/{id}/sign` | POST | ❌ | ✅ (chỉ bác sĩ phụ trách lượt khám) | ❌ | ❌ |
| `/api/v1/medical-records/{id}/status` | PATCH | ✅ | ✅ | ❌ | ❌ |
| **Visits** |  |  |  |  |  |
| `/api/v1/visits/{visitId}/encounter` | GET | ✅ | ✅ (bác sĩ phụ trách) | ❌ | ❌ |
| `/api/v1/visits/{visitId}/handover` | POST | ✅ | ✅ (bác sĩ phụ trách) | ❌ | ❌ |
| `/api/v1/visits/{visitId}/handovers` | GET | ✅ | ✅ (bác sĩ phụ trách/tham gia) | ❌ | ❌ |
| `/api/v1/visits/handover/doctors` | GET | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/visits/{id}/summary` | GET | ✅ | ✅ (chỉ BS phụ trách lượt khám) | ✅ | ❌ |
| `/api/v1/visits/{id}/summary/print` | GET | ✅ | ✅ (chỉ BS phụ trách lượt khám) | ✅ | ❌ |
|  |  |  |  |  |  |
| **Prescriptions** |  |  |  |  |  |
| `/api/v1/prescriptions` | GET | ✅ | ✅ | ❌ | ✅ |
| `/api/v1/prescriptions` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/prescriptions/{id}` | GET | ✅ | ✅ | ❌ | ✅ |
| `/api/v1/prescriptions/{id}` | PUT | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/prescriptions/{id}` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/prescriptions/{id}/status` | PUT | ✅ | ❌ | ❌ | ✅ |
| `/api/v1/prescriptions/{id}/interconnection` | POST | ❌ | ✅ | ❌ | ❌ |
| `/api/v1/prescription-interconnections` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/prescriptions/{id}/interconnection/retry` | POST | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/prescription-reconciliation` | GET | ✅ | ❌ | ❌ | ✅ |
| `/api/v1/prescription-reconciliation/{prescriptionId}/notes` | GET | ✅ | ❌ | ❌ | ✅ |
| `/api/v1/prescription-reconciliation/{prescriptionId}/notes` | POST | ✅ | ❌ | ❌ | ✅ |
| `/api/v1/prescriptions/check-interactions` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/prescriptions/check-allergy-warnings` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/prescriptions/allergy-warning-logs` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/prescriptions/{id}/print` | GET | ❌ | ✅ | ❌ | ✅ |
|  |  |  |  |  |  |
| **Appointments** |  |  |  |  |  |
| `/api/v1/appointments` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/v1/appointments` | POST | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/appointments/{id}` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/v1/appointments/{id}` | PUT | ✅ | ✅ | ✅ | ❌ |
| `/api/v1/appointments/{id}` | DELETE | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/appointments/{id}/reschedule` | PATCH | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/appointments/{id}/confirm` | PATCH | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/appointments/unconfirmed` | GET | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/patient-portal/appointments/{id}/confirm` | PATCH | ❌ | ❌ | ❌ | ❌ |
| `/api/v1/appointments/me` | GET | ❌ | ✅ | ✅ | ❌ |
|  |  |  |  |  |  |
| **Vital Signs** |  |  |  |  |  |
| `/api/v1/vital-signs` | GET | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/vital-signs` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/vital-signs/{id}` | PUT | ✅ | ✅ | ❌ | ❌ |
|  |  |  |  |  |  |
| **Diagnoses** |  |  |  |  |  |
| `/api/v1/diagnosis-catalog` | GET | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/system/diagnosis-catalog/**` | ALL | ✅ | ❌ | ❌ | ❌ |
|  |  |  |  |  |  |
| **Pharmacy / Inventory** |  |  |  |  |  |
| `/api/v1/pharmacy/inventory` | GET | ✅ | ❌ | ❌ | ✅ |
| `/api/v1/pharmacy/inventory` | POST | ✅ | ❌ | ❌ | ✅ |
| `/api/v1/pharmacy/inventory/{id}` | PUT | ✅ | ❌ | ❌ | ✅ |
| `/api/v1/pharmacy/inventory/{id}` | DELETE | ✅ | ❌ | ❌ | ❌ |
| `/inventory/procurements/suggestions` | GET | ✅ | ❌ | ❌ | ✅ |
| `/inventory/procurements` | POST | ✅ | ❌ | ❌ | ✅ |
| `/inventory/procurements` | GET | ✅ | ❌ | ❌ | ✅ |
| `/inventory/procurements/{id}` | GET | ✅ | ❌ | ❌ | ✅ |
| `/inventory/procurements/{id}` | PUT | ✅ | ❌ | ❌ | ✅ |
| `/inventory/procurements/{id}/submit` | POST | ✅ | ❌ | ❌ | ✅ |
| `/inventory/procurements/{id}/cancel` | POST | ✅ | ❌ | ❌ | ✅ |
| `/inventory/procurements/{id}/approve` | POST | ✅ (Quản lý/Admin) | ❌ | ❌ | ❌ (SoD: không tự duyệt) |
| `/inventory/procurements/{id}/reject` | POST | ✅ (Quản lý/Admin) | ❌ | ❌ | ❌ |
|  |  |  |  |  |  |
| **Invoices / Payments** |  |  |  |  |  |
| `/api/v1/invoices` | GET | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/invoices` | POST | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/invoices/{id}` | GET | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/invoices/{id}` | PUT | ✅ | ❌ | ✅ | ❌ |
|  |  |  |  |  |  |
| **Audit Logs** |  |  |  |  |  |
| `/api/v1/audit-logs` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/audit-logs/{id}` | GET | ✅ | ❌ | ❌ | ❌ |
|  |  |  |  |  |  |
| **Security Alerts** |  |  |  |  |  |
| `/api/v1/security-alerts` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/security-alerts/{id}/status` | PATCH | ✅ | ❌ | ❌ | ❌ |
|  |  |  |  |  |  |
| **Medical Queue** |  |  |  |  |  |
| `/api/v1/queue` | POST | ✅ | ❌ | ✅ | ❌ |
| `/api/v1/queue/call-next` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/queue/{id}/status` | PUT | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/queue/room/{roomNumber}` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/queue/doctor/{doctorId}` | GET | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/queue/count` | GET | ✅ | ✅ | ✅ | ✅ |
|  |  |  |  |  |  |
| **Medical History** |  |  |  |  |  |
| `/patients/{patientId}/medical-history` | GET | ✅ | ✅ (chỉ BN đã khám) | ❌ | ❌ |
|  |  |  |  |  |  |
| **Patient Portal** |  |  |  |  |  |
| `/patient-portal/invoices` | GET | ❌ | ❌ | ❌ | ❌ |
| `/patient-portal/invoices/{id}` | GET | ❌ | ❌ | ❌ | ❌ |
| `/patient-portal/invoices/{id}/download` | GET | ❌ | ❌ | ❌ | ❌ |
| `/patient-portal/patients/linked` | GET | ❌ | ❌ | ❌ | ✅ |
| `/patient-portal/appointments` | GET | ❌ | ❌ | ❌ | ✅ |
| `/patient-portal/appointments` | POST | ❌ | ❌ | ❌ | ✅ |
| `/patient-portal/appointments/{id}` | GET | ❌ | ❌ | ❌ | ✅ |
| `/patient-portal/satisfaction-surveys` | POST | ❌ | ❌ | ❌ | ❌ (Chỉ `ROLE_PATIENT` sở hữu lượt khám) |
| `/patient-portal/satisfaction-surveys/{id}` | PUT | ❌ | ❌ | ❌ | ❌ (Chỉ `ROLE_PATIENT` sở hữu khảo sát) |
| `/patient-portal/satisfaction-surveys/by-visit/{visitId}` | GET | ❌ | ❌ | ❌ | ❌ (Chỉ `ROLE_PATIENT` sở hữu lượt khám) |
| `/patients/{patientId}` | PUT | ✅ `PATIENT_UPDATE` | ✅ `PATIENT_UPDATE` | ✅ `PATIENT_UPDATE` | ❌ |
*(Lưu ý: Các endpoint `/patient-portal/**` chỉ dành riêng cho vai trò `ROLE_PATIENT` với dữ liệu thuộc chính mình theo QTN-23)*

**NCL-10-CN-005 — Khảo sát hài lòng sau khám**

| Hạng mục | Chi tiết |
|---|---|
| Endpoints mới | `POST /patient-portal/satisfaction-surveys`, `PUT /patient-portal/satisfaction-surveys/{id}`, `GET /patient-portal/satisfaction-surveys/by-visit/{visitId}`, `GET /reports/satisfaction` |
| Quyền mới | Không thêm permission code mới. Phân hệ báo cáo sử dụng permission `REPORT_VIEW` (đã được cấp cho `ROLE_MANAGER` và `ROLE_ADMIN`). |
| Phân quyền vận chuyển | `/patient-portal/**` = `hasRole("PATIENT")`; `/reports/**` = `authenticated()` + `@RequirePermission("REPORT_VIEW")`. |
| Chống gửi trùng | Ràng buộc duy nhất `visit_id` trên DB, chặn tạo mới trả về `409 CONFLICT` (`SATISFACTION_SURVEY_ALREADY_EXISTS`), cho phép chỉnh sửa qua `PUT`. |
| Phạm vi dữ liệu (Data Scope) | `PatientAccessGuard.requirePatientOwnership(...)` bắt buộc bệnh nhân chỉ khảo sát và xem đánh giá của chính lượt khám của mình (`QTN-23`). |

**NCL-14-CN-010 — Người giám hộ đặt lịch cho bệnh nhân phụ thuộc**

| Hạng mục | Chi tiết |
|---|---|
| Endpoint mới | Chỉ `/patient-portal/patients/linked` (GET). Các endpoint còn lại được **mở rộng** bằng tham số tuỳ chọn `patientId`, không thay đổi phân quyền. |
| Quyền mới | **Không có.** Không thêm permission nào. |
| Phân quyền vận chuyển | Không đổi: `/patient-portal/**` = `hasRole("PATIENT")`; `/patients/**` = `authenticated()` + `@RequirePermission` ở tầng method. |
| Phạm vi theo hồ sơ | `PatientAccessGuard.requirePatientAccess(...)` — hồ sơ của chính mình **hoặc** hồ sơ có `patients.guardian_user_id` = id tài khoản đang đăng nhập. |
| Phạm vi chỉ-chính-mình (không đổi) | `/patient-portal/invoices*`, `/patient-portal/clinical-results*`, `/patient-portal/notifications*`, `/patient-portal/consent*` và `cancel` / `confirm` / `reschedule` — vẫn qua `requirePatientOwnership(...)`. |
| Gán `guardianUserId` | Chỉ `PUT /patients/{patientId}` với `PATIENT_UPDATE`. Vai trò `PATIENT` có **0 permission grant** (`V27__seed_patient_portal_role.sql`) nên không thể tự gán người giám hộ. |

Chi tiết: `docs/api/patient-portal-family-appointment-contract.md`, `docs/security-review-ncl-14-cn-010.md`.
|  |  |  |  |  |  |
| **Reports** |  |  |  |  |  |
| `/reports/summary` | GET | ✅ | ❌ | ❌ | ❌ |
| `/reports/visits-timeline` | GET | ✅ | ❌ | ❌ | ❌ |
| `/reports/top-medicines` | GET | ✅ | ❌ | ❌ | ❌ |
| `/reports/satisfaction` | GET | ✅ | ❌ (Chỉ ROLE_MANAGER/ADMIN có `REPORT_VIEW`) | ❌ | ❌ |
|  |  |  |  |  |  |
| **Admin / System** |  |  |  |  |  |
| `/api/v1/admin/**` | ALL | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/roles` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/roles` | POST | ✅ | ❌ | ❌ | ❌ |
| `/api/v1/permissions` | GET | ✅ | ❌ | ❌ | ❌ |

## Role Hierarchy (Phân cấp vai trò)

```
ADMIN (Quản trị viên)
  ├── Full system access
  ├── User management
  ├── Role & Permission management
  ├── Audit log access
  ├── Prescription allergy warning logs access
  ├── Security alerts management
  └── Medical Queue full access

DOCTOR (Bác sĩ)
  ├── Patient CRUD
  ├── Medical Records CRUD
  ├── Prescriptions (create/read/update/cancel, check interactions, check allergy warnings & override)
  ├── Prescription interconnection send (NCL-12-CN-004) and prescription replacement
  │   (NCL-12-CN-008, `POST /prescriptions/{id}/replacement`, guarded by
  │   `PRESCRIPTION_UPDATE` like amend and cancel — no dedicated permission)
  ├── Diagnoses management
  ├── Appointments management
  ├── Medical Queue (call next, update status, view)
  └── Medical History view

RECEPTIONIST (Lễ tân)
  ├── Patient CRUD (read/write)
  ├── Appointments CRUD
  ├── Invoices CRUD
  ├── Patient registration
  └── Medical Queue (add patient, view, count)

PHARMACIST (Dược sĩ)
  ├── Prescriptions read
  ├── Prescription status update (dispense)
  ├── Prescription export/print
  ├── Pharmacy inventory CRUD
  └── No patient/medical record access
```

## Permission Categories

| Category | Code Prefix | Description |
|---|---|---|
| User Management | `USER_` | Quản lý người dùng |
| Patient Management | `PATIENT_` | Quản lý bệnh nhân |
| Medical Record | `RECORD_` | Quản lý hồ sơ bệnh án |
| Prescription | `PRESCRIPTION_` | Quản lý đơn thuốc & cảnh báo dị ứng |
| Appointment | `APPOINTMENT_` | Quản lý lịch hẹn |
| Vital Signs | `VITAL_SIGN_` | Quản lý dấu hiệu sinh tồn |
| Diagnosis | `DIAGNOSIS_` | Quản lý chẩn đoán |
| Pharmacy | `PHARMACY_` | Quản lý nhà thuốc |
| Invoice | `INVOICE_` | Quản lý hóa đơn |
| Audit Log | `AUDIT_` | Quản lý nhật ký |
| Security Alert | `SECURITY_ALERT_` | Quản lý cảnh báo bảo mật |
| Role | `ROLE_` | Quản lý vai trò |
| Permission | `PERMISSION_` | Quản lý quyền |
| Medical Queue | `QUEUE_` | Quản lý hàng đợi khám |

## Chi tiết Permission Codes

```java
// User
USER_CREATE, USER_READ, USER_UPDATE, USER_DELETE, USER_ASSIGN_ROLE, USER_RESET_PASSWORD

// Patient
PATIENT_CREATE, PATIENT_READ, PATIENT_UPDATE, PATIENT_DELETE, PATIENT_CONSENT_UPDATE, PATIENT_ALLERGY_WRITE, PATIENT_ALLERGY_READ,
PATIENT_CHRONIC_DISEASE_WRITE, PATIENT_CHRONIC_DISEASE_READ, PATIENT_FAMILY_HISTORY_WRITE, PATIENT_FAMILY_HISTORY_READ

// Medical Record
RECORD_CREATE, RECORD_READ, RECORD_UPDATE, RECORD_DELETE, RECORD_UPDATE_STATUS, MEDICAL_RECORD_HANDOVER, VISIT_SUMMARY_PRINT

// Prescription
PRESCRIPTION_CREATE, PRESCRIPTION_READ, PRESCRIPTION_UPDATE, PRESCRIPTION_DELETE, PRESCRIPTION_UPDATE_STATUS, PRESCRIPTION_PRINT,
PRESCRIPTION_INTERCONNECTION_SEND, PRESCRIPTION_INTERCONNECTION_READ, PRESCRIPTION_INTERCONNECTION_RETRY,
PRESCRIPTION_RECONCILIATION_VIEW, PRESCRIPTION_RECONCILIATION_NOTE,
PRESCRIPTION_ALLERGY_WARNING_VIEW

// Appointment
APPOINTMENT_CREATE, APPOINTMENT_READ, APPOINTMENT_UPDATE, APPOINTMENT_DELETE

// Vital Sign
VITAL_SIGN_CREATE, VITAL_SIGN_READ, VITAL_SIGN_UPDATE

// Diagnosis
DIAGNOSIS_CREATE, DIAGNOSIS_READ, DIAGNOSIS_UPDATE

// Pharmacy & Procurement
PHARMACY_CREATE, PHARMACY_READ, PHARMACY_UPDATE, PHARMACY_DELETE,
MEDICATION_PROCUREMENT_READ, MEDICATION_PROCUREMENT_CREATE, MEDICATION_PROCUREMENT_APPROVE

// Invoice
INVOICE_CREATE, INVOICE_READ, INVOICE_UPDATE, INVOICE_DELETE

// Audit
AUDIT_READ

// Security Alert
SECURITY_ALERT_VIEW

// Role & Permission
ROLE_READ, ROLE_CREATE, ROLE_UPDATE, ROLE_DELETE
PERMISSION_READ

// Medical Queue
QUEUE_CREATE, QUEUE_CALL_NEXT, QUEUE_UPDATE_STATUS, QUEUE_VIEW, QUEUE_COUNT

// Reporting & Export (NCL-15-CN-007)
REPORT_VIEW, REPORT_EXPORT, REPORT_UNMASKED_EXPORT
```
