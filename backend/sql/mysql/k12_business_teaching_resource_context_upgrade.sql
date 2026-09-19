-- 在 我的k12_business 执行一次；旧资料的关联字段保持 NULL，不猜测课程和知识点。
-- 先执行 k12_business_teaching_resource.sql；已升级环境不要重复运行 ALTER。
ALTER TABLE k12_business.learning_teaching_resource
 ADD COLUMN course_id BIGINT UNSIGNED NULL,
 ADD COLUMN chapter_id BIGINT UNSIGNED NULL,
 ADD COLUMN chapter_title VARCHAR(128) NULL,
 ADD COLUMN grade VARCHAR(32) NULL,
 ADD COLUMN textbook VARCHAR(255) NULL,
 ADD COLUMN knowledge_code VARCHAR(64) NULL,
 ADD KEY idx_teaching_resource_course (course_id, chapter_id),
 ADD KEY idx_teaching_resource_knowledge (knowledge_code),
 ADD CONSTRAINT fk_teaching_resource_course FOREIGN KEY (course_id) REFERENCES k12_business.learning_course(id),
 ADD CONSTRAINT fk_teaching_resource_chapter FOREIGN KEY (chapter_id) REFERENCES k12_business.learning_course_chapter(id);
