package com.k12.platform.iam.dto;

import java.time.Instant;

public record UserResponse(
        Long id,
        String username,
        String nickname,
        String email,
        String roleCode,
        String status,
        Instant updatedTime
) {
}
