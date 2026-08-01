-- K12 business database initialization script.
-- Run this script with a MySQL account that can CREATE DATABASE, CREATE USER, and GRANT.
-- Target MySQL version: 8.0+

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

SET @k12_create_user_sql = IF(
    @k12_user_exists = 0,
    'CREATE USER ''k12''@''%'' IDENTIFIED BY ''K12@123456''',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_create_user_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

ALTER USER 'k12'@'%' IDENTIFIED BY 'K12@123456';
GRANT ALL PRIVILEGES ON k12_business.* TO 'k12'@'%';
FLUSH PRIVILEGES;

USE k12_business;

SET @k12_previous_sql_notes = @@sql_notes;
SET SESSION sql_notes = 0;

CREATE TABLE IF NOT EXISTS learning_course (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Course primary key',
    title VARCHAR(128) NOT NULL COMMENT 'Course title',
    subject VARCHAR(64) NOT NULL COMMENT 'Course subject',
    grade_level VARCHAR(32) DEFAULT NULL COMMENT 'Grade level',
    description VARCHAR(1000) DEFAULT NULL COMMENT 'Course description',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 enabled, 0 disabled',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT 'Logical delete flag: 0 normal, 1 deleted',
    PRIMARY KEY (id),
    KEY idx_learning_course_subject (subject),
    KEY idx_learning_course_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Learning courses';

CREATE TABLE IF NOT EXISTS agent_config (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Agent primary key',
    name VARCHAR(128) NOT NULL COMMENT 'Agent name',
    type VARCHAR(64) NOT NULL COMMENT 'Agent type',
    description VARCHAR(1000) DEFAULT NULL COMMENT 'Agent description',
    status VARCHAR(32) NOT NULL DEFAULT 'ENABLED' COMMENT 'Agent status',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT 'Logical delete flag: 0 normal, 1 deleted',
    PRIMARY KEY (id),
    KEY idx_agent_config_type (type),
    KEY idx_agent_config_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Teaching agent configurations';

CREATE TABLE IF NOT EXISTS assessment_homework (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Homework primary key',
    course_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Course ID',
    title VARCHAR(128) NOT NULL COMMENT 'Homework title',
    description VARCHAR(1000) DEFAULT NULL COMMENT 'Homework description',
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT 'Homework status',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT 'Logical delete flag: 0 normal, 1 deleted',
    PRIMARY KEY (id),
    KEY idx_assessment_homework_course_id (course_id),
    KEY idx_assessment_homework_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Assessment homework';

SET SESSION sql_notes = @k12_previous_sql_notes;
