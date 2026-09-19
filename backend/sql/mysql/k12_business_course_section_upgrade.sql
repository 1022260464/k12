-- Existing k12_business databases: run once before restarting Learning Service.
USE k12_business;

CREATE TABLE IF NOT EXISTS learning_course_section (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    chapter_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(128) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_section_chapter_order (chapter_id, deleted, sort_order, id),
    CONSTRAINT fk_section_chapter FOREIGN KEY (chapter_id) REFERENCES learning_course_chapter(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
