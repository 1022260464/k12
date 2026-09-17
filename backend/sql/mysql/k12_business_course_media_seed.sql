-- 将已审核课程关联到MinIO中的稳定封面对象键。
-- 先执行：
-- 1. k12_business_learning_upgrade.sql
-- 2. Python scripts/sync_course_assets.py
-- 本脚本只更新精确命中的课程标题，可重复执行，不新增课程也不覆盖其他字段。
USE k12_business;

UPDATE learning_course
SET cover_object_key = 'course-assets/v1/k12-ai-learning-journey.png'
WHERE title = '人工智能启蒙：机器如何认识世界' AND deleted = 0;

UPDATE learning_course
SET cover_object_key = 'course-assets/v1/course-code-comic.png'
WHERE title = '图形化编程与智能小车' AND deleted = 0;

UPDATE learning_course
SET cover_object_key = 'course-assets/v1/course-math-comic.png'
WHERE title = 'Python与人工智能基础' AND deleted = 0;

UPDATE learning_course
SET cover_object_key = 'course-assets/v1/course-science-comic.png'
WHERE title = '机器学习项目实践' AND deleted = 0;

SELECT id, title, cover_object_key
FROM learning_course
WHERE deleted = 0
ORDER BY id;
