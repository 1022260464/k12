package com.k12.platform.learning.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record PictureBookUpdateRequest(
        @NotBlank @Size(max = 100) String title,
        @Size(max = 200) String subtitle,
        @NotBlank @Size(max = 600) String summary,
        @NotBlank @Size(max = 32) String stageCode,
        @NotBlank @Size(max = 128) String knowledgeCode,
        @Size(max = 500) String coverObjectKey,
        @Size(max = 500) String coverFallbackUrl,
        @NotBlank @Pattern(regexp = "CAT_LESSON|VISUAL_MISSION|AI_TOPIC") String challengeType,
        @NotBlank @Size(max = 128) String challengeReference,
        Integer sortOrder,
        @NotEmpty List<@Valid PictureBookPageRequest> pages,
        @NotNull Integer lockVersion
) {
}
