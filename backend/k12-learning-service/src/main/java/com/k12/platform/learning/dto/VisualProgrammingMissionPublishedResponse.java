package com.k12.platform.learning.dto;

import java.util.List;
import java.util.Map;

/** 学生端已发布关卡公开响应，不含管理字段。 */
public record VisualProgrammingMissionPublishedResponse(
        Long id,
        String missionCode,
        String templateCode,
        String title,
        String shortTitle,
        String stageCode,
        String knowledgeCode,
        String description,
        String story,
        String goal,
        String hint,
        String badge,
        String reflection,
        List<String> steps,
        List<String> concepts,
        List<String> toolboxCategories,
        Map<String, Object> runtimeConfig,
        Integer sortOrder,
        Integer contentVersion
) {
}
