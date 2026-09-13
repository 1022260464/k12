package com.k12.platform.assessment.dto;

import java.math.BigDecimal;
import java.util.List;

public record SubmissionAnswerResponse(
        Long questionId,
        String questionType,
        String stem,
        BigDecimal maxScore,
        List<String> selectedAnswers,
        String answerText,
        BigDecimal autoScore,
        BigDecimal manualScore,
        BigDecimal finalScore,
        String gradingStatus,
        String feedback
) {
}
