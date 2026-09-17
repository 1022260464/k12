package com.k12.platform.learning.dto;

public record LeaderboardEntryResponse(
        int rank,
        Long userId,
        long learningPoints,
        boolean currentUser
) {
}
