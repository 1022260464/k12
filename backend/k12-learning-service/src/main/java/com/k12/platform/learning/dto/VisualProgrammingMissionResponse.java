package com.k12.platform.learning.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;

/** 管理端关卡详情响应。 */
public record VisualProgrammingMissionResponse(
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
        JsonNode config,
        List<String> toolboxCategories,
        Integer sortOrder,
        String status,
        Integer contentVersion,
        Integer lockVersion,
        Long createdBy,
        Long updatedBy,
        Instant publishedTime,
        Instant createdTime,
        Instant updatedTime,
        long studentProgressCount
) {
}
