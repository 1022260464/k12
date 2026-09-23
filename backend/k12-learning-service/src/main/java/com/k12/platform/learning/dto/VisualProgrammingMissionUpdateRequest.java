package com.k12.platform.learning.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record VisualProgrammingMissionUpdateRequest(
        @NotBlank @Size(max = 32) String templateCode,
        @NotBlank @Size(max = 80) String title,
        @NotBlank @Size(max = 40) String shortTitle,
        @NotBlank @Size(max = 32) String stageCode,
        @NotBlank @Size(max = 128) String knowledgeCode,
        @NotBlank @Size(max = 300) String description,
        @NotBlank @Size(max = 600) String story,
        @NotBlank @Size(max = 400) String goal,
        @NotBlank @Size(max = 600) String hint,
        @NotBlank @Size(max = 40) String badge,
        @NotBlank @Size(max = 500) String reflection,
        @NotNull List<@NotBlank @Size(max = 40) String> steps,
        @NotNull List<@NotBlank @Size(max = 24) String> concepts,
        @NotNull JsonNode config,
        Integer sortOrder,
        @NotNull Integer lockVersion
) {
}
