-- =====================================================
-- V104__create_patient_satisfaction_surveys_table.sql
-- NCL-10-CN-005: Khảo sát hài lòng sau khám
-- =====================================================

CREATE TABLE patient_satisfaction_surveys (
    id BINARY(16) NOT NULL,
    visit_id BINARY(16) NOT NULL,
    patient_id BINARY(16) NOT NULL,
    doctor_id BINARY(16) NOT NULL,
    score INT NOT NULL,
    comment VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL,

    CONSTRAINT pk_patient_satisfaction_surveys PRIMARY KEY (id),

    CONSTRAINT uq_patient_satisfaction_surveys_visit
        UNIQUE (visit_id),

    CONSTRAINT fk_patient_satisfaction_surveys_visit
        FOREIGN KEY (visit_id)
        REFERENCES visits(id),

    CONSTRAINT fk_patient_satisfaction_surveys_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(id),

    CONSTRAINT fk_patient_satisfaction_surveys_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES users(id),

    CONSTRAINT chk_patient_satisfaction_surveys_score
        CHECK (score >= 1 AND score <= 5)
);

CREATE INDEX idx_satisfaction_surveys_doctor_created
    ON patient_satisfaction_surveys (doctor_id, created_at);

CREATE INDEX idx_satisfaction_surveys_created_at
    ON patient_satisfaction_surveys (created_at);

CREATE INDEX idx_satisfaction_surveys_patient
    ON patient_satisfaction_surveys (patient_id);
