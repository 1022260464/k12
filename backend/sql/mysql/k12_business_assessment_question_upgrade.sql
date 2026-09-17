-- Assessment question, option and structured submission-answer upgrade.
-- MySQL 8.0+, idempotent and safe to rerun.
USE k12_business;

CREATE TABLE IF NOT EXISTS assessment_homework_question (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    homework_id BIGINT UNSIGNED NOT NULL,
    question_type VARCHAR(32) NOT NULL COMMENT 'SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER',
    stem TEXT NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    correct_answers_json JSON NOT NULL,
    reference_answer TEXT DEFAULT NULL,
    analysis TEXT DEFAULT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_assessment_question_homework (homework_id, deleted, sort_order),
    CONSTRAINT fk_assessment_question_homework FOREIGN KEY (homework_id)
        REFERENCES assessment_homework (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_assessment_question_score CHECK (score > 0 AND score <= 100)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_question_option (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    question_id BIGINT UNSIGNED NOT NULL,
    option_key VARCHAR(8) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    deleted TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_assessment_option_key (question_id, option_key),
    KEY idx_assessment_option_sort (question_id, deleted, sort_order),
    CONSTRAINT fk_assessment_option_question FOREIGN KEY (question_id)
        REFERENCES assessment_homework_question (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_submission_answer (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    submission_id BIGINT UNSIGNED NOT NULL,
    question_id BIGINT UNSIGNED NOT NULL,
    answer_json JSON NOT NULL,
    answer_text TEXT DEFAULT NULL,
    auto_score DECIMAL(5,2) DEFAULT NULL,
    manual_score DECIMAL(5,2) DEFAULT NULL,
    final_score DECIMAL(5,2) DEFAULT NULL,
    grading_status VARCHAR(32) NOT NULL COMMENT 'AUTO_GRADED, PENDING_REVIEW, MANUAL_GRADED',
    feedback VARCHAR(2000) DEFAULT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_submission_answer_question (submission_id, question_id),
    KEY idx_submission_answer_status (grading_status),
    CONSTRAINT fk_submission_answer_submission FOREIGN KEY (submission_id)
        REFERENCES assessment_homework_submission (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_submission_answer_question FOREIGN KEY (question_id)
        REFERENCES assessment_homework_question (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_submission_answer_scores CHECK (
        (auto_score IS NULL OR auto_score >= 0) AND
        (manual_score IS NULL OR manual_score >= 0) AND
        (final_score IS NULL OR final_score >= 0)
    )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
