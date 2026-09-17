package com.k12.platform.agent.client.dto;

import java.time.Instant;
import java.util.List;

/** IAM 学习画像的只读下游契约。 */
public record LearnerProfileResponse(
        Long userId,
        String schoolStage,
        Integer grade,
        String textbook,
        List<String> interests,
        Instant updatedTime
) {
}
