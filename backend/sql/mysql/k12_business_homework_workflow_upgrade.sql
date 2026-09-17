-- Existing k12_business upgrade: homework ownership, recipients, submissions and grade history.
-- MySQL 8.0+, idempotent and safe to rerun.

USE k12_business;

SELECT COUNT(*) INTO @teacher_column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'k12_business'
  AND TABLE_NAME = 'assessment_homework'
  AND COLUMN_NAME = 'teacher_user_id';

SET @add_teacher_column_sql = IF(
    @teacher_column_exists = 0,
    'ALTER TABLE assessment_homework ADD COLUMN teacher_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT ''Logical reference to k12_auth.sys_user.id'' AFTER course_id',
    'DO 0'
);
PREPARE k12_stmt FROM @add_teacher_column_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

SELECT COUNT(*) INTO @teacher_index_exists
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'k12_business'
  AND TABLE_NAME = 'assessment_homework'
  AND INDEX_NAME = 'idx_assessment_homework_teacher_user_id';

SET @add_teacher_index_sql = IF(
    @teacher_index_exists = 0,
    'ALTER TABLE assessment_homework ADD INDEX idx_assessment_homework_teacher_user_id (teacher_user_id)',
    'DO 0'
);
PREPARE k12_stmt FROM @add_teacher_index_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

CREATE TABLE IF NOT EXISTS assessment_homework_recipient (
    homework_id BIGINT UNSIGNED NOT NULL,
    student_user_id BIGINT UNSIGNED NOT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (homework_id, student_user_id),
    KEY idx_homework_recipient_student (student_user_id, homework_id),
    CONSTRAINT fk_homework_recipient_homework FOREIGN KEY (homework_id)
        REFERENCES assessment_homework (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_homework_submission (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    homework_id BIGINT UNSIGNED NOT NULL,
    student_user_id BIGINT UNSIGNED NOT NULL,
    course_id BIGINT UNSIGNED DEFAULT NULL,
    answer_content TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    score DECIMAL(5,2) DEFAULT NULL,
    feedback VARCHAR(2000) DEFAULT NULL,
    graded_by BIGINT UNSIGNED DEFAULT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    submitted_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    graded_time DATETIME(3) DEFAULT NULL,
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_homework_submission_student (homework_id, student_user_id),
    KEY idx_homework_submission_student_time (student_user_id, submitted_time),
    KEY idx_homework_submission_status (status),
    CONSTRAINT fk_homework_submission_homework FOREIGN KEY (homework_id)
        REFERENCES assessment_homework (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_homework_submission_score CHECK (score IS NULL OR (score BETWEEN 0 AND 100))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_homework_grade_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    submission_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    feedback VARCHAR(2000) DEFAULT NULL,
    graded_by BIGINT UNSIGNED NOT NULL,
    graded_time DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_grade_history_submission_version (submission_id, version),
    KEY idx_grade_history_graded_by (graded_by, graded_time),
    CONSTRAINT fk_grade_history_submission FOREIGN KEY (submission_id)
        REFERENCES assessment_homework_submission (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_grade_history_score CHECK (score BETWEEN 0 AND 100)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
