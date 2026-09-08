package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

public record HomeworkRequest(
        @NotNull @Positive Long courseId,
        @NotBlank @Size(max = 128) String title,
        @Size(max = 1000) String description,
        @NotBlank @Pattern(regexp = "DRAFT|PUBLISHED|CLOSED") String status
) {
}
