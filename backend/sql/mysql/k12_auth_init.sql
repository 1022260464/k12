-- K12 IAM authentication database initialization script.
-- Run this script with a MySQL account that can CREATE DATABASE and GRANT.
-- Target MySQL version: 8.0+
-- Create the k12 application account separately with a strong environment-specific password.

SELECT COUNT(*) INTO @k12_auth_db_exists
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'k12_auth';

SET @k12_create_db_sql = IF(
    @k12_auth_db_exists = 0,
    'CREATE DATABASE k12_auth DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_create_db_sql;
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
    'GRANT SELECT, INSERT, UPDATE, DELETE ON k12_auth.* TO ''k12''@''%''',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_grant_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;
FLUSH PRIVILEGES;

USE k12_auth;

SET @k12_previous_sql_notes = @@sql_notes;
SET SESSION sql_notes = 0;

CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'User primary key',
    username VARCHAR(64) NOT NULL COMMENT 'Login username',
    password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt password hash',
    nickname VARCHAR(64) DEFAULT NULL COMMENT 'Display name',
    email VARCHAR(128) DEFAULT NULL COMMENT 'Email address',
    phone VARCHAR(32) DEFAULT NULL COMMENT 'Phone number',
    avatar_url VARCHAR(512) DEFAULT NULL COMMENT 'Avatar URL',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 enabled, 0 disabled, 2 locked',
    failed_login_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Consecutive failed login count',
    off_topic_strike_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Account off-topic strikes toward temp ban',
    abnormal_behavior_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Abnormal behavior count toward permanent ban',
    locked_until DATETIME(3) DEFAULT NULL COMMENT 'Temporary login lock expiration',
    auth_version BIGINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Increment to revoke existing JWTs',
    last_login_time DATETIME(3) DEFAULT NULL COMMENT 'Last login time',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT 'Logical delete flag: 0 normal, 1 deleted',
    PRIMARY KEY (id),
    UNIQUE KEY uk_sys_user_username (username),
    UNIQUE KEY uk_sys_user_email (email),
    UNIQUE KEY uk_sys_user_phone (phone),
    KEY idx_sys_user_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'System users';

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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Login success and failure audit';

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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Administrator operation audit';

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

CREATE TABLE IF NOT EXISTS sys_role (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Role primary key',
    role_name VARCHAR(64) NOT NULL COMMENT 'Role display name',
    role_code VARCHAR(64) NOT NULL COMMENT 'Spring Security authority, such as ROLE_ADMIN',
    description VARCHAR(255) DEFAULT NULL COMMENT 'Role description',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 enabled, 0 disabled',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    PRIMARY KEY (id),
    UNIQUE KEY uk_sys_role_code (role_code),
    KEY idx_sys_role_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'System roles';

CREATE TABLE IF NOT EXISTS sys_user_role (
    user_id BIGINT UNSIGNED NOT NULL COMMENT 'User ID',
    role_id BIGINT UNSIGNED NOT NULL COMMENT 'Role ID',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    PRIMARY KEY (user_id, role_id),
    KEY idx_sys_user_role_role_id (role_id),
    CONSTRAINT fk_sys_user_role_user
        FOREIGN KEY (user_id) REFERENCES sys_user (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_sys_user_role_role
        FOREIGN KEY (role_id) REFERENCES sys_role (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'User-role relation';

CREATE TABLE IF NOT EXISTS sys_permission (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Permission primary key',
    permission_name VARCHAR(64) NOT NULL COMMENT 'Permission display name',
    permission_code VARCHAR(128) NOT NULL COMMENT 'Permission code, such as user:create',
    resource_type VARCHAR(32) DEFAULT NULL COMMENT 'Resource type, such as api, menu, button',
    description VARCHAR(255) DEFAULT NULL COMMENT 'Permission description',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1 enabled, 0 disabled',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Update time',
    PRIMARY KEY (id),
    UNIQUE KEY uk_sys_permission_code (permission_code),
    KEY idx_sys_permission_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'System permissions';

CREATE TABLE IF NOT EXISTS sys_role_permission (
    role_id BIGINT UNSIGNED NOT NULL COMMENT 'Role ID',
    permission_id BIGINT UNSIGNED NOT NULL COMMENT 'Permission ID',
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Create time',
    PRIMARY KEY (role_id, permission_id),
    KEY idx_sys_role_permission_permission_id (permission_id),
    CONSTRAINT fk_sys_role_permission_role
        FOREIGN KEY (role_id) REFERENCES sys_role (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_sys_role_permission_permission
        FOREIGN KEY (permission_id) REFERENCES sys_permission (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Role-permission relation';

SET SESSION sql_notes = @k12_previous_sql_notes;

INSERT INTO sys_role (role_name, role_code, description)
SELECT 'Administrator', 'ROLE_ADMIN', 'System administrator'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_role WHERE role_code = 'ROLE_ADMIN'
);

INSERT INTO sys_role (role_name, role_code, description)
SELECT 'Teacher', 'ROLE_TEACHER', 'Teacher user'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_role WHERE role_code = 'ROLE_TEACHER'
);

INSERT INTO sys_role (role_name, role_code, description)
SELECT 'Student', 'ROLE_STUDENT', 'Student user'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_role WHERE role_code = 'ROLE_STUDENT'
);

UPDATE sys_role
SET role_name = 'Administrator',
    description = 'System administrator',
    updated_time = CURRENT_TIMESTAMP(3)
WHERE role_code = 'ROLE_ADMIN';

UPDATE sys_role
SET role_name = 'Teacher',
    description = 'Teacher user',
    updated_time = CURRENT_TIMESTAMP(3)
WHERE role_code = 'ROLE_TEACHER';

UPDATE sys_role
SET role_name = 'Student',
    description = 'Student user',
    updated_time = CURRENT_TIMESTAMP(3)
WHERE role_code = 'ROLE_STUDENT';

/*
 * 权限编码统一使用 resource:action。
 * 使用唯一键 UPSERT，不依赖只在单个数据库连接中有效的临时表。
 */
INSERT INTO sys_permission (
    permission_name,
    permission_code,
    resource_type,
    description,
    status
) VALUES
    ('查看用户', 'user:read', 'api', '查看用户列表和详情', 1),
    ('创建用户', 'user:create', 'api', '创建平台用户', 1),
    ('修改用户', 'user:update', 'api', '修改用户资料和角色', 1),
    ('删除用户', 'user:delete', 'api', '逻辑删除用户', 1),
    ('查看角色', 'role:read', 'api', '查看角色和权限关系', 1),
    ('修改角色权限', 'role:update', 'api', '修改角色拥有的权限', 1),
    ('查看课程', 'course:read', 'api', '查看课程列表和详情', 1),
    ('创建课程', 'course:create', 'api', '创建课程', 1),
    ('修改课程', 'course:update', 'api', '修改课程', 1),
    ('删除课程', 'course:delete', 'api', '删除课程', 1),
    ('查看智能体', 'agent:read', 'api', '查看智能体配置', 1),
    ('创建智能体', 'agent:create', 'api', '创建智能体配置', 1),
    ('修改智能体', 'agent:update', 'api', '修改智能体配置', 1),
    ('删除智能体', 'agent:delete', 'api', '删除智能体配置', 1),
    ('调用智能体', 'agent:invoke', 'api', '调用已启用的智能体', 1),
    ('查看作业', 'homework:read', 'api', '查看作业列表和详情', 1),
    ('创建作业', 'homework:create', 'api', '创建作业', 1),
    ('修改作业', 'homework:update', 'api', '修改作业', 1),
    ('删除作业', 'homework:delete', 'api', '删除作业', 1),
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

/* 管理员拥有全部已启用权限。 */
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.status = 1
WHERE role.role_code = 'ROLE_ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission relation
      WHERE relation.role_id = role.id
        AND relation.permission_id = permission.id
  );

/* 教师默认可以查看和维护课程、作业，并查看和调用智能体。 */
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission
  ON permission.permission_code IN (
      'course:read', 'course:create', 'course:update', 'course:delete',
      'agent:read', 'agent:invoke',
      'homework:read', 'homework:create', 'homework:update', 'homework:delete', 'homework:grade'
  )
WHERE role.role_code = 'ROLE_TEACHER'
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission relation
      WHERE relation.role_id = role.id
        AND relation.permission_id = permission.id
  );

/* 学生默认只能读取课程和作业，并调用智能体。 */
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission
  ON permission.permission_code IN (
      'course:read', 'agent:read', 'agent:invoke',
      'homework:read', 'homework:submit',
      'learning-profile:read', 'learning-profile:update'
  )
WHERE role.role_code = 'ROLE_STUDENT'
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission relation
      WHERE relation.role_id = role.id
        AND relation.permission_id = permission.id
  );

-- Seed admin user example:
-- Do not store a plaintext password in sys_user.password_hash.
-- Generate a BCrypt hash in Java with BCryptPasswordEncoder, then insert it:
--
-- INSERT INTO sys_user (username, password_hash, nickname)
-- VALUES ('admin', '<BCrypt hash of your password>', 'Administrator');
--
-- INSERT INTO sys_user_role (user_id, role_id)
-- SELECT u.id, r.id
-- FROM sys_user u
-- JOIN sys_role r ON r.role_code = 'ROLE_ADMIN'
-- WHERE u.username = 'admin';
