package com.k12.platform.iam.model;

import java.time.Instant;

public record UserAccount(
        Long id,
        String username,
        String nickname,
        String email,
        String roleCode,
        String status,
        Instant updatedTime
) {
}
