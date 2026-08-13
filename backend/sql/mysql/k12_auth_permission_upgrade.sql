-- 已存在 k12_auth 数据库时执行本脚本，补齐功能权限和默认角色授权。
-- MySQL 8.0+；脚本可重复执行，不会产生重复数据。

USE k12_auth;

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
    SELECT 1 FROM sys_permission permission
    WHERE permission.permission_code = seed.permission_code
);

UPDATE sys_permission permission
JOIN k12_permission_seed seed ON seed.permission_code = permission.permission_code
SET permission.permission_name = seed.permission_name,
    permission.resource_type = 'api',
    permission.description = seed.description,
    permission.status = 1,
    permission.updated_time = CURRENT_TIMESTAMP(3)
-- 显式 WHERE 用于通过数据库客户端的危险更新检查；只更新临时表匹配到的权限。
WHERE permission.permission_code = seed.permission_code;

-- 管理员：全部权限。
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.status = 1
WHERE role.role_code = 'ROLE_ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission relation
      WHERE relation.role_id = role.id AND relation.permission_id = permission.id
  );

-- 教师：课程和作业维护、智能体读取。
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
      SELECT 1 FROM sys_role_permission relation
      WHERE relation.role_id = role.id AND relation.permission_id = permission.id
  );

-- 学生：只读课程、智能体和作业。
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission
  ON permission.permission_code IN ('course:read', 'agent:read', 'homework:read')
WHERE role.role_code = 'ROLE_STUDENT'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission relation
      WHERE relation.role_id = role.id AND relation.permission_id = permission.id
  );

-- 某些数据库客户端会在执行脚本时切换连接；临时表只属于创建它的连接。
-- 使用 IF EXISTS，清理时即使临时表已经由连接关闭自动释放，也不会报错。
DROP TEMPORARY TABLE IF EXISTS k12_permission_seed;

-- 执行结果检查。
SELECT role.role_code, permission.permission_code
FROM sys_role role
JOIN sys_role_permission relation ON relation.role_id = role.id
JOIN sys_permission permission ON permission.id = relation.permission_id
ORDER BY role.role_code, permission.permission_code;
