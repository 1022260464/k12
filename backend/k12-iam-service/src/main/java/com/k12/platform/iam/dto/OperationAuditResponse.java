package com.k12.platform.iam.dto;

import java.time.Instant;

public record OperationAuditResponse(Long id, Long operatorUserId, String action,
                                     String targetType, String targetId, String detail,
                                     Instant createdTime) {
}
