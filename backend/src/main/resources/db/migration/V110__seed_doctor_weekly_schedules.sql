-- =====================================================
-- V110__seed_doctor_weekly_schedules.sql
-- NCL-03-CN-011 / QTN-30: Seed weekly recurring working schedules
-- for standard doctors (Mon-Fri 08:00 - 17:00).
-- =====================================================

INSERT INTO doctor_weekly_schedules (id, doctor_id, day_of_week, start_time, end_time, active, created_at, updated_at) VALUES
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'), 'MONDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'), 'TUESDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'), 'WEDNESDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'), 'THURSDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'), 'FRIDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),

(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'), 'MONDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'), 'TUESDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'), 'WEDNESDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'), 'THURSDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL),
(UUID_TO_BIN(UUID()), UUID_TO_BIN('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'), 'FRIDAY', '08:00:00', '17:00:00', TRUE, CURRENT_TIMESTAMP, NULL)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
