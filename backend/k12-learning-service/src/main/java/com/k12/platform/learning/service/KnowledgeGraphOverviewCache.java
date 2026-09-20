package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.KnowledgeGraphOverviewResponse;

import java.util.Optional;

/** 知识图谱总览缓存；图谱相对稳定，适合较长 TTL。 */
public interface KnowledgeGraphOverviewCache {
    Optional<KnowledgeGraphOverviewResponse> read();

    void replace(KnowledgeGraphOverviewResponse overview);

    void invalidate();
}
