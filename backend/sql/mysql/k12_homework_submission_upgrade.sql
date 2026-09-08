-- Apply after k12_business_init.sql. Existing homework ownership remains NULL.
USE k12_business;

SET @add_owner = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_homework' AND COLUMN_NAME = 'teacher_user_id') = 0,
    'ALTER TABLE assessment_homework ADD COLUMN teacher_user_id BIGINT UNSIGNED NULL, ADD KEY idx_homework_teacher (teacher_user_id)', 'DO 0');
PREPARE upgrade_stmt FROM @add_owner;
EXECUTE upgrade_stmt;
DEALLOCATE PREPARE upgrade_stmt;

CREATE TABLE IF NOT EXISTS assessment_homework_recipient (
    homework_id BIGINT UNSIGNED NOT NULL,
    student_user_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (homework_id, student_user_id),
    KEY idx_recipient_student (student_user_id, homework_id),
    CONSTRAINT fk_recipient_homework FOREIGN KEY (homework_id) REFERENCES assessment_homework(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_homework_submission (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    homework_id BIGINT UNSIGNED NOT NULL,
    student_user_id BIGINT UNSIGNED NOT NULL,
    course_id BIGINT UNSIGNED NULL,
    answer_content VARCHAR(5000) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    score DECIMAL(5,2) NULL,
    feedback VARCHAR(2000) NULL,
    graded_by BIGINT UNSIGNED NULL,
    version INT NOT NULL DEFAULT 0,
    submitted_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    graded_time DATETIME(3) NULL,
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_submission_student (homework_id, student_user_id),
    KEY idx_submission_history (student_user_id, id),
    CONSTRAINT fk_submission_homework FOREIGN KEY (homework_id) REFERENCES assessment_homework(id),
    CONSTRAINT chk_submission_score CHECK (score IS NULL OR (score >= 0 AND score <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_homework_grade_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    submission_id BIGINT UNSIGNED NOT NULL,
    version INT NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    feedback VARCHAR(2000) NULL,
    graded_by BIGINT UNSIGNED NOT NULL,
    graded_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_grade_version (submission_id, version),
    CONSTRAINT fk_grade_submission FOREIGN KEY (submission_id) REFERENCES assessment_homework_submission(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
