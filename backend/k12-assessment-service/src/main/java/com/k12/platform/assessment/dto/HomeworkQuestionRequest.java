package com.k12.platform.assessment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record HomeworkQuestionRequest(
        @NotNull QuestionType type,
        @NotBlank @Size(max = 4000) String stem,
        @NotNull @DecimalMin("0.01") @DecimalMax("100.00") BigDecimal score,
        int sortOrder,
        @Valid @Size(max = 20) List<QuestionOptionRequest> options,
        @Size(max = 20) List<@NotBlank @Size(max = 8) String> correctAnswers,
        @Size(max = 5000) String referenceAnswer,
        @Size(max = 5000) String analysis
) {
    public enum QuestionType {
        SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER
    }
}
