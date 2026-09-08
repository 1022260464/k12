-- Apply after k12_auth_init.sql / existing RBAC upgrade. Re-login after granting permissions.
USE k12_auth;

CREATE TABLE IF NOT EXISTS sys_learning_profile (
    user_id BIGINT UNSIGNED NOT NULL,
    school_stage VARCHAR(32) NOT NULL,
    grade INT NOT NULL,
    textbook VARCHAR(128) NULL,
    interests VARCHAR(4000) NOT NULL DEFAULT '[]',
    updated_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id),
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES sys_user(id),
    CONSTRAINT chk_profile_grade CHECK (grade BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO sys_permission(permission_name, permission_code, description)
VALUES ('Submit homework', 'homework:submit', 'Submit assigned homework as current student'),
       ('Grade homework', 'homework:grade', 'Grade and review owned homework submissions'),
       ('Read learning profile', 'learning-profile:read', 'Read own learning profile'),
       ('Update learning profile', 'learning-profile:update', 'Update own learning profile')
ON DUPLICATE KEY UPDATE permission_code = VALUES(permission_code);

INSERT INTO sys_role_permission(role_id, permission_id)
SELECT r.id, p.id FROM sys_role r JOIN sys_permission p
  ON (r.role_code = 'ROLE_ADMIN' AND p.permission_code IN ('homework:submit','homework:grade','learning-profile:read','learning-profile:update'))
  OR (r.role_code = 'ROLE_STUDENT' AND p.permission_code IN ('homework:submit','learning-profile:read','learning-profile:update'))
  OR (r.role_code = 'ROLE_TEACHER' AND p.permission_code = 'homework:grade')
WHERE r.status = 1 AND p.status = 1
  AND NOT EXISTS (SELECT 1 FROM sys_role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
