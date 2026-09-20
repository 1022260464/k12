package com.k12.platform.learning.dto;

import java.time.Instant;

/** 知识目录加载状态：来源、版本、规模，供管理端运维展示。 */
public record KnowledgeCatalogInfoResponse(
        String location,
        String resolvedSource,
        int version,
        Instant loadedAt,
        int categoryCount,
        int topicCount,
        int edgeCount,
        String description
) {
    public record SyncResult(
            KnowledgeCatalogInfoResponse catalog,
            int updatedNodes,
            boolean neo4jReady,
            String message
    ) {
    }

    public record ReloadResult(
            KnowledgeCatalogInfoResponse catalog,
            boolean reloaded,
            String message
    ) {
    }
}
