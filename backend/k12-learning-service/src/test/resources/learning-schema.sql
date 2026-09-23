CREATE TABLE learning_course (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, teacher_id BIGINT, title VARCHAR(128), subject VARCHAR(64),
 grade_level VARCHAR(32), description VARCHAR(1000), cover_object_key VARCHAR(500), status INT DEFAULT 1, deleted INT DEFAULT 0,
 created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE learning_course_chapter (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, course_id BIGINT NOT NULL REFERENCES learning_course(id),
 title VARCHAR(128), content CLOB, sort_order INT, deleted INT DEFAULT 0,
 created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE learning_course_section (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, chapter_id BIGINT NOT NULL REFERENCES learning_course_chapter(id),
 title VARCHAR(128), content CLOB, sort_order INT, deleted INT DEFAULT 0,
 created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE learning_course_section_activity (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, section_id BIGINT NOT NULL REFERENCES learning_course_section(id),
 activity_type VARCHAR(32) NOT NULL, reference_key VARCHAR(128) NOT NULL, title VARCHAR(128) NOT NULL,
 description VARCHAR(500), sort_order INT DEFAULT 0, required BOOLEAN DEFAULT TRUE, deleted INT DEFAULT 0,
 created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE learning_course_enrollment (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, course_id BIGINT NOT NULL REFERENCES learning_course(id), user_id BIGINT NOT NULL,
 status VARCHAR(16), enrolled_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(course_id, user_id)
);
CREATE TABLE learning_chapter_progress (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, enrollment_id BIGINT REFERENCES learning_course_enrollment(id),
 chapter_id BIGINT REFERENCES learning_course_chapter(id), progress_percent INT CHECK(progress_percent BETWEEN 0 AND 100),
 updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(enrollment_id, chapter_id)
);
CREATE TABLE learning_teaching_resource (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(160), description VARCHAR(1000), stage_code VARCHAR(32),
 subject VARCHAR(64), source_note VARCHAR(255), course_id BIGINT, chapter_id BIGINT,
 chapter_title VARCHAR(128), grade VARCHAR(32), textbook VARCHAR(255), knowledge_code VARCHAR(64),
 original_filename VARCHAR(255), mime_type VARCHAR(128),
 size_bytes BIGINT, object_key VARCHAR(255), status VARCHAR(24), rag_index_status VARCHAR(24),
 created_by BIGINT, reviewed_by BIGINT, review_note VARCHAR(500), reviewed_time TIMESTAMP,
 published_by BIGINT, published_time TIMESTAMP, created_time TIMESTAMP, updated_time TIMESTAMP
);
CREATE TABLE learning_teaching_resource_event (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, resource_id BIGINT, actor_id BIGINT, action VARCHAR(24),
 from_status VARCHAR(24), to_status VARCHAR(24), note VARCHAR(500), created_time TIMESTAMP
);
CREATE TABLE learning_teaching_resource_binding (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, resource_id BIGINT NOT NULL, course_id BIGINT NOT NULL,
 chapter_id BIGINT, chapter_title VARCHAR(128), created_time TIMESTAMP
);
