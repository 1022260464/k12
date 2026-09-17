package com.k12.platform.learning.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** 学习排行榜缓存配置；Redis关闭或故障时仍从MySQL读取。 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.learning.leaderboard")
public class LeaderboardProperties {
    private boolean redisEnabled;
    private String key = "k12:learning:leaderboard:v1";
    private Duration ttl = Duration.ofSeconds(60);
    private int rebuildLimit = 1000;
}
