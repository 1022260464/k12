package com.k12.platform.agent.client.dto;

import java.util.List;

/** Internal request used to merge older successful turns into a rolling summary. */
public record RuntimeConversationSummaryRequest(
        String previousSummary,
        List<RuntimeConversationTurn> turns,
        int summarizedTurnCount
) {
}
