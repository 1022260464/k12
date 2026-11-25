package com.k12.platform.assessment.dto;

import java.time.Instant;
import java.util.List;

/** 诊断结果 = 初始画像：总体得分、各类别掌握、优势/薄弱与推荐起点。 */
public record DiagnosticResultResponse(
        Long id,
        String stage,
        int scorePercent,
        int correctCount,
        int totalQuestions,
        List<CategoryScore> categories,
        List<String> strengths,
        List<WeakCategory> weaknesses,
        Recommendation recommendedStart,
        List<String> interests,
        Instant createdTime
) {
    public record CategoryScore(String categoryCode, String categoryTitle, int correct, int total, int percent) {
    }

    public record WeakCategory(String categoryTitle, int percent) {
    }

    public record Recommendation(String knowledgeCode, String topic) {
    }
}
