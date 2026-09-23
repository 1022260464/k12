package com.k12.platform.learning.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record PictureBookPageResponse(
        Long id,
        int pageNo,
        String title,
        String narration,
        String prompt,
        String imageObjectKey,
        String imageFallbackUrl,
        String imageUrl,
        String altText,
        JsonNode interaction
) {
}
