package com.k12.platform.learning.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record KnowledgeAlignmentReviewRequest(
        @Size(max = 128) String title,
        @Size(max = 100000) String content,
        @Size(max = 32) String stage,
        @NotEmpty List<@Size(max = 64) String> knowledgeCodes
) {
}
