-- 学生学习活动流水。先执行本脚本，再重启 Learning 与 Assessment 服务。
-- 只记录已经由服务端确认成功的业务行为，不记录页面浏览或前端自报时长。
CREATE TABLE IF NOT EXISTS k12_business.learning_event (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    student_user_id BIGINT UNSIGNED NOT NULL COMMENT '逻辑引用 k12_auth.sys_user.id',
    event_type VARCHAR(48) NOT NULL COMMENT 'COURSE_PROGRESS/HOMEWORK_SUBMITTED/PRACTICE_COMPLETED 等',
    source_type VARCHAR(32) NOT NULL COMMENT 'CHAPTER/HOMEWORK/PRACTICE/VISUAL_MISSION',
    source_id VARCHAR(128) NOT NULL,
    course_id BIGINT UNSIGNED DEFAULT NULL,
    chapter_id BIGINT UNSIGNED DEFAULT NULL,
    knowledge_code VARCHAR(128) DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    detail VARCHAR(500) DEFAULT NULL,
    metadata_json JSON DEFAULT NULL,
    idempotency_key VARCHAR(191) NOT NULL,
    occurred_time DATETIME(3) NOT NULL,
    created_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_learning_event_idempotency (idempotency_key),
    KEY idx_learning_event_student_time (student_user_id, occurred_time, id),
    KEY idx_learning_event_student_type_time (student_user_id, event_type, occurred_time),
    KEY idx_learning_event_course_time (course_id, occurred_time)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Append-only student learning activity stream';

-- 幂等回填现有可恢复记录。旧表只保存当前进度，因此无法还原已经被覆盖的每次访问。
INSERT IGNORE INTO k12_business.learning_event
    (student_user_id, event_type, source_type, source_id, course_id, chapter_id,
     knowledge_code, title, detail, metadata_json, idempotency_key, occurred_time)
SELECT enrollment.user_id, 'COURSE_PROGRESS', 'CHAPTER', CAST(progress.chapter_id AS CHAR),
       enrollment.course_id, progress.chapter_id, NULL, chapter.title,
       IF(progress.progress_percent = 100, '完成课程章节', CONCAT('课程进度更新至 ', progress.progress_percent, '%')),
       JSON_OBJECT('progressPercent', progress.progress_percent),
       CONCAT('backfill-course-progress:', progress.id, ':', progress.progress_percent), progress.updated_time
FROM k12_business.learning_chapter_progress progress
JOIN k12_business.learning_course_enrollment enrollment ON enrollment.id = progress.enrollment_id
JOIN k12_business.learning_course_chapter chapter ON chapter.id = progress.chapter_id;

INSERT IGNORE INTO k12_business.learning_event
    (student_user_id, event_type, source_type, source_id, course_id, chapter_id,
     knowledge_code, title, detail, metadata_json, idempotency_key, occurred_time)
SELECT submission.student_user_id, 'HOMEWORK_SUBMITTED', 'HOMEWORK', CAST(homework.id AS CHAR),
       submission.course_id, NULL, NULL, homework.title, '已提交作业', NULL,
       CONCAT('backfill-homework-submitted:', submission.id, ':', submission.version), submission.submitted_time
FROM k12_business.assessment_homework_submission submission
JOIN k12_business.assessment_homework homework ON homework.id = submission.homework_id
WHERE submission.submitted_time IS NOT NULL;

INSERT IGNORE INTO k12_business.learning_event
    (student_user_id, event_type, source_type, source_id, course_id, chapter_id,
     knowledge_code, title, detail, metadata_json, idempotency_key, occurred_time)
SELECT submission.student_user_id, 'HOMEWORK_GRADED', 'HOMEWORK', CAST(homework.id AS CHAR),
       submission.course_id, NULL, NULL, homework.title,
       IF(submission.score IS NULL, '教师已完成批改', CONCAT('教师已批改，得分 ', submission.score)),
       IF(submission.score IS NULL, NULL, JSON_OBJECT('score', submission.score)),
       CONCAT('backfill-homework-graded:', submission.id, ':', submission.version), submission.graded_time
FROM k12_business.assessment_homework_submission submission
JOIN k12_business.assessment_homework homework ON homework.id = submission.homework_id
WHERE submission.graded_time IS NOT NULL AND submission.status = 'GRADED';

INSERT IGNORE INTO k12_business.learning_event
    (student_user_id, event_type, source_type, source_id, course_id, chapter_id,
     knowledge_code, title, detail, metadata_json, idempotency_key, occurred_time)
SELECT attempt.student_user_id, 'PRACTICE_COMPLETED', 'PRACTICE', CAST(attempt.id AS CHAR),
       NULL, NULL, attempt.knowledge_code, attempt.topic,
       CONCAT('完成 AI 小测，得分 ', FLOOR(attempt.score * 100 / attempt.max_score), '%'),
       JSON_OBJECT('scorePercent', FLOOR(attempt.score * 100 / attempt.max_score),
                   'correctCount', attempt.correct_count),
       CONCAT('backfill-practice:', attempt.id), attempt.created_time
FROM k12_business.assessment_ai_practice_attempt attempt
WHERE attempt.max_score > 0;

INSERT IGNORE INTO k12_business.learning_event
    (student_user_id, event_type, source_type, source_id, course_id, chapter_id,
     knowledge_code, title, detail, metadata_json, idempotency_key, occurred_time)
SELECT project.student_user_id,
       IF(project.status = 'COMPLETED', 'VISUAL_MISSION_COMPLETED', 'VISUAL_MISSION_ATTEMPTED'),
       'VISUAL_MISSION', project.mission_code, NULL, NULL, mission.knowledge_code, mission.title,
       IF(project.status = 'COMPLETED', '图形化编程关卡完成', '保存一次图形化编程尝试'),
       JSON_OBJECT('stars', project.best_stars, 'attemptCount', project.attempt_count),
       CONCAT('backfill-visual-mission:', project.id, ':', project.attempt_count), project.updated_time
FROM k12_business.learning_visual_programming_project project
JOIN k12_business.learning_visual_programming_mission mission ON mission.mission_code = project.mission_code;
