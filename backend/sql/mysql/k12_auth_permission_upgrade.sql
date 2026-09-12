-- 已存在 k12_auth 数据库时执行本脚本，补齐功能权限和默认角色授权。
-- MySQL 8.0+；脚本可重复执行，不会产生重复数据。

USE k12_auth;

/*
 * 直接根据 permission_code 唯一键执行 UPSERT。
 * 不使用临时表，兼容会把脚本语句分配到不同连接的数据库客户端。
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
    ('删除作业', 'homework:delete', 'api', '删除作业', 1) AS seed
ON DUPLICATE KEY UPDATE
    permission_name = seed.permission_name,
    resource_type = seed.resource_type,
    description = seed.description,
    status = seed.status,
    updated_time = CURRENT_TIMESTAMP(3);

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

-- 教师：课程和作业维护、智能体读取和调用。
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission
  ON permission.permission_code IN (
      'course:read', 'course:create', 'course:update', 'course:delete',
      'agent:read', 'agent:invoke',
      'homework:read', 'homework:create', 'homework:update', 'homework:delete'
  )
WHERE role.role_code = 'ROLE_TEACHER'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission relation
      WHERE relation.role_id = role.id AND relation.permission_id = permission.id
  );

-- 学生：只读课程和作业，并调用智能体。
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission
  ON permission.permission_code IN ('course:read', 'agent:read', 'agent:invoke', 'homework:read')
WHERE role.role_code = 'ROLE_STUDENT'
  AND NOT EXISTS (
      SELECT 1 FROM sys_role_permission relation
      WHERE relation.role_id = role.id AND relation.permission_id = permission.id
  );

-- 执行结果检查。
SELECT role.role_code, permission.permission_code
FROM sys_role role
JOIN sys_role_permission relation ON relation.role_id = role.id
JOIN sys_permission permission ON permission.id = relation.permission_id
ORDER BY role.role_code, permission.permission_code;
