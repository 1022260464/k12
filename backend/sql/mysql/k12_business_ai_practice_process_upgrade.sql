-- 先执行 k12_business_ai_practice.sql 与 k12_business_ai_mastery_upgrade.sql。
-- 本脚本只执行一次；新增字段保存形成性练习过程证据，不计入正式成绩。
ALTER TABLE k12_business.assessment_ai_practice_attempt
    ADD COLUMN hint_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER weak_point,
    ADD COLUMN duration_ms BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER hint_count,
    ADD COLUMN error_types_json JSON NULL AFTER duration_ms;
