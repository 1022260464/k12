package com.k12.platform.agent.client.dto;

/** 只把形成性练习摘要传入教学上下文，不传学生答案或判分键。 */
public record PracticeAttemptSummaryResponse(
        String topic,
        Integer score,
        Integer maxScore,
        Integer correctCount,
        Integer totalQuestions,
        String weakPoint
) {
}
