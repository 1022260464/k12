package com.k12.platform.assessment.dto;

import java.time.Instant;

/** 形成性练习的累计结果，仅作学习引导，不是正式能力评级。 */
public record KnowledgeMasteryResponse(
        String knowledgeCode,
        String topic,
        int attemptCount,
        int masteryPercent,
        int latestScorePercent,
        String action,
        Instant lastPracticedTime
) {
}
