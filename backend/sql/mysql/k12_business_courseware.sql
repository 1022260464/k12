-- AI 生成课件：教师/管理员在管理端生成草稿，审核后发布，学生端只读已发布课件。
CREATE TABLE IF NOT EXISTS agent_courseware (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    courseware_id VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    stage VARCHAR(32) NOT NULL DEFAULT 'lower_primary',
    topic_code VARCHAR(120) NULL,
    slide_count INT NOT NULL DEFAULT 0,
    document_json MEDIUMTEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    created_by VARCHAR(64) NULL,
    publish_time DATETIME(3) NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_agent_courseware_id (courseware_id),
    KEY idx_agent_courseware_status (status, publish_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO k12_business.schema_migration_history(version, description)
VALUES ('2026-09-27-courseware', 'AI courseware generation: draft/review/publish table')
ON DUPLICATE KEY UPDATE description=VALUES(description);
