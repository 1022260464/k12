-- 首次学情诊断：服务端内置题库判分，一次诊断落一条结果记录；
-- 各知识类别同时写一条 DIAGNOSTIC 证据（见 k12_business_learning_evidence.sql）。
CREATE TABLE IF NOT EXISTS k12_business.assessment_diagnostic_attempt (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_user_id BIGINT NOT NULL,
    stage VARCHAR(32) NOT NULL COMMENT 'lower_primary/upper_primary/middle_school/high_school',
    total_questions INT NOT NULL,
    correct_count INT NOT NULL,
    score_percent INT NOT NULL,
    category_scores_json TEXT NOT NULL,
    strengths_json TEXT NOT NULL,
    weaknesses_json TEXT NOT NULL,
    recommended_code VARCHAR(64) NULL,
    interests_json TEXT NULL,
    created_time DATETIME(3) NOT NULL,
    KEY idx_diagnostic_student_time (student_user_id, created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
