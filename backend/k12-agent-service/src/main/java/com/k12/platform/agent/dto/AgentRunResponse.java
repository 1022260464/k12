package com.k12.platform.agent.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;

public record AgentRunResponse(
        String runId,
        String agentCode,
        Long userId,
        String sessionId,
        String executionMode,
        String inputText,
        JsonNode inputContext,
        String status,
        String outputText,
        JsonNode outputMetadata,
        String errorCode,
        String errorMessage,
        Long durationMs,
        Instant startedTime,
        Instant finishedTime,
        Instant createdTime,
        List<AgentArtifactResponse> artifacts
) {
}
