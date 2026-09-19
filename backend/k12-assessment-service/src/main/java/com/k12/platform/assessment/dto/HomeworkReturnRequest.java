package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** 教师退回学生作业，允许其重新提交。 */
public record HomeworkReturnRequest(
        @NotNull @Positive Long studentUserId,
        @Size(max = 2000) String feedback,
        @NotNull @PositiveOrZero Integer expectedVersion
) {
}
