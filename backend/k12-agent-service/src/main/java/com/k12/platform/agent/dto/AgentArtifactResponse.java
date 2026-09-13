package com.k12.platform.agent.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

public record AgentArtifactResponse(
        String artifactId,
        String kind,
        String title,
        String mimeType,
        String storageUri,
        JsonNode payload,
        Long sizeBytes,
        String checksumSha256,
        Instant createdTime
) {
}
