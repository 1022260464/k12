-- 先确认已执行 k12_business_ai_practice.sql。本脚本中的 ALTER 仅执行一次。
ALTER TABLE k12_business.assessment_ai_practice_attempt
    ADD COLUMN knowledge_code VARCHAR(64) NULL AFTER topic;

-- 旧小测没有可信知识点编码，不按标题猜测并回填。
CREATE TABLE IF NOT EXISTS k12_business.assessment_ai_knowledge_mastery (
    student_user_id BIGINT NOT NULL,
    knowledge_code VARCHAR(64) NOT NULL,
    topic VARCHAR(128) NOT NULL,
    attempt_count INT NOT NULL,
    total_score BIGINT NOT NULL,
    total_max_score BIGINT NOT NULL,
    latest_score_percent INT NOT NULL,
    last_practiced_time DATETIME(3) NOT NULL,
    PRIMARY KEY (student_user_id, knowledge_code),
    KEY idx_ai_mastery_student_time (student_user_id, last_practiced_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
