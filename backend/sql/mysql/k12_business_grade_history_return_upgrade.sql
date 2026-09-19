-- Allow NULL score on grade history so "退回重做" can record a snapshot without a numeric score.
-- MySQL 8.0+, idempotent and safe to rerun.

USE k12_business;

SELECT COUNT(*) INTO @chk_exists
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'k12_business'
  AND TABLE_NAME = 'assessment_homework_grade_history'
  AND CONSTRAINT_NAME = 'chk_grade_history_score'
  AND CONSTRAINT_TYPE = 'CHECK';

SET @drop_chk_sql = IF(
    @chk_exists > 0,
    'ALTER TABLE assessment_homework_grade_history DROP CHECK chk_grade_history_score',
    'DO 0'
);
PREPARE k12_stmt FROM @drop_chk_sql;
EXECUTE k12_stmt;
DEALLOCATE PREPARE k12_stmt;

ALTER TABLE assessment_homework_grade_history
    MODIFY COLUMN score DECIMAL(5,2) NULL DEFAULT NULL COMMENT 'Score snapshot; NULL when returned for redo';

ALTER TABLE assessment_homework_grade_history
    ADD CONSTRAINT chk_grade_history_score CHECK (score IS NULL OR (score BETWEEN 0 AND 100));
