-- =============================================================================
-- 学生角色权限收敛（安全修复）
--
-- 背景：线上 k12_auth 库的 ROLE_STUDENT 曾被多授 homework:delete、
-- homework:update、agent:update、role:read（早于审计/策略上线的历史遗留），
-- 导致学生 JWT 携带 homework:delete，可调用
-- DELETE /api/v1/assessments/homeworks/** 删除作业（2026-09 反馈证实）。
--
-- 本脚本按"白名单收敛"幂等清理：学生角色只保留种子初始化
-- （k12_auth_init.sql）声明的 7 项只读/提交类权限：
--   course:read, agent:read, agent:invoke,
--   homework:read, homework:submit,
--   learning-profile:read, learning-profile:update
-- 任何不在白名单内的权限（含 homework:delete/update、agent:update、
-- role:read 等）一律移除；permission 已被删除的孤儿关联一并清理。
-- 可重复执行。
--
-- 说明：JWT 在登录时写入权限，TTL 30 分钟；执行后存量 token 至多
-- 30 分钟内自然失效，无需强制下线。
-- =============================================================================

DELETE rp
FROM sys_role_permission rp
JOIN sys_role r            ON r.id = rp.role_id
LEFT JOIN sys_permission p ON p.id = rp.permission_id
WHERE r.role_code = 'ROLE_STUDENT'
  AND (p.id IS NULL OR p.permission_code NOT IN (
      'course:read', 'agent:read', 'agent:invoke',
      'homework:read', 'homework:submit',
      'learning-profile:read', 'learning-profile:update'
  ));

-- 校验（应正好返回 7 行）：
-- SELECT p.permission_code
-- FROM sys_role_permission rp
-- JOIN sys_role r       ON r.id = rp.role_id
-- JOIN sys_permission p ON p.id = rp.permission_id
-- WHERE r.role_code = 'ROLE_STUDENT'
-- ORDER BY p.permission_code;
