package com.k12.platform.agent.client.dto;

/** Assessment 返回的本人知识点摘要；不包含学生答案。 */
public record KnowledgeMasterySummaryResponse(
        String knowledgeCode,
        String topic,
        Integer attemptCount,
        Integer masteryPercent,
        Integer latestScorePercent,
        String action
) {
}
