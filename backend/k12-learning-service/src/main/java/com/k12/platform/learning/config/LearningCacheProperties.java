package com.k12.platform.learning.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Learning 热点读缓存配置。
 * Redis 关闭或故障时各调用方自动降级到源数据（MinIO 签名 / MySQL / Neo4j）。
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.learning.cache")
public class LearningCacheProperties {
    /** 与排行榜共用 K12_REDIS_ENABLED；关闭时不注册 Redis 缓存 Bean。 */
    private boolean redisEnabled;

    private String mediaUrlKeyPrefix = "k12:learning:media-url:v1:";
    /** 必须短于 MinIO 签名 URL 有效期，避免缓存中返回已过期链接。 */
    private Duration mediaUrlTtl = Duration.ofMinutes(10);

    private String publishedCoursesKey = "k12:learning:courses:published:v1";
    private Duration publishedCoursesTtl = Duration.ofMinutes(5);

    private String knowledgeGraphOverviewKey = "k12:learning:kg:overview:v2";
    private Duration knowledgeGraphOverviewTtl = Duration.ofMinutes(10);
}
