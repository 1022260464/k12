package com.k12.platform.learning.dto;

import java.util.List;

public record ChapterCoversResponse(
        Long courseId,
        Long chapterId,
        List<KnowledgePointResponse> covers
) {
}
