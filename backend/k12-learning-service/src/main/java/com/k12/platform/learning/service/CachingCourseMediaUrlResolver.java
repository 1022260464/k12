package com.k12.platform.learning.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.util.StringUtils;

/**
 * 在本地 MinIO 签名之上叠加 Redis 缓存。
 * 签名本身不访问对象存储，但列表页仍会对每个封面重复计算；缓存后列表回显显著变快。
 */
public final class CachingCourseMediaUrlResolver implements CourseMediaUrlResolver {
    private final CourseMediaUrlResolver delegate;
    private final CourseMediaUrlCache cache;

    public CachingCourseMediaUrlResolver(CourseMediaUrlResolver delegate, ObjectProvider<CourseMediaUrlCache> cacheProvider) {
        this.delegate = delegate;
        this.cache = cacheProvider.getIfAvailable();
    }

    @Override
    public String resolve(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            return null;
        }
        if (cache != null) {
            try {
                var cached = cache.get(objectKey);
                if (cached.isPresent()) {
                    return cached.get();
                }
            } catch (RuntimeException ignored) {
                // 降级到本地签名
            }
        }
        String url = delegate.resolve(objectKey);
        if (cache != null && StringUtils.hasText(url)) {
            try {
                cache.put(objectKey, url);
            } catch (RuntimeException ignored) {
                // ignore
            }
        }
        return url;
    }
}
