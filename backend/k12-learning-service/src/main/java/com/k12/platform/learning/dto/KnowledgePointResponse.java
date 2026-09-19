package com.k12.platform.learning.dto;

public record KnowledgePointResponse(
        String code,
        String title,
        String stage,
        Integer difficulty,
        String reviewStatus,
        String categoryCode,
        String categoryTitle,
        String kind
) {
    /** 兼容旧调用：无分类字段。 */
    public KnowledgePointResponse(
            String code, String title, String stage, Integer difficulty, String reviewStatus
    ) {
        this(code, title, stage, difficulty, reviewStatus, null, null, "TOPIC");
    }
}
