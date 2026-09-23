package com.k12.platform.learning.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

public record VisualProgrammingProjectResponse(
        String missionCode,
        JsonNode workspace,
        String status,
        int bestStars,
        int attemptCount,
        Instant completedTime,
        Instant updatedTime,
        VisualProgrammingEvaluationResponse evaluation
) {
}

