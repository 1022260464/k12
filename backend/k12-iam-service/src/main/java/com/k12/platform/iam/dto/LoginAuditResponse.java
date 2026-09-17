package com.k12.platform.iam.dto;

import java.time.Instant;

public record LoginAuditResponse(Long id, Long userId, String username, boolean success,
                                 String failureReason, String clientIp, String userAgent,
                                 Instant createdTime) {
}
