package com.k12.platform.learning.service;

import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.dto.LearningEventListResponse;
import com.k12.platform.learning.dto.LearningEventResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;

/** 追加式学习流水；幂等键保证业务重试不会制造重复成长记录。 */
@Service
public class LearningEventService {
    private static final int MAX_DAYS = 90;
    private static final int MAX_LIMIT = 200;

    private final JdbcTemplate jdbcTemplate;

    public LearningEventService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void record(long studentUserId, String eventType, String sourceType, String sourceId,
                       Long courseId, Long chapterId, String knowledgeCode,
                       String title, String detail, String metadataJson,
                       String idempotencyKey, Instant occurredTime) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO learning_event
                        (student_user_id, event_type, source_type, source_id, course_id, chapter_id,
                         knowledge_code, title, detail, metadata_json, idempotency_key, occurred_time)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, studentUserId, eventType, sourceType, sourceId, courseId, chapterId,
                    knowledgeCode, title, detail, metadataJson, idempotencyKey,
                    Timestamp.from(occurredTime == null ? Instant.now() : occurredTime));
        } catch (DuplicateKeyException ignored) {
            // 同一个已完成业务动作的网络重试是幂等成功。
        }
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or (hasAuthority('"
            + K12Authorities.ROLE_STUDENT + "') and hasAuthority('" + K12Authorities.COURSE_READ + "'))")
    public LearningEventListResponse currentUserEvents(int days, int limit) {
        if (days < 1 || days > MAX_DAYS) {
            throw new IllegalArgumentException("days 必须在 1 到 " + MAX_DAYS + " 之间");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new IllegalArgumentException("limit 必须在 1 到 " + MAX_LIMIT + " 之间");
        }
        long userId = K12SecurityContext.requireUserId();
        Instant since = Instant.now().minusSeconds(days * 86_400L);
        return new LearningEventListResponse(jdbcTemplate.query("""
                SELECT id, event_type, source_type, source_id, course_id, chapter_id,
                       knowledge_code, title, detail, occurred_time
                FROM learning_event
                WHERE student_user_id = ? AND occurred_time >= ?
                ORDER BY occurred_time DESC, id DESC
                LIMIT ?
                """, (rs, rowNum) -> new LearningEventResponse(
                rs.getLong("id"), rs.getString("event_type"), rs.getString("source_type"),
                rs.getString("source_id"), nullableLong(rs, "course_id"), nullableLong(rs, "chapter_id"),
                rs.getString("knowledge_code"), rs.getString("title"), rs.getString("detail"),
                rs.getTimestamp("occurred_time").toInstant()), userId, Timestamp.from(since), limit));
    }

    private Long nullableLong(java.sql.ResultSet resultSet, String column) throws java.sql.SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }
}
