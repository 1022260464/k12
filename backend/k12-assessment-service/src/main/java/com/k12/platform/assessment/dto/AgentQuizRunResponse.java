package com.k12.platform.assessment.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

/** Agent 运行的最小只读契约；答案只从服务端持久化产物读取。 */
public record AgentQuizRunResponse(
        String runId,
        String agentCode,
        Long userId,
        String status,
        List<QuizArtifactResponse> artifacts
) {
    public record QuizArtifactResponse(String artifactId, String mimeType, JsonNode payload) {
    }
}
