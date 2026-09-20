package com.k12.platform.learning.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.config.LearningCacheProperties;
import com.k12.platform.learning.dto.KnowledgeGraphOverviewResponse;
import com.k12.platform.learning.service.KnowledgeGraphOverviewCache;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@ConditionalOnProperty(prefix = "k12.learning.cache", name = "redis-enabled", havingValue = "true")
public class RedisKnowledgeGraphOverviewCache implements KnowledgeGraphOverviewCache {
    private final LearningRedisJsonStore store;
    private final LearningCacheProperties properties;

    public RedisKnowledgeGraphOverviewCache(StringRedisTemplate redis,
                                            ObjectMapper objectMapper,
                                            LearningCacheProperties properties) {
        this.store = new LearningRedisJsonStore(redis, objectMapper);
        this.properties = properties;
    }

    @Override
    public Optional<KnowledgeGraphOverviewResponse> read() {
        return store.get(properties.getKnowledgeGraphOverviewKey(), KnowledgeGraphOverviewResponse.class);
    }

    @Override
    public void replace(KnowledgeGraphOverviewResponse overview) {
        if (overview == null) {
            return;
        }
        store.put(properties.getKnowledgeGraphOverviewKey(), overview, properties.getKnowledgeGraphOverviewTtl());
    }

    @Override
    public void invalidate() {
        store.delete(properties.getKnowledgeGraphOverviewKey());
    }
}
