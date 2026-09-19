package com.k12.platform.learning.dto;

public record KnowledgeNeighborResponse(
        String code,
        String title,
        String relation,
        String direction
) {
}
