-- 教学资料可关联多门课程、多个章节（课程级绑定 chapter_id 为空）
CREATE TABLE IF NOT EXISTS learning_teaching_resource_binding (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    resource_id BIGINT NOT NULL,
    course_id BIGINT UNSIGNED NOT NULL,
    chapter_id BIGINT UNSIGNED NULL,
    chapter_title VARCHAR(128) NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_trb_resource (resource_id),
    KEY idx_trb_course_chapter (course_id, chapter_id),
    CONSTRAINT fk_trb_resource FOREIGN KEY (resource_id)
        REFERENCES learning_teaching_resource (id) ON DELETE CASCADE,
    CONSTRAINT fk_trb_course FOREIGN KEY (course_id)
        REFERENCES learning_course (id),
    CONSTRAINT fk_trb_chapter FOREIGN KEY (chapter_id)
        REFERENCES learning_course_chapter (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 回填：把旧的单课程/单章节字段迁到绑定表（已有绑定则跳过）
INSERT INTO learning_teaching_resource_binding (resource_id, course_id, chapter_id, chapter_title)
SELECT r.id, r.course_id, r.chapter_id, r.chapter_title
FROM learning_teaching_resource r
WHERE r.course_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM learning_teaching_resource_binding b WHERE b.resource_id = r.id
  );
