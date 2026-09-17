package com.k12.platform.agent.messaging;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;

/** 与 Python AgentRunResultMessage 保持一致的异步结果消息。 */
public record AgentRunResultMessage(
        String runId,
        String agentCode,
        String status,
        String outputText,
        Instant startedTime,
        List<AgentRunArtifactMessage> artifacts,
        JsonNode metadata
) {
}
