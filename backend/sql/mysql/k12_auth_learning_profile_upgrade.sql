-- Existing k12_auth upgrade: learning profile table and education workflow permissions.
-- MySQL 8.0+, idempotent and safe to rerun.

USE k12_auth;

CREATE TABLE IF NOT EXISTS sys_learning_profile (
    user_id BIGINT UNSIGNED NOT NULL COMMENT 'Related sys_user.id',
    school_stage VARCHAR(32) NOT NULL COMMENT 'PRIMARY_LOWER, PRIMARY_UPPER, JUNIOR_HIGH or SENIOR_HIGH',
    grade TINYINT UNSIGNED NOT NULL COMMENT 'Grade number from 1 to 12',
    textbook VARCHAR(128) DEFAULT NULL COMMENT 'Preferred textbook edition',
    interests_json JSON NOT NULL COMMENT 'Student interest tags',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    PRIMARY KEY (user_id),
    KEY idx_sys_learning_profile_stage_grade (school_stage, grade),
    CONSTRAINT fk_sys_learning_profile_user
        FOREIGN KEY (user_id) REFERENCES sys_user (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_sys_learning_profile_grade CHECK (grade BETWEEN 1 AND 12)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Student learning profile';

INSERT INTO sys_permission (permission_name, permission_code, resource_type, description, status) VALUES
    ('提交作业', 'homework:submit', 'api', '学生提交已分配作业', 1),
    ('批改作业', 'homework:grade', 'api', '教师查看并批改学生作业', 1),
    ('查看学习档案', 'learning-profile:read', 'api', '查看当前用户学习档案', 1),
    ('修改学习档案', 'learning-profile:update', 'api', '修改当前用户学习档案', 1) AS seed
ON DUPLICATE KEY UPDATE
    permission_name = seed.permission_name,
    resource_type = seed.resource_type,
    description = seed.description,
    status = seed.status,
    updated_time = CURRENT_TIMESTAMP(3);

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.status = 1
WHERE role.role_code = 'ROLE_ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission relation
      WHERE relation.role_id = role.id AND relation.permission_id = permission.id
  );

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.permission_code = 'homework:grade'
WHERE role.role_code = 'ROLE_TEACHER'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission relation
      WHERE relation.role_id = role.id AND relation.permission_id = permission.id
  );

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.permission_code IN (
    'homework:submit', 'learning-profile:read', 'learning-profile:update'
)
WHERE role.role_code = 'ROLE_STUDENT'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission relation
      WHERE relation.role_id = role.id AND relation.permission_id = permission.id
  );
