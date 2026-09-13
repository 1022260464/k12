package com.k12.platform.agent.client.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record RuntimeArtifactResponse(
        String artifactId,
        String kind,
        String mimeType,
        String title,
        String uri,
        JsonNode payload
) {
}
