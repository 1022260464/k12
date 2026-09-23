package com.k12.platform.learning.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PictureBookPageRequest(
        @Min(1) @Max(50) int pageNo,
        @NotBlank @Size(max = 100) String title,
        @NotBlank @Size(max = 1200) String narration,
        @Size(max = 500) String prompt,
        @Size(max = 500) String imageObjectKey,
        @Size(max = 500) String imageFallbackUrl,
        @NotBlank @Size(max = 300) String altText,
        JsonNode interaction
) {
}
