package com.k12.platform.assessment.contract;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Python 返回的 AI 评分建议。它只能进入 PENDING_REVIEW，不能直接覆盖最终教师成绩。
 */
public record AiGradingResultMessage(
        String schemaVersion,
        String taskId,
        Long submissionId,
        String status,
        List<AnswerSuggestion> suggestions,
        String errorCode,
        String errorMessage,
        Instant completedAt
) {
    public record AnswerSuggestion(
            Long questionId,
            BigDecimal suggestedScore,
            String feedback,
            String reasoning,
            BigDecimal confidence
    ) {
    }
}
