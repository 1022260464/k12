package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record QuestionOptionRequest(
        @NotBlank @Pattern(regexp = "[A-Z0-9]{1,8}") String key,
        @NotBlank @Size(max = 1000) String content,
        int sortOrder
) {
}
