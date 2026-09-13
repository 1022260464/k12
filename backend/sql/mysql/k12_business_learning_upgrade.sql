-- 课程业务升级。先执行 k12_business_init.sql 创建基础表。
-- 使用有 ALTER/CREATE 权限的管理员账号执行；应用账号不应拥有 DDL 权限。
-- 可重复执行，不删除历史记录，不修改课程归属，也不连接 k12_auth。
USE k12_business;

SELECT COUNT(*) INTO @k12_teacher_column
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'learning_course' AND COLUMN_NAME = 'teacher_id';
SET @k12_learning_ddl = IF(@k12_teacher_column = 0,
    'ALTER TABLE learning_course ADD COLUMN teacher_id BIGINT UNSIGNED NULL COMMENT ''Creator user ID; null for legacy courses''',
    'DO 0');
PREPARE k12_learning_stmt FROM @k12_learning_ddl;
EXECUTE k12_learning_stmt;
DEALLOCATE PREPARE k12_learning_stmt;

SELECT COUNT(*) INTO @k12_teacher_index
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'learning_course' AND INDEX_NAME = 'idx_course_teacher';
SET @k12_learning_ddl = IF(@k12_teacher_index = 0,
    'ALTER TABLE learning_course ADD INDEX idx_course_teacher (teacher_id, deleted, updated_time)',
    'DO 0');
PREPARE k12_learning_stmt FROM @k12_learning_ddl;
EXECUTE k12_learning_stmt;
DEALLOCATE PREPARE k12_learning_stmt;

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

-- 验证：应返回三个表和 teacher_id 字段。
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN ('learning_course_chapter', 'learning_course_enrollment', 'learning_chapter_progress');
SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'learning_course' AND COLUMN_NAME = 'teacher_id';
