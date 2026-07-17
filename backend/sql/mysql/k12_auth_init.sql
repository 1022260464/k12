-- K12 IAM authentication database initialization script.
-- Run this script with a MySQL account that can CREATE DATABASE, CREATE USER, and GRANT.
-- Target MySQL version: 8.0+

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

SET @k12_create_user_sql = IF(
    @k12_user_exists = 0,
    'CREATE USER ''k12''@''%'' IDENTIFIED BY ''K12@123456''',
    'DO 0'
);
PREPARE k12_stmt FROM @k12_create_user_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

ALTER USER 'k12'@'%' IDENTIFIED BY 'K12@123456';
GRANT ALL PRIVILEGES ON k12_auth.* TO 'k12'@'%';
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

INSERT INTO sys_permission (permission_name, permission_code, resource_type, description)
SELECT 'Read users', 'user:read', 'api', 'Read users'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_permission WHERE permission_code = 'user:read'
);

INSERT INTO sys_permission (permission_name, permission_code, resource_type, description)
SELECT 'Create users', 'user:create', 'api', 'Create users'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_permission WHERE permission_code = 'user:create'
);

INSERT INTO sys_permission (permission_name, permission_code, resource_type, description)
SELECT 'Read courses', 'course:read', 'api', 'Read courses'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_permission WHERE permission_code = 'course:read'
);

INSERT INTO sys_permission (permission_name, permission_code, resource_type, description)
SELECT 'Update courses', 'course:update', 'api', 'Update courses'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_permission WHERE permission_code = 'course:update'
);

UPDATE sys_permission
SET permission_name = 'Read users',
    resource_type = 'api',
    description = 'Read users',
    updated_time = CURRENT_TIMESTAMP(3)
WHERE permission_code = 'user:read';

UPDATE sys_permission
SET permission_name = 'Create users',
    resource_type = 'api',
    description = 'Create users',
    updated_time = CURRENT_TIMESTAMP(3)
WHERE permission_code = 'user:create';

UPDATE sys_permission
SET permission_name = 'Read courses',
    resource_type = 'api',
    description = 'Read courses',
    updated_time = CURRENT_TIMESTAMP(3)
WHERE permission_code = 'course:read';

UPDATE sys_permission
SET permission_name = 'Update courses',
    resource_type = 'api',
    description = 'Update courses',
    updated_time = CURRENT_TIMESTAMP(3)
WHERE permission_code = 'course:update';

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r
JOIN sys_permission p
WHERE r.role_code = 'ROLE_ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM sys_role_permission rp
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
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
