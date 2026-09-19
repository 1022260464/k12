-- Account off-topic / abnormal behavior counters. Safe to rerun on MySQL 8.0.
USE k12_auth;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_user'
                 AND COLUMN_NAME = 'off_topic_strike_count') = 0,
    'ALTER TABLE sys_user ADD COLUMN off_topic_strike_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER failed_login_count',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_user'
                 AND COLUMN_NAME = 'abnormal_behavior_count') = 0,
    'ALTER TABLE sys_user ADD COLUMN abnormal_behavior_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER off_topic_strike_count',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
