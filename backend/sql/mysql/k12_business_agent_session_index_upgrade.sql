/*
 * 先执行 k12_business_agent_session_index_check.sql。
 * 仅当检查结果为空时，单独执行本语句。
 * 拆成单条 ALTER，避免部分数据库软件批量执行 PREPARE/EXECUTE 时出现 S1009。
 */
ALTER TABLE k12_business.agent_run
    ADD INDEX idx_agent_run_user_agent_session_created
        (user_id, agent_code, session_id, created_time);
