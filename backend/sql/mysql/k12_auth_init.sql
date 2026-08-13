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
 * 通过临时表执行幂等同步，脚本重复运行不会产生重复记录。
 */
DROP TEMPORARY TABLE IF EXISTS k12_permission_seed;
CREATE TEMPORARY TABLE k12_permission_seed (
    permission_name VARCHAR(64) NOT NULL,
    permission_code VARCHAR(128) NOT NULL,
    description VARCHAR(255) NOT NULL,
    PRIMARY KEY (permission_code)
);

INSERT INTO k12_permission_seed (permission_name, permission_code, description) VALUES
    ('查看用户', 'user:read', '查看用户列表和详情'),
    ('创建用户', 'user:create', '创建平台用户'),
    ('修改用户', 'user:update', '修改用户资料和角色'),
    ('删除用户', 'user:delete', '逻辑删除用户'),
    ('查看角色', 'role:read', '查看角色和权限关系'),
    ('修改角色权限', 'role:update', '修改角色拥有的权限'),
    ('查看课程', 'course:read', '查看课程列表和详情'),
    ('创建课程', 'course:create', '创建课程'),
    ('修改课程', 'course:update', '修改课程'),
    ('删除课程', 'course:delete', '删除课程'),
    ('查看智能体', 'agent:read', '查看智能体配置'),
    ('创建智能体', 'agent:create', '创建智能体配置'),
    ('修改智能体', 'agent:update', '修改智能体配置'),
    ('删除智能体', 'agent:delete', '删除智能体配置'),
    ('查看作业', 'homework:read', '查看作业列表和详情'),
    ('创建作业', 'homework:create', '创建作业'),
    ('修改作业', 'homework:update', '修改作业'),
    ('删除作业', 'homework:delete', '删除作业');

INSERT INTO sys_permission (permission_name, permission_code, resource_type, description)
SELECT seed.permission_name, seed.permission_code, 'api', seed.description
FROM k12_permission_seed seed
WHERE NOT EXISTS (
    SELECT 1
    FROM sys_permission permission
    WHERE permission.permission_code = seed.permission_code
);

UPDATE sys_permission permission
JOIN k12_permission_seed seed ON seed.permission_code = permission.permission_code
SET permission.permission_name = seed.permission_name,
    permission.resource_type = 'api',
    permission.description = seed.description,
    permission.status = 1,
    permission.updated_time = CURRENT_TIMESTAMP(3)
/*
 * JOIN 已经限定为临时表中的 18 个权限码；这里仍保留显式 WHERE，
 * 防止数据库客户端把它识别为无条件整表 UPDATE。
 */
WHERE permission.permission_code = seed.permission_code;

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

/* 教师默认可以查看和维护课程、作业，并查看智能体。 */
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission
  ON permission.permission_code IN (
      'course:read', 'course:create', 'course:update', 'course:delete',
      'agent:read',
      'homework:read', 'homework:create', 'homework:update', 'homework:delete'
  )
WHERE role.role_code = 'ROLE_TEACHER'
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission relation
      WHERE relation.role_id = role.id
        AND relation.permission_id = permission.id
  );

/* 学生默认只能读取课程、智能体和作业。 */
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission
  ON permission.permission_code IN ('course:read', 'agent:read', 'homework:read')
WHERE role.role_code = 'ROLE_STUDENT'
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission relation
      WHERE relation.role_id = role.id
        AND relation.permission_id = permission.id
  );

-- 连接关闭时 MySQL 会自动释放临时表；IF EXISTS 避免客户端切换连接后清理报错。
DROP TEMPORARY TABLE IF EXISTS k12_permission_seed;

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
