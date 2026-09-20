package com.k12.platform.learning.infrastructure;

import com.k12.platform.learning.config.LearningCacheProperties;
import com.k12.platform.learning.service.CourseMediaUrlCache;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Component
@ConditionalOnProperty(prefix = "k12.learning.cache", name = "redis-enabled", havingValue = "true")
public class RedisCourseMediaUrlCache implements CourseMediaUrlCache {
    private final StringRedisTemplate redis;
    private final LearningCacheProperties properties;

    public RedisCourseMediaUrlCache(StringRedisTemplate redis, LearningCacheProperties properties) {
        this.redis = redis;
        this.properties = properties;
    }

    @Override
    public Optional<String> get(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            return Optional.empty();
        }
        try {
            String url = redis.opsForValue().get(key(objectKey));
            return StringUtils.hasText(url) ? Optional.of(url) : Optional.empty();
        } catch (DataAccessException error) {
            return Optional.empty();
        }
    }

    @Override
    public void put(String objectKey, String url) {
        if (!StringUtils.hasText(objectKey) || !StringUtils.hasText(url)) {
            return;
        }
        try {
            redis.opsForValue().set(key(objectKey), url, properties.getMediaUrlTtl());
        } catch (DataAccessException ignored) {
            // 降级由调用方继续使用刚生成的签名 URL
        }
    }

    @Override
    public void evict(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            return;
        }
        try {
            redis.delete(key(objectKey));
        } catch (DataAccessException ignored) {
            // ignore
        }
    }

    private String key(String objectKey) {
        return properties.getMediaUrlKeyPrefix() + objectKey;
    }
}
