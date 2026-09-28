-- =====================================================
-- V109__create_personal_data_request_deadline_alerts_table.sql
-- NCL-15-CN-006 TC-02: persisted administrator alerts for personal-data-request
-- deadlines. One alert per (request, alert type) so the periodic scheduler does
-- not create duplicate alerts on every run.
-- =====================================================

CREATE TABLE personal_data_request_deadline_alerts (
    id BINARY(16) NOT NULL,
    personal_data_request_id BINARY(16) NOT NULL,
    alert_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,

    CONSTRAINT pk_personal_data_request_deadline_alerts PRIMARY KEY (id),

    CONSTRAINT uq_personal_data_request_deadline_alert
        UNIQUE (personal_data_request_id, alert_type),

    CONSTRAINT fk_pdr_deadline_alert_request
        FOREIGN KEY (personal_data_request_id)
        REFERENCES personal_data_requests (id)
);

CREATE INDEX idx_pdr_deadline_alerts_created_at
    ON personal_data_request_deadline_alerts (created_at);
