package com.k12.platform.agent.client.dto;

import java.time.Instant;

public record AccountBehaviorResponse(
        int offTopicStrikeCount,
        int offTopicLimit,
        int abnormalBehaviorCount,
        int abnormalBehaviorLimit,
        Instant lockedUntil,
        boolean temporarilyLocked,
        boolean permanentlyBanned,
        String message
) {
}
