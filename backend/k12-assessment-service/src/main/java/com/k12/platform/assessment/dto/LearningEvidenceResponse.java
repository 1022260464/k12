package com.k12.platform.assessment.dto;

import java.time.Instant;

/** 学生可见的证据条目；detail_json 原样返回，由前端按证据类型渲染。 */
public record LearningEvidenceResponse(
        Long id,
        String knowledgeCode,
        String evidenceType,
        String title,
        Integer scorePercent,
        Integer confidence,
        String referenceId,
        String detailJson,
        Instant createdTime
) {
}
