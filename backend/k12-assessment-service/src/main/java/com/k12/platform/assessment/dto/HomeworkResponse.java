package com.k12.platform.assessment.dto;

import java.time.Instant;

public record HomeworkResponse(
        Long id,
        Long courseId,
        String title,
        String description,
        String status,
        Instant updatedTime
) {
}
