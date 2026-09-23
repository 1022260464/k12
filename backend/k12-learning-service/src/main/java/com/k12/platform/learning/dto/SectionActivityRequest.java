package com.k12.platform.learning.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SectionActivityRequest(
        @NotBlank @Pattern(regexp = "CAT_LESSON|TEACHING_TOPIC|PYTHON_LAB") String activityType,
        @NotBlank @Size(max = 128) @Pattern(regexp = "[a-z0-9][a-z0-9._-]{0,127}") String referenceKey,
        @NotBlank @Size(max = 128) String title,
        @Size(max = 500) String description,
        @NotNull @Min(0) @Max(10000) Integer sortOrder,
        @NotNull Boolean required
) {
}
