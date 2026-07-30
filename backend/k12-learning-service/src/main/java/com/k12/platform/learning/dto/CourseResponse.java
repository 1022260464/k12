package com.k12.platform.learning.dto;

import java.time.Instant;

public record CourseResponse(
        Long id,
        String title,
        String subject,
        String gradeLevel,
        String description,
        Instant updatedTime
) {
}
