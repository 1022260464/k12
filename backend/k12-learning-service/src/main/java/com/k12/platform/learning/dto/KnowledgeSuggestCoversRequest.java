package com.k12.platform.learning.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record KnowledgeSuggestCoversRequest(
        @Size(max = 128) String title,
        @Size(max = 100000) String content,
        @Size(max = 32) String stage,
        @Min(1) @Max(20) Integer limit
) {
}
