-- Formal course sections may launch only controlled in-product teaching activities.
-- Run once on existing k12_business databases before deploying the matching Learning Service.
USE k12_business;

CREATE TABLE IF NOT EXISTS learning_course_section_activity (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    section_id BIGINT UNSIGNED NOT NULL,
    activity_type VARCHAR(32) NOT NULL COMMENT 'CAT_LESSON, TEACHING_TOPIC or PYTHON_LAB',
    reference_key VARCHAR(128) NOT NULL COMMENT 'Controlled in-product activity identifier, never an arbitrary URL',
    title VARCHAR(128) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    required TINYINT(1) NOT NULL DEFAULT 1,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_section_activity_ref (section_id, activity_type, reference_key, deleted),
    KEY idx_section_activity_order (section_id, deleted, sort_order, id),
    CONSTRAINT fk_section_activity_section FOREIGN KEY (section_id)
        REFERENCES learning_course_section(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_section_activity_type CHECK (activity_type IN ('CAT_LESSON', 'TEACHING_TOPIC', 'PYTHON_LAB'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Controlled activities bound to formal course sections';
