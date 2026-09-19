package com.k12.platform.learning.dto;

public record KnowledgeGapResponse(
        String code,
        String title,
        Integer masteryPercent,
        boolean weak
) {
}
