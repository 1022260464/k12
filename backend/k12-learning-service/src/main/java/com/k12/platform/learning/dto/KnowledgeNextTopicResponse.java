package com.k12.platform.learning.dto;

import java.util.List;

public record KnowledgeNextTopicResponse(
        String code,
        String title,
        String reason,
        List<String> missingPrerequisites
) {
}
