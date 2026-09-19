package com.k12.platform.learning.dto;

import java.time.Instant;

public record SectionSummaryResponse(Long id, Long chapterId, String title,
                                     Integer sortOrder, Instant updatedTime) {
}
