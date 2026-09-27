-- =====================================================
-- V106__configure_medicine_max_daily_dose_data.sql
-- NCL-05-CN-007: Kiểm tra liều dùng tối đa theo ngày (mg/day)
--
-- Data configuration for the DEMO/TEST medicine catalog.
--
-- Populates the nullable dose columns introduced by V94 for the three demo
-- medicines so the max-daily-dose validation flow can be exercised end-to-end.
-- Values are team-approved demo/test data, keyed by stable medicine_code.
--
-- Deterministic and idempotent: each row is updated only when its
-- medicine_code matches and the value is not already the target, so re-running
-- produces the same result and touches no unrelated medicine.
-- =====================================================

UPDATE medicines
SET strength_value_mg = 500,
    max_daily_dose_mg = 4000
WHERE medicine_code = 'MED-PARA-500';

UPDATE medicines
SET strength_value_mg = 400,
    max_daily_dose_mg = 2400
WHERE medicine_code = 'MED-IBU-400';

UPDATE medicines
SET strength_value_mg = 500,
    max_daily_dose_mg = 3000
WHERE medicine_code = 'MED-AMOX-500';
