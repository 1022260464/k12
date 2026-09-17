package com.k12.platform.assessment.dto;

import java.time.Instant;

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
        Instant createdTime
) {
}
