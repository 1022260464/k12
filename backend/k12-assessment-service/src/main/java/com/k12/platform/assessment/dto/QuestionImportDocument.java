package com.k12.platform.assessment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record QuestionImportDocument(
        @NotNull @Min(1) @Max(1) Integer version,
        @NotEmpty @Size(max = 100) List<@Valid HomeworkQuestionRequest> questions
) { }
