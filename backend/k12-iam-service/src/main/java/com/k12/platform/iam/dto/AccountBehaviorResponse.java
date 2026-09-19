package com.k12.platform.iam.dto;

import java.time.Instant;

/** 账号无关提问 / 异常行为状态（账号级，跨会话）。 */
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
