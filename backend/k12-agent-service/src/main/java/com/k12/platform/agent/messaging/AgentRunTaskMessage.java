package com.k12.platform.agent.messaging;

import java.util.Map;

/** 与 Python AgentRunTaskMessage 保持一致的异步任务消息。 */
public record AgentRunTaskMessage(
        String runId,
        String agentCode,
        String inputText,
        String userId,
        Map<String, Object> context
) {
}
