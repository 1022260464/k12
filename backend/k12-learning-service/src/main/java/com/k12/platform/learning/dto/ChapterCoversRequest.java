package com.k12.platform.learning.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ChapterCoversRequest(
        @NotNull @Size(max = 80) List<@Size(max = 128) String> knowledgeCodes
) {
}
