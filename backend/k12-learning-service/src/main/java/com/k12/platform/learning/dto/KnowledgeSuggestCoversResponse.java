package com.k12.platform.learning.dto;

import java.util.List;

public record KnowledgeSuggestCoversResponse(
        List<KnowledgeCoverSuggestion> suggestions,
        String source
) {
}
