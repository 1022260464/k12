package com.k12.platform.learning.dto;

import java.util.List;
import java.util.Set;

public record VisualProgrammingMissionTemplateResponse(
        String templateCode,
        List<String> toolboxCategories,
        Set<String> allowedBlockTypes,
        List<String> configFields
) {
}
