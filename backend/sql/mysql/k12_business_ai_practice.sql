-- 在 k12_business 执行一次；形成性练习不进入教师作业成绩。
CREATE TABLE IF NOT EXISTS k12_business.assessment_ai_practice_attempt (
    id BIGINT NOT NULL AUTO_INCREMENT,
    student_user_id BIGINT NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(64) NOT NULL,
    topic VARCHAR(128) NOT NULL,
    score INT NOT NULL,
    max_score INT NOT NULL,
    correct_count INT NOT NULL,
    total_questions INT NOT NULL,
    weak_point VARCHAR(255) NULL,
    answers_json JSON NOT NULL,
    created_time DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ai_practice_user_run (student_user_id, run_id),
    KEY idx_ai_practice_user_time (student_user_id, created_time, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
