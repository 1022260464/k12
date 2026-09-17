package com.k12.platform.iam.dto;

import java.time.Instant;
import java.util.List;

public record LearningProfileResponse(
        Long userId,
        String schoolStage,
        Integer grade,
        String textbook,
        List<String> interests,
        Instant updatedTime
) {
}
