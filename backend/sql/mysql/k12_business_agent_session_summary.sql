-- Persistent rolling conversation summary for Agent sessions.
-- MySQL 8.0+. The script is idempotent and keeps the recent conversation
-- window in agent_run while only older successful turns are summarized.

USE k12_business;

CREATE TABLE IF NOT EXISTS agent_session_summary (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Summary row primary key',
    user_id BIGINT UNSIGNED NOT NULL COMMENT 'Logical reference to k12_auth.sys_user.id',
    agent_code VARCHAR(64) NOT NULL COMMENT 'Agent code',
    session_id VARCHAR(64) NOT NULL COMMENT 'Conversation session identifier',
    summary_text TEXT DEFAULT NULL COMMENT 'Rolling Chinese summary of older successful turns',
    covered_run_db_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Last agent_run.id included in this summary',
    covered_run_id VARCHAR(64) DEFAULT NULL COMMENT 'Last agent_run.run_id included in this summary',
    summarized_turn_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of successful turns covered by the summary',
    summary_version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Optimistic concurrency version',
    status VARCHAR(24) NOT NULL DEFAULT 'EMPTY' COMMENT 'EMPTY, ACTIVE or FAILED',
    last_error_code VARCHAR(64) DEFAULT NULL COMMENT 'Sanitized summary failure code',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    PRIMARY KEY (id),
    UNIQUE KEY uk_agent_session_summary_scope (user_id, agent_code, session_id),
    KEY idx_agent_session_summary_updated (updated_time)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Rolling summaries for Agent conversation sessions';

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'agent_session_summary';
