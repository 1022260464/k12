package com.k12.platform.agent.messaging;

import com.fasterxml.jackson.databind.JsonNode;

public record AgentRunArtifactMessage(
        String artifactId,
        String kind,
        String mimeType,
        String title,
        String uri,
        JsonNode payload
) {
}
