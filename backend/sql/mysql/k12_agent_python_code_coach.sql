/* 编程实验代码教练：仅审查/指导写码，不走 teaching-assistant 图谱闭环。 */
INSERT INTO agent_config (code, name, type, description, status)
SELECT 'python-code-coach', 'Python 代码教练', 'TEACHING',
       '编程实验专用：审查 Python 代码并指导修改，不走知识图谱与课程推荐', 'ENABLED'
WHERE NOT EXISTS (
    SELECT 1 FROM agent_config WHERE code = 'python-code-coach'
);

SELECT id, code, name, type, status FROM agent_config WHERE code = 'python-code-coach';
