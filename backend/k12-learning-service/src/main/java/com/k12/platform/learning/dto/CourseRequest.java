package com.k12.platform.learning.dto;

import jakarta.validation.constraints.NotBlank;

public record CourseRequest(
        @NotBlank String title,
        @NotBlank String subject,
        @NotBlank String gradeLevel,
        String description
) {
}
