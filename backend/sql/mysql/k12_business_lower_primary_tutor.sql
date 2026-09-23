/* 已有环境执行一次即可；语句幂等，不会重复创建 Agent 配置。 */
INSERT INTO k12_business.agent_config (code, name, type, description, status)
SELECT 'lower-primary-tutor', '小学低年级 AI 小老师', 'TEACHING',
       '面向小学低年级的短句、绘本、图片任务与即时反馈教学智能体', 'ENABLED'
WHERE NOT EXISTS (
    SELECT 1
    FROM k12_business.agent_config
    WHERE code = 'lower-primary-tutor'
);

SELECT id, code, name, type, status
FROM k12_business.agent_config
WHERE code = 'lower-primary-tutor';
