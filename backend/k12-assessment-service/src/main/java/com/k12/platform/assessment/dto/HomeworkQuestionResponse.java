package com.k12.platform.assessment.dto;

import java.math.BigDecimal;
import java.util.List;

public record HomeworkQuestionResponse(
        Long id,
        Long homeworkId,
        String type,
        String stem,
        BigDecimal score,
        int sortOrder,
        List<QuestionOptionResponse> options,
        List<String> correctAnswers,
        String referenceAnswer,
        String analysis,
        boolean answerVisible
) {
}
