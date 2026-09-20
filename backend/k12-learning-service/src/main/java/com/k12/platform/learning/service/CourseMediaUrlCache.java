package com.k12.platform.learning.service;

import java.util.Optional;

/** 课程素材签名 URL 缓存；未启用 Redis 时不注入。 */
public interface CourseMediaUrlCache {
    Optional<String> get(String objectKey);

    void put(String objectKey, String url);

    void evict(String objectKey);
}
