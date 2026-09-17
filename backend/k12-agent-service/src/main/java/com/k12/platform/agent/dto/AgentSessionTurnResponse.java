package com.k12.platform.agent.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;

/**
 * 一次成功的用户提问和智能体回答。
 *
 * 不返回 inputContext，避免把服务端聚合的学习档案和成绩摘要再次暴露给前端。
 */
public record AgentSessionTurnResponse(
        String runId,
        String userMessage,
        String assistantMessage,
        JsonNode outputMetadata,
        Instant createdTime,
        List<AgentArtifactResponse> artifacts
) {
}
