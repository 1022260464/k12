package com.k12.platform.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AgentRequest(
        @NotBlank
        @Pattern(regexp = "[a-z][a-z0-9-]{1,63}", message = "code must use lowercase letters, numbers and hyphens")
        String code,
        @NotBlank String name,
        @NotBlank String type,
        String description
) {
}
