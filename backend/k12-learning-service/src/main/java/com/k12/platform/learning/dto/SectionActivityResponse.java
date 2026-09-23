package com.k12.platform.learning.dto;

import java.time.Instant;

public record SectionActivityResponse(
        Long id,
        Long sectionId,
        String activityType,
        String referenceKey,
        String title,
        String description,
        Integer sortOrder,
        Boolean required,
        Instant updatedTime
) {
}
