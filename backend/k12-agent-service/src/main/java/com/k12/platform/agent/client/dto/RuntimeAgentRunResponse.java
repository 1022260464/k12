package com.k12.platform.agent.client.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

public record RuntimeAgentRunResponse(
        String runId,
        String agentCode,
        String status,
        String outputText,
        List<RuntimeArtifactResponse> artifacts,
        JsonNode metadata
) {
}
