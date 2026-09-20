package com.k12.platform.learning.infrastructure;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.config.LearningCacheProperties;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.service.PublishedCourseListCache;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@ConditionalOnProperty(prefix = "k12.learning.cache", name = "redis-enabled", havingValue = "true")
public class RedisPublishedCourseListCache implements PublishedCourseListCache {
    private static final TypeReference<List<CourseResponse>> TYPE = new TypeReference<>() {};

    private final LearningRedisJsonStore store;
    private final LearningCacheProperties properties;

    public RedisPublishedCourseListCache(StringRedisTemplate redis,
                                         ObjectMapper objectMapper,
                                         LearningCacheProperties properties) {
        this.store = new LearningRedisJsonStore(redis, objectMapper);
        this.properties = properties;
    }

    @Override
    public Optional<List<CourseResponse>> read() {
        return store.get(properties.getPublishedCoursesKey(), TYPE);
    }

    @Override
    public void replace(List<CourseResponse> courses) {
        store.put(properties.getPublishedCoursesKey(), courses == null ? List.of() : courses, properties.getPublishedCoursesTtl());
    }

    @Override
    public void invalidate() {
        store.delete(properties.getPublishedCoursesKey());
    }
}
