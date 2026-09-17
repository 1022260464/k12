package com.k12.platform.agent.messaging;

import java.time.Instant;
import java.util.List;

/** Python Worker 返回的异步代码执行开始/终态消息。 */
public record CodeExecutionResultMessage(
        String runId,
        String executionId,
        String status,
        String stdout,
        String stderr,
        List<AgentRunArtifactMessage> artifacts,
        Integer exitCode,
        Long durationMs,
        Instant startedTime
) {
}
