-- =====================================================
-- V102__create_prescription_reconciliation_schema.sql
-- NCL-12-CN-007: Doi chieu don da lien thong voi don da cap phat.
--
-- Adds exactly two reconciliation permissions and the append only reconciliation
-- note store used when a discrepancy is accepted with a written reason instead of
-- being retransmitted.
--
-- This migration deliberately does NOT touch any NCL-12-CN-004 permission.
-- PRESCRIPTION_INTERCONNECTION_RETRY keeps its existing grant (ADMIN only), so a
-- pharmacist can never retransmit through NCL-12-CN-007.
-- =====================================================

INSERT INTO permissions (id, code, name, module, description, active, created_at, updated_at)
SELECT UUID_TO_BIN(UUID()), 'PRESCRIPTION_RECONCILIATION_VIEW', 'PRESCRIPTION RECONCILIATION VIEW', 'PRESCRIPTION',
       'Reconcile transmitted prescriptions against dispensed prescriptions (NCL-12-CN-007).',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'PRESCRIPTION_RECONCILIATION_VIEW'
);

INSERT INTO permissions (id, code, name, module, description, active, created_at, updated_at)
SELECT UUID_TO_BIN(UUID()), 'PRESCRIPTION_RECONCILIATION_NOTE', 'PRESCRIPTION RECONCILIATION NOTE', 'PRESCRIPTION',
       'Record a reason explaining a reconciliation discrepancy (NCL-12-CN-007).',
       TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'PRESCRIPTION_RECONCILIATION_NOTE'
);

-- ADMIN and PHARMACIST are the only roles named by the workbook for this story.
INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN (
    'PRESCRIPTION_RECONCILIATION_VIEW',
    'PRESCRIPTION_RECONCILIATION_NOTE'
)
WHERE roles.name IN ('ADMIN', 'PHARMACIST')
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions
      WHERE role_permissions.role_id = roles.id
        AND role_permissions.permission_id = permissions.id
  );

-- Append only notes. The prescription foreign key is intentionally NOT cascading, exactly
-- like every other prescription child table: MedicalRecordCascadeDeleter removes these rows
-- explicitly before deleting their prescriptions, so the delete order stays visible in code.
CREATE TABLE prescription_reconciliation_notes (
    id BINARY(16) NOT NULL,
    prescription_id BINARY(16) NOT NULL,
    reconciliation_outcome VARCHAR(40) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    noted_by BINARY(16) NOT NULL,
    noted_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,

    CONSTRAINT pk_prescription_reconciliation_notes PRIMARY KEY (id),
    CONSTRAINT fk_prescription_reconciliation_notes_prescription
        FOREIGN KEY (prescription_id)
        REFERENCES prescriptions(id),
    CONSTRAINT fk_prescription_reconciliation_notes_noted_by
        FOREIGN KEY (noted_by)
        REFERENCES users(id),
    CONSTRAINT chk_prescription_reconciliation_notes_outcome CHECK (
        reconciliation_outcome IN (
            'CONSISTENT',
            'TRANSMITTED_NOT_DISPENSED',
            'DISPENSED_NOT_TRANSMITTED',
            'NOT_TRANSMITTED_NOT_DISPENSED',
            'CANCELLED'
        )
    ),
    CONSTRAINT chk_prescription_reconciliation_notes_reason
        CHECK (CHAR_LENGTH(reason) > 0)
);

CREATE INDEX idx_prescription_reconciliation_notes_prescription_noted
    ON prescription_reconciliation_notes(prescription_id, noted_at);
