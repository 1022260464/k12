package com.k12.platform.agent.dto;

import java.time.Instant;

public record AgentResponse(
        Long id,
        String code,
        String name,
        String type,
        String description,
        String status,
        Instant updatedTime
) {
}
