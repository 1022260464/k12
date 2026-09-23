package com.k12.platform.learning.dto;

import java.time.Instant;
import java.util.List;

public record PictureBookResponse(
        Long id,
        String bookCode,
        String title,
        String subtitle,
        String summary,
        String stageCode,
        String knowledgeCode,
        String coverObjectKey,
        String coverFallbackUrl,
        String coverUrl,
        String challengeType,
        String challengeReference,
        Integer sortOrder,
        String status,
        String reviewNote,
        Long reviewedBy,
        Instant reviewedTime,
        Instant publishedTime,
        Integer contentVersion,
        Integer lockVersion,
        List<PictureBookPageResponse> pages,
        Instant updatedTime
) {
}
