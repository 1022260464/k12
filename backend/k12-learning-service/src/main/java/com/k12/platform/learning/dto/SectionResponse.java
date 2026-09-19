package com.k12.platform.learning.dto;

import java.time.Instant;

public record SectionResponse(Long id, Long chapterId, String title, String content,
                              Integer sortOrder, Instant updatedTime) {
}
