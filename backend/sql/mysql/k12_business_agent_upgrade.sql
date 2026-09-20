-- Upgrade an existing k12_business database for Agent runtime integration.
-- Target: MySQL 8.0+. This script is idempotent and can be run repeatedly.

USE k12_business;

/* Also supports a database where agent_config has not been created yet. */
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

/*
 * MySQL 8.0 does not consistently support ADD COLUMN IF NOT EXISTS across all
 * minor versions. information_schema checks keep this script portable.
 */
SELECT COUNT(*) INTO @k12_agent_code_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_config'
  AND COLUMN_NAME = 'code';

SET @k12_sql = IF(
    @k12_agent_code_exists = 0,
    'ALTER TABLE agent_config ADD COLUMN code VARCHAR(64) NULL COMMENT ''Stable runtime agent code, such as study-plan'' AFTER id',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

SELECT COUNT(*) INTO @k12_agent_version_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_config'
  AND COLUMN_NAME = 'version';

SET @k12_sql = IF(
    @k12_agent_version_exists = 0,
    'ALTER TABLE agent_config ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 COMMENT ''Agent configuration version'' AFTER description',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

SELECT COUNT(*) INTO @k12_agent_config_json_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_config'
  AND COLUMN_NAME = 'config_json';

SET @k12_sql = IF(
    @k12_agent_config_json_exists = 0,
    'ALTER TABLE agent_config ADD COLUMN config_json JSON NULL COMMENT ''Non-secret runtime configuration'' AFTER version',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

/* Existing rows receive deterministic unique codes before code becomes NOT NULL. */
UPDATE agent_config
SET code = CONCAT('legacy-agent-', id)
WHERE code IS NULL OR TRIM(code) = '';

ALTER TABLE agent_config
    MODIFY COLUMN code VARCHAR(64) NOT NULL COMMENT 'Stable runtime agent code, such as study-plan';

SELECT COUNT(*) INTO @k12_agent_code_index_exists
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_config'
  AND INDEX_NAME = 'uk_agent_config_code';

SET @k12_sql = IF(
    @k12_agent_code_index_exists = 0,
    'ALTER TABLE agent_config ADD UNIQUE KEY uk_agent_config_code (code)',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

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

SELECT COUNT(*) INTO @k12_agent_session_index_exists
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_run'
  AND INDEX_NAME = 'idx_agent_run_user_agent_session_created';

SET @k12_sql = IF(
    @k12_agent_session_index_exists = 0,
    'ALTER TABLE agent_run ADD KEY idx_agent_run_user_agent_session_created (user_id, agent_code, session_id, created_time)',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

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

INSERT INTO agent_config (code, name, type, description, status)
SELECT 'python-code-coach', 'Python 代码教练', 'TEACHING',
       '编程实验专用：审查 Python 代码并指导修改，不走知识图谱与课程推荐', 'ENABLED'
WHERE NOT EXISTS (
    SELECT 1 FROM agent_config WHERE code = 'python-code-coach'
);

/* Verification output. */
SELECT id, code, name, type, status FROM agent_config ORDER BY id;
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('agent_config', 'agent_run', 'agent_artifact')
ORDER BY TABLE_NAME;
