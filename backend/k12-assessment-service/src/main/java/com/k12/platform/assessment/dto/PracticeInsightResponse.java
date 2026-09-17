package com.k12.platform.assessment.dto;

import java.time.Instant;

/** 基于有限小测样本生成的学习建议，不是正式能力测评。 */
public record PracticeInsightResponse(
        String topic,
        int sampleCount,
        int averageScorePercent,
        int latestScorePercent,
        String action,
        String suggestion,
        Instant lastPracticedTime
) {
}
