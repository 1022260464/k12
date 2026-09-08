package com.k12.platform.iam.dto;

import jakarta.validation.constraints.*;
import java.util.List;

public record LearningProfileRequest(
        @NotBlank @Pattern(regexp = "PRIMARY_LOWER|PRIMARY_UPPER|JUNIOR_HIGH|SENIOR_HIGH") String schoolStage,
        @NotNull @Min(1) @Max(12) Integer grade,
        @Size(max = 128) String textbook,
        @NotNull @Size(max = 10) List<@NotBlank @Size(max = 40) String> interests
) {}
