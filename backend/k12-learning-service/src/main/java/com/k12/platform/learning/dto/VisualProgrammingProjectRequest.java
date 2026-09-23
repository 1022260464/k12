package com.k12.platform.learning.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

public record VisualProgrammingProjectRequest(@NotNull JsonNode workspace) {
}

