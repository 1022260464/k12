package com.k12.platform.learning.dto;

import java.util.List;

public record KnowledgeAlignmentReviewResponse(
        List<KnowledgeAlignmentItem> items,
        String summary,
        int alignedCount,
        int reviewCount,
        String source
) {
}
