package com.k12.platform.learning.dto;

import java.util.List;

public record KnowledgeRecommendRequest(
        String focusCode,
        List<MasteryHint> mastery
) {
    public record MasteryHint(String knowledgeCode, Integer masteryPercent) {
    }
}
