package com.k12.platform.learning.dto;

import java.time.Instant;

public record ChapterProgressResponse(Long chapterId, String title, int progressPercent, Instant updatedTime) {
}

