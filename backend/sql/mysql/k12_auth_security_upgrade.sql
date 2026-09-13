-- IAM account security upgrade. Safe to rerun on MySQL 8.0.
USE k12_auth;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_user'
                 AND COLUMN_NAME = 'failed_login_count') = 0,
    'ALTER TABLE sys_user ADD COLUMN failed_login_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER status',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_user'
                 AND COLUMN_NAME = 'locked_until') = 0,
    'ALTER TABLE sys_user ADD COLUMN locked_until DATETIME(3) NULL AFTER failed_login_count',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_user'
                 AND COLUMN_NAME = 'auth_version') = 0,
    'ALTER TABLE sys_user ADD COLUMN auth_version BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER locked_until',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sys_login_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED DEFAULT NULL,
    username VARCHAR(64) NOT NULL,
    success TINYINT NOT NULL,
    failure_reason VARCHAR(64) DEFAULT NULL,
    client_ip VARCHAR(64) DEFAULT NULL,
    user_agent VARCHAR(512) DEFAULT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_sys_login_audit_user_time (user_id, created_time),
    KEY idx_sys_login_audit_username_time (username, created_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sys_operation_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    operator_user_id BIGINT UNSIGNED DEFAULT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128) DEFAULT NULL,
    detail VARCHAR(512) DEFAULT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_sys_operation_audit_operator_time (operator_user_id, created_time),
    KEY idx_sys_operation_audit_target (target_type, target_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
