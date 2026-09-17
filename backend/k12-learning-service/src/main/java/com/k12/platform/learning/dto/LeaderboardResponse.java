package com.k12.platform.learning.dto;

import java.time.Instant;
import java.util.List;

public record LeaderboardResponse(
        String metric,
        Instant generatedTime,
        List<LeaderboardEntryResponse> entries
) {
}
