package com.k12.platform.learning.dto;

public record KnowledgeCoverSuggestion(
        String code,
        String title,
        double score,
        String reason
) {
}
