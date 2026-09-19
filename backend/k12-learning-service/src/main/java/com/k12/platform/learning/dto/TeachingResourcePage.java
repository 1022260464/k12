package com.k12.platform.learning.dto;

import java.util.List;

public record TeachingResourcePage(int page, int size, boolean hasMore, List<TeachingResourceResponse> items) {
}
