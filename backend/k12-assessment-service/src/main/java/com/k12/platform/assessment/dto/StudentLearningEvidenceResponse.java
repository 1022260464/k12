package com.k12.platform.assessment.dto;

import java.time.Instant;
import java.util.List;

/** 教师查看的形成性学习证据；不替代正式作业成绩。 */
public record StudentLearningEvidenceResponse(
        Long studentUserId,
        List<KnowledgeMasteryResponse> mastery,
        List<AttemptEvidence> recentAttempts,
        String evidenceNotice
) {
    public record AttemptEvidence(
            Long id,
            String runId,
            String topic,
            String knowledgeCode,
            Integer score,
            Integer maxScore,
            Integer correctCount,
            Integer totalQuestions,
            String weakPoint,
            Integer hintCount,
            Long durationMs,
            List<String> errorTypes,
            Instant createdTime
    ) { }
}
