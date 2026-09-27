-- =====================================================
-- V103__add_doctor_dashboard_permission.sql
-- NCL-08-CN-010: Bảng điều khiển dành cho bác sĩ (Doctor Dashboard).
-- Permission to view doctor's start-of-day operational dashboard.
-- Granted to DOCTOR and ADMIN.
-- =====================================================

INSERT INTO permissions (id, code, name, module, description, active, created_at, updated_at)
SELECT UUID_TO_BIN(UUID()),
       'DASHBOARD_DOCTOR_READ',
       'DASHBOARD DOCTOR READ',
       'DASHBOARD',
       'View doctor start-of-day operational dashboard (NCL-08-CN-010).',
       TRUE,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'DASHBOARD_DOCTOR_READ'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'DASHBOARD_DOCTOR_READ'
WHERE r.name IN ('DOCTOR', 'ADMIN')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
