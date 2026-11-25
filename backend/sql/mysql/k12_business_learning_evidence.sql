-- 学习证据流水：练习、诊断、教学对话等每次被确认的学习活动各留一条，
-- 支撑学习画像与掌握度可信度展示。前置：k12_business_ai_practice.sql、k12_business_ai_mastery_upgrade.sql。
CREATE TABLE IF NOT EXISTS k12_business.assessment_learning_evidence (
    id BIGINT AUTO_INCREMENT,
    student_user_id BIGINT NOT NULL,
    knowledge_code VARCHAR(64) NOT NULL,
    evidence_type VARCHAR(32) NOT NULL COMMENT 'PRACTICE_QUIZ/TUTOR_CHAT/DIAGNOSTIC',
    title VARCHAR(128) NOT NULL,
    score_percent INT NULL COMMENT '无客观得分的对话证据为 NULL',
    confidence INT NOT NULL DEFAULT 50 COMMENT '证据可信度 1-100：服务端判分 90，模型归因 50',
    reference_id VARCHAR(64) NOT NULL COMMENT '来源业务编号（runId 等），幂等去重键',
    detail_json TEXT NULL,
    created_time DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_evidence_reference (student_user_id, evidence_type, reference_id),    KEY idx_evidence_student_time (student_user_id, created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 掌握度行增加证据条数：除练习外，对话/诊断证据也计数，供画像判断证据是否充分。
-- 本 ALTER 仅执行一次。
ALTER TABLE k12_business.assessment_ai_knowledge_mastery
    ADD COLUMN evidence_count INT NOT NULL DEFAULT 0 AFTER latest_score_percent;

-- 历史练习已有判分记录，按小测流水补齐证据与计数，保证旧数据画像不缺证据。
INSERT IGNORE INTO k12_business.assessment_learning_evidence
    (student_user_id, knowledge_code, evidence_type, title, score_percent, confidence,
     reference_id, detail_json, created_time)
SELECT a.student_user_id, a.knowledge_code, 'PRACTICE_QUIZ', a.topic,
       (a.score * 100) DIV a.max_score, 90, a.run_id,
       JSON_OBJECT('attemptId', a.id, 'correctCount', a.correct_count,
                   'totalQuestions', a.total_questions),
       a.created_time
FROM k12_business.assessment_ai_practice_attempt a
WHERE a.knowledge_code IS NOT NULL;

UPDATE k12_business.assessment_ai_knowledge_mastery m
SET m.evidence_count = (
    SELECT COUNT(*) FROM k12_business.assessment_learning_evidence e
    WHERE e.student_user_id = m.student_user_id
      AND e.knowledge_code = m.knowledge_code
);
