-- =====================================================
-- V111__grant_reporting_permissions_to_admin_and_manager.sql
-- Ensure both ADMIN and MANAGER roles have full reporting permissions:
-- REPORT_VIEW, REPORT_EXPORT, and REPORT_UNMASKED_EXPORT (NCL-15-CN-007 / QTN-43).
-- =====================================================

-- 1. Ensure REPORT_UNMASKED_EXPORT permission exists
INSERT INTO permissions (id, code, name, module, description, active, created_at, updated_at)
SELECT UUID_TO_BIN(UUID()), 'REPORT_UNMASKED_EXPORT', 'REPORT UNMASKED EXPORT',
       'REPORT', 'Export report with unmasked patient identifying information.', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'REPORT_UNMASKED_EXPORT');

-- 2. Grant REPORT_VIEW, REPORT_EXPORT, and REPORT_UNMASKED_EXPORT to ADMIN (11111111-1111-1111-1111-111111111111)
INSERT INTO role_permissions (role_id, permission_id)
SELECT UUID_TO_BIN('11111111-1111-1111-1111-111111111111'), p.id
FROM permissions p
WHERE p.code IN ('REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_UNMASKED_EXPORT')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = UUID_TO_BIN('11111111-1111-1111-1111-111111111111')
        AND rp.permission_id = p.id
  );

-- 3. Grant REPORT_VIEW, REPORT_EXPORT, and REPORT_UNMASKED_EXPORT to MANAGER (66666666-6666-6666-6666-666666666666)
INSERT INTO role_permissions (role_id, permission_id)
SELECT UUID_TO_BIN('66666666-6666-6666-6666-666666666666'), p.id
FROM permissions p
WHERE p.code IN ('REPORT_VIEW', 'REPORT_EXPORT', 'REPORT_UNMASKED_EXPORT')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = UUID_TO_BIN('66666666-6666-6666-6666-666666666666')
        AND rp.permission_id = p.id
  );
