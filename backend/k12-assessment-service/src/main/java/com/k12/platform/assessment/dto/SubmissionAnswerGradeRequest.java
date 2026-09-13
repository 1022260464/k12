package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record SubmissionAnswerGradeRequest(
        @NotNull @DecimalMin("0.00") BigDecimal score,
        @Size(max = 2000) String feedback,
        @NotNull Integer expectedSubmissionVersion
) {
}
