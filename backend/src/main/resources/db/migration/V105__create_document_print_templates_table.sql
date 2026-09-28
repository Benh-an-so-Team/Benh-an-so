-- =====================================================
-- V105__create_document_print_templates_table.sql
-- NCL-09-CN-008: Cấu hình mẫu in chứng từ
-- Stores document print template configurations (header logo,
-- legal info, footer, and field visibility) per document type.
-- =====================================================

CREATE TABLE document_print_templates (
    id BINARY(16) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    template_name VARCHAR(150) NOT NULL,
    title VARCHAR(255) NOT NULL,
    logo_url VARCHAR(1000) NULL,
    legal_info VARCHAR(1000) NULL,
    footer_text VARCHAR(1000) NULL,
    show_logo BOOLEAN NOT NULL DEFAULT TRUE,
    field_visibility TEXT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    CONSTRAINT pk_document_print_templates PRIMARY KEY (id),
    CONSTRAINT uk_document_print_templates_type UNIQUE (document_type)
);

-- Seed default print templates
INSERT INTO document_print_templates (
    id, document_type, template_name, title, logo_url, legal_info, footer_text, show_logo, field_visibility, created_at, updated_at
) VALUES
(
    UUID_TO_BIN(UUID()),
    'PRESCRIPTION',
    'Mẫu đơn thuốc chuẩn',
    'ĐƠN THUỐC',
    NULL,
    'Giấy phép hoạt động: 01234/SYT-GPHĐ | Phụ trách chuyên môn: Bác sĩ điều trị',
    'Đơn thuốc có giá trị mua trong vòng 05 ngày kể từ ngày kê. Tái khám xin mang theo đơn này.',
    TRUE,
    '{"showDoctorSignature":true,"showDiagnosis":true,"showPatientPhone":true}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    UUID_TO_BIN(UUID()),
    'INVOICE',
    'Mẫu hóa đơn thu tiền chuẩn',
    'HÓA ĐƠN THU TIỀN KHÁM CHỮA BỆNH',
    NULL,
    'Mã số thuế: 0101234567 | Giấy phép hoạt động: 01234/SYT-GPHĐ',
    'Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ khám chữa bệnh của phòng khám.',
    TRUE,
    '{"showCashierSignature":true,"showPaymentMethod":true,"showPatientPhone":true}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    UUID_TO_BIN(UUID()),
    'VISIT_SUMMARY',
    'Mẫu phiếu tóm tắt lượt khám chuẩn',
    'PHIẾU TÓM TẮT LƯỢT KHÁM',
    NULL,
    'Giấy phép hoạt động: 01234/SYT-GPHĐ',
    'Phiếu tóm tắt lượt khám dùng để theo dõi quá trình điều trị ngoại trú và tái khám.',
    TRUE,
    '{"showDoctorSignature":true,"showDiagnosis":true,"showRevisitDate":true,"showClinicalOrders":true}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    UUID_TO_BIN(UUID()),
    'CLINICAL_RESULT',
    'Mẫu phiếu kết quả cận lâm sàng chuẩn',
    'PHIẾU KẾT QUẢ CẬN LÂM SÀNG',
    NULL,
    'Giấy phép hoạt động: 01234/SYT-GPHĐ',
    'Kết quả chỉ có giá trị tại thời điểm xét nghiệm và thực hiện kỹ thuật.',
    TRUE,
    '{"showDoctorSignature":true,"showReferenceRange":true}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Seed permissions for document print template management (ADMIN only)
INSERT INTO permissions (id, code, name, module, description, active, created_at, updated_at)
SELECT UUID_TO_BIN(UUID()), 'PRINT_TEMPLATE_READ', 'PRINT TEMPLATE READ', 'SYSTEM',
       'View document print templates (NCL-09-CN-008)', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'PRINT_TEMPLATE_READ'
);

INSERT INTO permissions (id, code, name, module, description, active, created_at, updated_at)
SELECT UUID_TO_BIN(UUID()), 'PRINT_TEMPLATE_UPDATE', 'PRINT TEMPLATE UPDATE', 'SYSTEM',
       'Update document print templates (NCL-09-CN-008)', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'PRINT_TEMPLATE_UPDATE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN ('PRINT_TEMPLATE_READ', 'PRINT_TEMPLATE_UPDATE')
WHERE roles.name = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions
      WHERE role_permissions.role_id = roles.id AND role_permissions.permission_id = permissions.id
  );
