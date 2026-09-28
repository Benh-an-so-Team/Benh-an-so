-- =====================================================
-- V107__add_prescription_replacement.sql
-- NCL-12-CN-008: replace an interconnected prescription.
-- Additive only; existing rows keep NULL replacement columns and their
-- interconnection state.
-- =====================================================

-- DROP CONSTRAINT (rather than V68's DROP CHECK) is valid for a named CHECK on
-- MySQL 8 and also parses on H2, so the migration stays verifiable by the
-- persistence.migration suite.
ALTER TABLE prescriptions
    DROP CONSTRAINT chk_prescriptions_status;

ALTER TABLE prescriptions
    ADD CONSTRAINT chk_prescriptions_status CHECK (
        status IN (
            'PENDING_DISPENSE',
            'PARTIALLY_DISPENSED',
            'DISPENSED',
            'CANCELLED',
            'REPLACED'
        )
    );

ALTER TABLE prescriptions
    ADD COLUMN replaces_prescription_id BINARY(16) NULL;

ALTER TABLE prescriptions
    ADD COLUMN replaces_prescription_code VARCHAR(30) NULL;

ALTER TABLE prescriptions
    ADD COLUMN replacement_reason VARCHAR(500) NULL;

-- A replacement always shares the medical record of the original, so both rows
-- are removed together by MedicalRecordCascadeDeleter's record-scoped delete.
ALTER TABLE prescriptions
    ADD CONSTRAINT fk_prescriptions_replaces
        FOREIGN KEY (replaces_prescription_id)
        REFERENCES prescriptions(id)
        ON DELETE CASCADE;

-- At most one replacement per original. This unique index also serves the
-- lookup of the replacement belonging to a prescription.
ALTER TABLE prescriptions
    ADD CONSTRAINT uk_prescriptions_replaces
        UNIQUE (replaces_prescription_id);

ALTER TABLE prescriptions
    ADD CONSTRAINT chk_prescriptions_replacement_link CHECK (
        replaces_prescription_id IS NULL
        OR (replaces_prescription_code IS NOT NULL
            AND replacement_reason IS NOT NULL
            AND CHAR_LENGTH(TRIM(replacement_reason)) > 0)
    );

ALTER TABLE prescriptions
    ADD CONSTRAINT chk_prescriptions_not_self_replacing CHECK (
        replaces_prescription_id IS NULL
        OR replaces_prescription_id <> id
    );
