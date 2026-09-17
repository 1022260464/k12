package com.k12.platform.learning.dto;

import java.time.Instant;

/** 目录不包含正文，避免一次列表查询返回所有章节的长文本。 */
public record ChapterSummaryResponse(Long id, Long courseId, String title, Integer sortOrder, Instant updatedTime) {
}
