package com.k12.platform.learning.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record PersonalizedCourseRequest(
        @Size(max = 30) List<@Valid MasteryHint> mastery,
        @Min(1) @Max(12) Integer limit
) {
    public record MasteryHint(
            @NotBlank @Size(max = 128) String knowledgeCode,
            @NotNull @Min(0) @Max(100) Integer masteryPercent
    ) { }
}
