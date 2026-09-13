package com.k12.platform.iam.dto;

import java.util.List;

public record AuditPageResponse<T>(List<T> items, int page, int size, long total) {
}
