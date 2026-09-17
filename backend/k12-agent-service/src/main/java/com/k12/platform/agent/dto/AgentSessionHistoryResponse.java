package com.k12.platform.agent.dto;

import java.util.List;

/** 当前用户在指定智能体会话中的历史轮次，按时间正序返回。 */
public record AgentSessionHistoryResponse(
        String sessionId,
        String agentCode,
        List<AgentSessionTurnResponse> turns
) {
}
