package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SubmissionAnswerRequest(
        @NotNull Long questionId,
        @Size(max = 20) List<@Size(max = 64) String> selectedAnswers,
        @Size(max = 10000) String answerText
) {
}
