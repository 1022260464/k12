-- K12 business database initialization script.
-- Run this script with a MySQL account that can CREATE DATABASE and GRANT.
-- Target MySQL version: 8.0+
-- Create the k12 application account separately with a strong environment-specific password.

SELECT COUNT(*) INTO @k12_business_db_exists
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'k12_business';

SET @k12_create_business_db_sql = IF(
    @k12_business_db_exists = 0,
    'CREATE DATABASE k12_business DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_create_business_db_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

SELECT COUNT(*) INTO @k12_user_exists
FROM mysql.user
WHERE User = 'k12' AND Host = '%';

-- 如果结果为 0，请先按 README 创建 k12 应用账号；脚本仍会继续完成建库建表。
SELECT IF(
    @k12_user_exists > 0,
    'k12 application user found; privileges will be granted',
    'WARNING: k12 application user is missing; create it and rerun this script'
) AS k12_account_check;

SET @k12_grant_sql = IF(
    @k12_user_exists > 0,
    'GRANT SELECT, INSERT, UPDATE, DELETE ON k12_business.* TO ''k12''@''%''',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_grant_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;
FLUSH PRIVILEGES;

USE k12_business;

SET @k12_previous_sql_notes = @@sql_notes;
SET SESSION sql_notes = 0;

CREATE TABLE IF NOT EXISTS learning_course (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Course primary key',
    teacher_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Creator user ID',
    title VARCHAR(128) NOT NULL COMMENT 'Course title',
    subject VARCHAR(64) NOT NULL COMMENT 'Course subject',
    grade_level VARCHAR(32) DEFAULT NULL COMMENT 'Grade level',
    description VARCHAR(1000) DEFAULT NULL COMMENT 'Course description',
    cover_object_key VARCHAR(500) DEFAULT NULL COMMENT 'Stable MinIO key under course-assets/',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 enabled, 0 disabled',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT 'Logical delete flag: 0 normal, 1 deleted',
    PRIMARY KEY (id),
    KEY idx_learning_course_subject (subject),
    KEY idx_course_teacher (teacher_id, deleted, updated_time),
    KEY idx_learning_course_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Learning courses';

CREATE TABLE IF NOT EXISTS learning_course_chapter (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    course_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(128) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_chapter_course_order (course_id, deleted, sort_order, id),
    CONSTRAINT fk_chapter_course FOREIGN KEY (course_id) REFERENCES learning_course(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_course_section (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    chapter_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(128) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_section_chapter_order (chapter_id, deleted, sort_order, id),
    CONSTRAINT fk_section_chapter FOREIGN KEY (chapter_id) REFERENCES learning_course_chapter(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_course_enrollment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    course_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    enrolled_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_enrollment_course_user (course_id, user_id),
    KEY idx_enrollment_user_status (user_id, status),
    CONSTRAINT fk_enrollment_course FOREIGN KEY (course_id) REFERENCES learning_course(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_chapter_progress (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    enrollment_id BIGINT UNSIGNED NOT NULL,
    chapter_id BIGINT UNSIGNED NOT NULL,
    progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_progress_enrollment_chapter (enrollment_id, chapter_id),
    CONSTRAINT chk_progress_percent CHECK (progress_percent <= 100),
    CONSTRAINT fk_progress_enrollment FOREIGN KEY (enrollment_id) REFERENCES learning_course_enrollment(id),
    CONSTRAINT fk_progress_chapter FOREIGN KEY (chapter_id) REFERENCES learning_course_chapter(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_config (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Agent primary key',
    code VARCHAR(64) NOT NULL COMMENT 'Stable runtime agent code, such as study-plan',
    name VARCHAR(128) NOT NULL COMMENT 'Agent name',
    type VARCHAR(64) NOT NULL COMMENT 'Agent type',
    description VARCHAR(1000) DEFAULT NULL COMMENT 'Agent description',
    version INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Agent configuration version',
    config_json JSON DEFAULT NULL COMMENT 'Non-secret runtime configuration',
    status VARCHAR(32) NOT NULL DEFAULT 'ENABLED' COMMENT 'Agent status',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT 'Logical delete flag: 0 normal, 1 deleted',
    PRIMARY KEY (id),
    UNIQUE KEY uk_agent_config_code (code),
    KEY idx_agent_config_type (type),
    KEY idx_agent_config_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Teaching agent configurations';

CREATE TABLE IF NOT EXISTS agent_run (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Agent run primary key',
    run_id VARCHAR(64) NOT NULL COMMENT 'Run identifier shared by Java and Python runtime',
    agent_code VARCHAR(64) NOT NULL COMMENT 'Stable code from agent_config.code',
    user_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Logical reference to k12_auth.sys_user.id',
    session_id VARCHAR(64) DEFAULT NULL COMMENT 'Optional conversation session identifier',
    execution_mode VARCHAR(16) NOT NULL DEFAULT 'SYNC' COMMENT 'SYNC or ASYNC',
    input_text MEDIUMTEXT DEFAULT NULL COMMENT 'User input text',
    input_context JSON DEFAULT NULL COMMENT 'Structured request context',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, RUNNING, SUCCEEDED, FAILED, TIMED_OUT or CANCELLED',
    output_text MEDIUMTEXT DEFAULT NULL COMMENT 'Agent text output',
    output_metadata JSON DEFAULT NULL COMMENT 'Model, token usage and other runtime metadata',
    error_code VARCHAR(64) DEFAULT NULL COMMENT 'Stable error code',
    error_message VARCHAR(2000) DEFAULT NULL COMMENT 'Sanitized error message',
    duration_ms BIGINT UNSIGNED DEFAULT NULL COMMENT 'Total execution duration in milliseconds',
    started_time DATETIME(3) DEFAULT NULL COMMENT 'Execution start time',
    finished_time DATETIME(3) DEFAULT NULL COMMENT 'Execution finish time',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    PRIMARY KEY (id),
    UNIQUE KEY uk_agent_run_run_id (run_id),
    KEY idx_agent_run_agent_created (agent_code, created_time),
    KEY idx_agent_run_user_created (user_id, created_time),
    KEY idx_agent_run_status_created (status, created_time),
    KEY idx_agent_run_session_created (session_id, created_time),
    KEY idx_agent_run_user_agent_session_created (user_id, agent_code, session_id, created_time)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Agent execution records';

CREATE TABLE IF NOT EXISTS agent_artifact (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Artifact primary key',
    artifact_id VARCHAR(64) NOT NULL COMMENT 'Public artifact identifier',
    run_id VARCHAR(64) NOT NULL COMMENT 'Related agent_run.run_id',
    kind VARCHAR(32) NOT NULL COMMENT 'Artifact kind, such as table, chart, image or file',
    title VARCHAR(255) DEFAULT NULL COMMENT 'Artifact display title',
    mime_type VARCHAR(128) DEFAULT NULL COMMENT 'Artifact MIME type',
    storage_uri VARCHAR(1024) DEFAULT NULL COMMENT 'MinIO or external object URI for large content',
    payload_json JSON DEFAULT NULL COMMENT 'Small structured artifact payload',
    size_bytes BIGINT UNSIGNED DEFAULT NULL COMMENT 'Artifact size in bytes',
    checksum_sha256 CHAR(64) DEFAULT NULL COMMENT 'Optional SHA-256 checksum',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    PRIMARY KEY (id),
    UNIQUE KEY uk_agent_artifact_artifact_id (artifact_id),
    KEY idx_agent_artifact_run_id (run_id),
    CONSTRAINT fk_agent_artifact_run
        FOREIGN KEY (run_id) REFERENCES agent_run (run_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Agent generated artifacts';

CREATE TABLE IF NOT EXISTS assessment_homework (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Homework primary key',
    course_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Course ID',
    teacher_user_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Logical reference to k12_auth.sys_user.id',
    title VARCHAR(128) NOT NULL COMMENT 'Homework title',
    description VARCHAR(1000) DEFAULT NULL COMMENT 'Homework description',
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT 'Homework status',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT 'Logical delete flag: 0 normal, 1 deleted',
    PRIMARY KEY (id),
    KEY idx_assessment_homework_course_id (course_id),
    KEY idx_assessment_homework_teacher_user_id (teacher_user_id),
    KEY idx_assessment_homework_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Assessment homework';

CREATE TABLE IF NOT EXISTS assessment_homework_recipient (
    homework_id BIGINT UNSIGNED NOT NULL COMMENT 'Homework ID',
    student_user_id BIGINT UNSIGNED NOT NULL COMMENT 'Logical reference to k12_auth.sys_user.id',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    PRIMARY KEY (homework_id, student_user_id),
    KEY idx_homework_recipient_student (student_user_id, homework_id),
    CONSTRAINT fk_homework_recipient_homework
        FOREIGN KEY (homework_id) REFERENCES assessment_homework (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Homework recipients';

CREATE TABLE IF NOT EXISTS assessment_homework_submission (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Submission primary key',
    homework_id BIGINT UNSIGNED NOT NULL COMMENT 'Homework ID',
    student_user_id BIGINT UNSIGNED NOT NULL COMMENT 'Logical reference to k12_auth.sys_user.id',
    course_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Course snapshot ID',
    answer_content TEXT NOT NULL COMMENT 'Student answer content',
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED' COMMENT 'SUBMITTED or GRADED',
    score DECIMAL(5,2) DEFAULT NULL COMMENT 'Score from 0 to 100',
    feedback VARCHAR(2000) DEFAULT NULL COMMENT 'Teacher feedback',
    graded_by BIGINT UNSIGNED DEFAULT NULL COMMENT 'Logical reference to grader user ID',
    version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Optimistic locking version',
    submitted_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Submit time',
    graded_time DATETIME(3) DEFAULT NULL COMMENT 'Latest grade time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    PRIMARY KEY (id),
    UNIQUE KEY uk_homework_submission_student (homework_id, student_user_id),
    KEY idx_homework_submission_student_time (student_user_id, submitted_time),
    KEY idx_homework_submission_status (status),
    CONSTRAINT fk_homework_submission_homework
        FOREIGN KEY (homework_id) REFERENCES assessment_homework (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_homework_submission_score CHECK (score IS NULL OR (score BETWEEN 0 AND 100))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Homework submissions';

CREATE TABLE IF NOT EXISTS assessment_homework_grade_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Grade history primary key',
    submission_id BIGINT UNSIGNED NOT NULL COMMENT 'Submission ID',
    version INT UNSIGNED NOT NULL COMMENT 'Submission version after grading',
    score DECIMAL(5,2) NULL DEFAULT NULL COMMENT 'Score snapshot; NULL when returned for redo',
    feedback VARCHAR(2000) DEFAULT NULL COMMENT 'Feedback snapshot',
    graded_by BIGINT UNSIGNED NOT NULL COMMENT 'Logical reference to grader user ID',
    graded_time DATETIME(3) NOT NULL COMMENT 'Grade time snapshot',
    PRIMARY KEY (id),
    UNIQUE KEY uk_grade_history_submission_version (submission_id, version),
    KEY idx_grade_history_graded_by (graded_by, graded_time),
    CONSTRAINT fk_grade_history_submission
        FOREIGN KEY (submission_id) REFERENCES assessment_homework_submission (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_grade_history_score CHECK (score IS NULL OR (score BETWEEN 0 AND 100))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Homework grade history';

CREATE TABLE IF NOT EXISTS assessment_homework_question (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Question primary key',
    homework_id BIGINT UNSIGNED NOT NULL COMMENT 'Homework ID',
    question_type VARCHAR(32) NOT NULL COMMENT 'Question type',
    stem TEXT NOT NULL COMMENT 'Question stem',
    score DECIMAL(5,2) NOT NULL COMMENT 'Maximum score',
    sort_order INT NOT NULL DEFAULT 0,
    correct_answers_json JSON NOT NULL COMMENT 'Normalized objective answers',
    reference_answer TEXT DEFAULT NULL COMMENT 'Subjective reference answer',
    analysis TEXT DEFAULT NULL COMMENT 'Teacher analysis',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_assessment_question_homework (homework_id, deleted, sort_order),
    CONSTRAINT fk_assessment_question_homework FOREIGN KEY (homework_id)
        REFERENCES assessment_homework (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_assessment_question_score CHECK (score > 0 AND score <= 100)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Homework questions';

CREATE TABLE IF NOT EXISTS assessment_question_attachment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    question_id BIGINT UNSIGNED NOT NULL,
    object_key VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    deleted TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_question_attachment (question_id, deleted, id),
    CONSTRAINT fk_question_attachment_question FOREIGN KEY (question_id)
        REFERENCES assessment_homework_question (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_question_option (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Option primary key',
    question_id BIGINT UNSIGNED NOT NULL COMMENT 'Question ID',
    option_key VARCHAR(8) NOT NULL COMMENT 'A, B, C or custom key',
    content VARCHAR(1000) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    deleted TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_assessment_option_key (question_id, option_key),
    KEY idx_assessment_option_sort (question_id, deleted, sort_order),
    CONSTRAINT fk_assessment_option_question FOREIGN KEY (question_id)
        REFERENCES assessment_homework_question (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Question options';

CREATE TABLE IF NOT EXISTS assessment_submission_answer (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Answer primary key',
    submission_id BIGINT UNSIGNED NOT NULL COMMENT 'Submission ID',
    question_id BIGINT UNSIGNED NOT NULL COMMENT 'Question ID',
    answer_json JSON NOT NULL COMMENT 'Normalized selected answers',
    answer_text TEXT DEFAULT NULL COMMENT 'Subjective answer',
    auto_score DECIMAL(5,2) DEFAULT NULL,
    manual_score DECIMAL(5,2) DEFAULT NULL,
    final_score DECIMAL(5,2) DEFAULT NULL,
    grading_status VARCHAR(32) NOT NULL,
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Structured answers and grading state';

/* Runtime codes must match Python AgentExecutor.code values. */
INSERT INTO agent_config (code, name, type, description, status)
SELECT 'study-plan', 'Study Plan Agent', 'TEACHING', 'Generate a structured study plan', 'ENABLED'
WHERE NOT EXISTS (
    SELECT 1 FROM agent_config WHERE code = 'study-plan'
);

INSERT INTO agent_config (code, name, type, description, status)
SELECT 'demo-chart', 'Demo Chart Agent', 'DEMO', 'Generate chart data for integration testing', 'ENABLED'
WHERE NOT EXISTS (
    SELECT 1 FROM agent_config WHERE code = 'demo-chart'
);

SET SESSION sql_notes = @k12_previous_sql_notes;
