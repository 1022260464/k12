package com.k12.platform.agent.dto;

import java.util.List;

public record AgentRunPageResponse(
        int page,
        int size,
        boolean hasNext,
        List<AgentRunSummaryResponse> items
) {
}
