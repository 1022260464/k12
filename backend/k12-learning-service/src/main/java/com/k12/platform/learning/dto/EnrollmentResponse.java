package com.k12.platform.learning.dto;

import java.time.Instant;

public record EnrollmentResponse(Long courseId, Long userId, String status, Instant enrolledTime) {
}

