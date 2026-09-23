package com.k12.platform.assessment.dto;

import java.time.Instant;
import java.util.List;

/** 形成性练习反馈，不属于作业或考试成绩。 */
public record PracticeAttemptResponse(
        Long id,
        String runId,
        String topic,
        String knowledgeCode,
        int score,
        int maxScore,
        int correctCount,
        int totalQuestions,
        String weakPoint,
        int hintCount,
        long durationMs,
        List<String> errorTypes,
        Instant createdTime,
        String badgeCode,
        String badgeName,
        boolean newlyEarned
) {
}
