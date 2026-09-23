package com.k12.platform.learning.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record KnowledgeRetrievalTestRequest(
        @NotBlank @Size(max = 4000) String query,
        @Min(1) @Max(100) Integer candidateCount,
        @Min(1) @Max(20) Integer topK,
        @Size(max = 32) String stageCode,
        @Size(max = 32) String grade,
        @Size(max = 255) String textbook,
        @Size(max = 64) String knowledgeCode) {
}
