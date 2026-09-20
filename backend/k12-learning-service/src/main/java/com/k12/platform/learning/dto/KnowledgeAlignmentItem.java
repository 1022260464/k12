package com.k12.platform.learning.dto;

public record KnowledgeAlignmentItem(
        String code,
        String title,
        boolean aligned,
        String verdict,
        double score,
        String reason
) {
}
