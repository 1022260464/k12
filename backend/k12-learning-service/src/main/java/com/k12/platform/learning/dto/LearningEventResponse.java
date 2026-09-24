package com.k12.platform.learning.dto;

import java.time.Instant;

/** 服务端确认的学习行为；不包含单纯页面访问。 */
public record LearningEventResponse(
        Long id,
        String eventType,
        String sourceType,
        String sourceId,
        Long courseId,
        Long chapterId,
        String knowledgeCode,
        String title,
        String detail,
        Instant occurredTime
) {
}
