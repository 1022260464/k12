package com.k12.platform.agent.dto;

import jakarta.validation.constraints.NotBlank;

public record AgentRequest(
        @NotBlank String name,
        @NotBlank String type,
        String description
) {
}
