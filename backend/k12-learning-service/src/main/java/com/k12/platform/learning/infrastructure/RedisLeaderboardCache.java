package com.k12.platform.learning.infrastructure;

import com.k12.platform.learning.config.LeaderboardProperties;
import com.k12.platform.learning.model.LearningScoreSummary;
import com.k12.platform.learning.service.LeaderboardCache;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Redis Sorted Set排行榜适配器；成员是userId，分数是可重建的学习积分。 */
@Component
@ConditionalOnProperty(prefix = "k12.learning.leaderboard", name = "redis-enabled", havingValue = "true")
public class RedisLeaderboardCache implements LeaderboardCache {
    private final StringRedisTemplate redis;
    private final LeaderboardProperties properties;

    public RedisLeaderboardCache(StringRedisTemplate redis, LeaderboardProperties properties) {
        this.redis = redis;
        this.properties = properties;
    }

    @Override
    public Optional<List<LearningScoreSummary>> read(int limit) {
        Set<ZSetOperations.TypedTuple<String>> values = redis.opsForZSet()
                .reverseRangeWithScores(properties.getKey(), 0, limit - 1L);
        if (values == null || values.isEmpty()) {
            return Optional.empty();
        }
        List<LearningScoreSummary> result = new ArrayList<>(values.size());
        for (ZSetOperations.TypedTuple<String> value : values) {
            if (value.getValue() == null || value.getScore() == null) {
                continue;
            }
            LearningScoreSummary score = new LearningScoreSummary();
            score.setUserId(Long.valueOf(value.getValue()));
            score.setLearningPoints(value.getScore().longValue());
            result.add(score);
        }
        return result.isEmpty() ? Optional.empty() : Optional.of(result);
    }

    @Override
    public void replace(List<LearningScoreSummary> scores) {
        Set<ZSetOperations.TypedTuple<String>> values = new HashSet<>();
        for (LearningScoreSummary score : scores) {
            values.add(ZSetOperations.TypedTuple.of(
                    score.getUserId().toString(),
                    score.getLearningPoints().doubleValue()
            ));
        }
        if (values.isEmpty()) {
            redis.delete(properties.getKey());
            return;
        }

        // 先完整写入临时键，再用Redis RENAME原子替换，避免刷新期间读到半张榜单。
        String temporaryKey = properties.getKey() + ":rebuild:" + UUID.randomUUID();
        try {
            redis.opsForZSet().add(temporaryKey, values);
            redis.expire(temporaryKey, properties.getTtl());
            redis.rename(temporaryKey, properties.getKey());
        } finally {
            redis.delete(temporaryKey);
        }
    }
}
