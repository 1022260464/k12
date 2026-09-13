package com.k12.platform.agent.dto;

import java.time.Instant;

/** 运行列表只返回摘要，详细输入、输出和产物通过详情接口按需读取。 */
public record AgentRunSummaryResponse(
        String runId,
        String agentCode,
        Long userId,
        String sessionId,
        String executionMode,
        String status,
        String errorCode,
        Long durationMs,
        Instant startedTime,
        Instant finishedTime,
        Instant createdTime
) {
}
