package com.k12.platform.learning.dto;

import java.util.List;

public record CoursePageResponse(int page, int size, boolean hasNext, List<CourseResponse> items) {
}
