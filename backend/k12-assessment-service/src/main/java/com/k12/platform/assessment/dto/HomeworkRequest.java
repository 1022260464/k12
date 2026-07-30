package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record HomeworkRequest(
        @NotNull Long courseId,
        @NotBlank String title,
        String description,
        @NotBlank String status
) {
}
