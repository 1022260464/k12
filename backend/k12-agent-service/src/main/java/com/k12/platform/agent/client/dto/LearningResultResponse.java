package com.k12.platform.agent.client.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Assessment 学习结果的最小只读契约。
 *
 * <p>刻意不声明 answerContent、studentUserId、gradedBy 等字段，防止答案和无关身份信息
 * 被传入模型。Jackson 会忽略下游响应中的其他字段。</p>
 */
public record LearningResultResponse(
        Long homeworkId,
        Long courseId,
        String status,
        BigDecimal score,
        String feedback,
        Instant submittedTime,
        Instant gradedTime
) {
}
