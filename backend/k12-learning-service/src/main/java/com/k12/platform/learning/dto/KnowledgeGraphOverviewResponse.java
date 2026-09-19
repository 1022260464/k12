package com.k12.platform.learning.dto;

import java.util.List;

/** 管理端图谱总览：节点、关系、章节覆盖与教学闭环状态。 */
public record KnowledgeGraphOverviewResponse(
        KnowledgeGraphStatusResponse status,
        List<KnowledgePointResponse> points,
        List<KnowledgeEdgeResponse> edges,
        List<KnowledgeChapterCoverSummary> chapterCovers,
        int explainsCount,
        TeachingLoopStatus teachingLoop
) {
    public record TeachingLoopStatus(
            boolean graphReady,
            boolean hasKnowledgePoints,
            boolean hasPrerequisiteEdges,
            boolean hasChapterCovers,
            boolean hasExplains,
            String summary
    ) {
    }
}
