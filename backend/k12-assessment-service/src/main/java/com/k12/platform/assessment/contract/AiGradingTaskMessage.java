package com.k12.platform.assessment.contract;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Java 发给 Python AI 批改 Worker 的稳定消息协议。
 * schemaVersion 用于后续兼容升级；消息中不包含 JWT、密码等认证信息。
 */
public record AiGradingTaskMessage(
        String schemaVersion,
        String taskId,
        Long submissionId,
        Long homeworkId,
        Long studentUserId,
        List<SubjectiveAnswer> answers,
        Instant requestedAt
) {
    public static final String CURRENT_SCHEMA_VERSION = "1.0";

    public record SubjectiveAnswer(
            Long questionId,
            String stem,
            String studentAnswer,
            String referenceAnswer,
            String gradingRule,
            BigDecimal maxScore
    ) {
    }
}
