-- 先执行本文件。如果 knowledge_code 已存在，不要再次执行升级脚本中的 ALTER。
SELECT COUNT(*) AS knowledge_code_column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'k12_business'
  AND TABLE_NAME = 'assessment_ai_practice_attempt'
  AND COLUMN_NAME = 'knowledge_code';

SELECT COUNT(*) AS mastery_table_exists
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'k12_business'
  AND TABLE_NAME = 'assessment_ai_knowledge_mastery';
