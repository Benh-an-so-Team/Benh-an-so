-- =====================================================
-- V108__create_personal_data_requests_table.sql
-- NCL-15-CN-006: Tiếp nhận và xử lý yêu cầu về dữ liệu cá nhân
-- Lưu vết yêu cầu của người bệnh (loại yêu cầu, ngày tiếp nhận,
-- hạn xử lý, trạng thái, kết quả, người xử lý) để quản trị viên
-- theo dõi đúng hạn và có bằng chứng đã xử lý (TC-01, TC-02, TC-03).
-- =====================================================

CREATE TABLE personal_data_requests (
    id BINARY(16) NOT NULL,
    patient_id BINARY(16) NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    reason VARCHAR(2000) NULL,
    received_at TIMESTAMP NOT NULL,
    due_at TIMESTAMP NOT NULL,
    result VARCHAR(2000) NULL,
    completed_at TIMESTAMP NULL,
    processed_by BINARY(16) NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL,

    CONSTRAINT pk_personal_data_requests PRIMARY KEY (id),

    CONSTRAINT fk_personal_data_requests_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(id),

    CONSTRAINT fk_personal_data_requests_processed_by
        FOREIGN KEY (processed_by)
        REFERENCES users(id),

    CONSTRAINT chk_personal_data_requests_status
        CHECK (status IN ('RECEIVED', 'COMPLETED'))
);

CREATE INDEX idx_personal_data_requests_patient
    ON personal_data_requests(patient_id);

CREATE INDEX idx_personal_data_requests_status_due_at
    ON personal_data_requests(status, due_at);

CREATE INDEX idx_personal_data_requests_due_at
    ON personal_data_requests(due_at);

CREATE INDEX idx_personal_data_requests_processed_by
    ON personal_data_requests(processed_by);

-- Phân quyền: chỉ ADMIN theo dõi và xử lý yêu cầu dữ liệu cá nhân (TC-01, TC-03).
INSERT INTO permissions (id, code, name, module, description, active, created_at, updated_at)
SELECT UUID_TO_BIN(UUID()), 'PERSONAL_DATA_REQUEST_READ', 'PERSONAL DATA REQUEST READ', 'PERSONAL_DATA',
       'View personal data requests (NCL-15-CN-006)', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'PERSONAL_DATA_REQUEST_READ'
);

INSERT INTO permissions (id, code, name, module, description, active, created_at, updated_at)
SELECT UUID_TO_BIN(UUID()), 'PERSONAL_DATA_REQUEST_UPDATE', 'PERSONAL DATA REQUEST UPDATE', 'PERSONAL_DATA',
       'Record and complete personal data requests (NCL-15-CN-006)', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'PERSONAL_DATA_REQUEST_UPDATE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN ('PERSONAL_DATA_REQUEST_READ', 'PERSONAL_DATA_REQUEST_UPDATE')
WHERE roles.name = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions
      WHERE role_permissions.role_id = roles.id AND role_permissions.permission_id = permissions.id
  );
