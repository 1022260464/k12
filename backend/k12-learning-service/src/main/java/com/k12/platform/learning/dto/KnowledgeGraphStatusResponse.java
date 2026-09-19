package com.k12.platform.learning.dto;

public record KnowledgeGraphStatusResponse(
        boolean enabled,
        boolean ready,
        long knowledgePointCount,
        String message
) {
}
