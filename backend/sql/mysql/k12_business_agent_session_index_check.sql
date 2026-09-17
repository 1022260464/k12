/*
 * 单独执行本语句检查会话索引。
 * 返回四行 user_id、agent_code、session_id、created_time 表示索引已存在，
 * 此时不要再次执行升级脚本。
 */
SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'k12_business'
  AND TABLE_NAME = 'agent_run'
  AND INDEX_NAME = 'idx_agent_run_user_agent_session_created'
ORDER BY SEQ_IN_INDEX;
