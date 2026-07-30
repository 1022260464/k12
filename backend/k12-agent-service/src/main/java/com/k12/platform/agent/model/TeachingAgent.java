package com.k12.platform.agent.model;

import java.time.Instant;

public record TeachingAgent(
        Long id,
        String name,
        String type,
        String description,
        String status,
        Instant updatedTime
) {
}
