package com.k12.platform.learning.dto;

import java.util.List;

public record CourseProgressResponse(Long courseId, int totalChapters, int completedChapters,
                                     int progressPercent, List<ChapterProgressResponse> chapters) {
}

