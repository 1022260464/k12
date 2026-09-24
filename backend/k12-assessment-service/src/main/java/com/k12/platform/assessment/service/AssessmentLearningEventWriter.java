package com.k12.platform.assessment.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;

/** 将测评域已确认的结果追加到统一学习流水；不接收前端直接写入。 */
@Service
public class AssessmentLearningEventWriter {
    private final JdbcTemplate jdbcTemplate;

    public AssessmentLearningEventWriter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void record(long studentUserId, String eventType, String sourceType, String sourceId,
                       Long courseId, String knowledgeCode, String title, String detail,
                       String metadataJson, String idempotencyKey, Instant occurredTime) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO learning_event
                        (student_user_id, event_type, source_type, source_id, course_id, chapter_id,
                         knowledge_code, title, detail, metadata_json, idempotency_key, occurred_time)
                    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
                    """, studentUserId, eventType, sourceType, sourceId, courseId, knowledgeCode,
                    title, detail, metadataJson, idempotencyKey,
                    Timestamp.from(occurredTime == null ? Instant.now() : occurredTime));
        } catch (DuplicateKeyException ignored) {
            // 提交和批改接口重试时不重复生成学习动态。
        }
    }
}
