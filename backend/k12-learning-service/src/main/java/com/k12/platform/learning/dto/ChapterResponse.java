package com.k12.platform.learning.dto;

import java.time.Instant;

public record ChapterResponse(Long id, Long courseId, String title, String content,
                              Integer sortOrder, Instant updatedTime) {
}

