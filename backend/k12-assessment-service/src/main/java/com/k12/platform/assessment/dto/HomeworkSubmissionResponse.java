package com.k12.platform.assessment.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record HomeworkSubmissionResponse(
        Long id, Long homeworkId, Long studentUserId, Long courseId,
        String answerContent, String status, BigDecimal score, String feedback,
        Long gradedBy, Integer version, Instant submittedTime, Instant gradedTime, Instant updatedTime
) {}
