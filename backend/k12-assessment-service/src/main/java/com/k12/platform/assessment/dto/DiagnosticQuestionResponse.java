package com.k12.platform.assessment.dto;

import java.util.List;

/** 诊断答卷：只下发题干与选项，绝不下发正确答案。 */
public record DiagnosticQuestionResponse(
        String id,
        String knowledgeCode,
        String categoryCode,
        String categoryTitle,
        String prompt,
        List<Option> options
) {
    public record Option(String id, String text) {
    }
}
