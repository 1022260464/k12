package com.k12.platform.learning.dto;

public record KnowledgeEdgeResponse(
        String fromCode,
        String toCode,
        String relation
) {
}
