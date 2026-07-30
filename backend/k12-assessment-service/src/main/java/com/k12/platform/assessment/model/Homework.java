package com.k12.platform.assessment.model;

import java.time.Instant;

public record Homework(
        Long id,
        Long courseId,
        String title,
        String description,
        String status,
        Instant updatedTime
) {
}
