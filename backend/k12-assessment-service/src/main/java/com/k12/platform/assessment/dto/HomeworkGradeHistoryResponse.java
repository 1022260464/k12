package com.k12.platform.assessment.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record HomeworkGradeHistoryResponse(
        Long id, Long submissionId, Integer version, BigDecimal score,
        String feedback, Long gradedBy, Instant gradedTime
) {}
