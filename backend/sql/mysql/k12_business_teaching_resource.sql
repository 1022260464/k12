CREATE TABLE IF NOT EXISTS learning_teaching_resource (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(160) NOT NULL,
 description VARCHAR(1000),
 stage_code VARCHAR(32) NOT NULL,
 subject VARCHAR(64) NOT NULL,
 source_note VARCHAR(255) NOT NULL,
 original_filename VARCHAR(255) NOT NULL,
 mime_type VARCHAR(128) NOT NULL,
 size_bytes BIGINT NOT NULL,
 object_key VARCHAR(255) NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
 rag_index_status VARCHAR(24) NOT NULL DEFAULT 'NOT_INDEXED',
 created_by BIGINT NOT NULL,
 reviewed_by BIGINT,
 review_note VARCHAR(500),
 reviewed_time DATETIME(3),
 published_by BIGINT,
 published_time DATETIME(3),
 created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE (object_key),
 KEY (status, updated_time),
 KEY (created_by, updated_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_teaching_resource_event (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    resource_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    action VARCHAR(24) NOT NULL,
    from_status VARCHAR(24) NULL,
    to_status VARCHAR(24) NOT NULL,
    note VARCHAR(500) NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_teaching_resource_event_resource (resource_id, id),
    CONSTRAINT fk_teaching_resource_event_resource
        FOREIGN KEY (resource_id) REFERENCES learning_teaching_resource(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
