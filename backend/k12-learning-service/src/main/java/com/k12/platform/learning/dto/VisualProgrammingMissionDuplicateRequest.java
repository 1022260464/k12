package com.k12.platform.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VisualProgrammingMissionDuplicateRequest(
        @NotBlank @Size(max = 64) String missionCode,
        @Size(max = 80) String title
) {
}
