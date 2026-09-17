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
