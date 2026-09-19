package com.k12.platform.learning.dto;

import java.util.List;

public record KnowledgeChapterCoverSummary(
        Long courseId,
        Long chapterId,
        String title,
        String description,
        List<String> knowledgeCodes
) {
}
