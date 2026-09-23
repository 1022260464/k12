SELECT VERSION() AS mysql_version,
       @@GLOBAL.max_allowed_packet AS global_max_allowed_packet,
       @@SESSION.max_allowed_packet AS session_max_allowed_packet;

SELECT table_schema, COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema IN ('k12_auth', 'k12_business')
GROUP BY table_schema
ORDER BY table_schema;

SELECT table_name
FROM information_schema.tables
WHERE table_schema='k12_business'
  AND table_name IN (
    'learning_course', 'learning_course_section', 'learning_course_section_activity',
    'learning_picture_book', 'learning_visual_programming_mission',
    'learning_teaching_resource', 'assessment_ai_practice_attempt',
    'assessment_ai_knowledge_mastery', 'agent_config', 'agent_run',
    'code_execution_quota', 'schema_migration_history'
  )
ORDER BY table_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema='k12_business'
  AND table_name='assessment_ai_practice_attempt'
  AND column_name IN ('knowledge_code', 'hint_count', 'duration_ms', 'error_types_json')
ORDER BY ordinal_position;

SELECT version, description, installed_time
FROM k12_business.schema_migration_history
ORDER BY installed_time DESC;

