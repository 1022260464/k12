package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record HomeworkSubmitRequest(
        @NotBlank @Size(max = 5000) String answerContent
) {
}
