package com.k12.platform.learning.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SectionRequest(
        @NotBlank @Size(max = 128) String title,
        @NotBlank @Size(max = 100000) String content,
        @NotNull @Min(0) @Max(10000) Integer sortOrder
) {
}
