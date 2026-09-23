USE k12_business;

CREATE TABLE IF NOT EXISTS learning_visual_programming_project (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_user_id BIGINT UNSIGNED NOT NULL COMMENT 'Logical IAM user ID',
    mission_code VARCHAR(64) NOT NULL,
    workspace_json MEDIUMTEXT NOT NULL COMMENT 'Blockly JSON workspace',
    status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS',
    best_stars TINYINT UNSIGNED NOT NULL DEFAULT 0,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    completed_time DATETIME(3) DEFAULT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_visual_project_student_mission (student_user_id, mission_code),
    KEY idx_visual_project_student_status (student_user_id, status, updated_time),
    CONSTRAINT chk_visual_project_stars CHECK (best_stars <= 3),
    CONSTRAINT chk_visual_project_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Student Blockly AI mission workspace and result';

