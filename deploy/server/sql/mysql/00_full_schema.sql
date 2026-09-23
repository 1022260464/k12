-- Fresh-install schema entrypoint. Run only against a new/empty MySQL volume.
-- Historical ALTER scripts that are already consolidated into *_init.sql are intentionally omitted.

SOURCE /opt/k12/sql/mysql/k12_auth_init.sql;
SOURCE /opt/k12/sql/mysql/k12_auth_permission_upgrade.sql;

SOURCE /opt/k12/sql/mysql/k12_business_init.sql;
SOURCE /opt/k12/sql/mysql/k12_business_teaching_resource.sql;
SOURCE /opt/k12/sql/mysql/k12_business_teaching_resource_context_upgrade.sql;
SOURCE /opt/k12/sql/mysql/k12_business_teaching_resource_binding.sql;
SOURCE /opt/k12/sql/mysql/k12_business_picture_books.sql;
SOURCE /opt/k12/sql/mysql/k12_business_ai_practice.sql;
SOURCE /opt/k12/sql/mysql/k12_business_ai_mastery_upgrade.sql;
SOURCE /opt/k12/sql/mysql/k12_business_ai_practice_process_upgrade.sql;
SOURCE /opt/k12/sql/mysql/k12_business_code_execution_quota.sql;
SOURCE /opt/k12/sql/mysql/k12_business_visual_programming_mission_upgrade.sql;

CREATE TABLE IF NOT EXISTS k12_business.schema_migration_history (
    version VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    installed_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO k12_business.schema_migration_history(version, description)
VALUES ('2026-09-23-full', 'Fresh deployment schema including P1-P4 features')
ON DUPLICATE KEY UPDATE description=VALUES(description);

