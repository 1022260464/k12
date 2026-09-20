package com.k12.platform.learning.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.Optional;

/** Redis JSON 读写辅助：失败只记日志，由调用方降级。 */
final class LearningRedisJsonStore {
    private static final Logger log = LoggerFactory.getLogger(LearningRedisJsonStore.class);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    LearningRedisJsonStore(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    <T> Optional<T> get(String key, TypeReference<T> type) {
        try {
            String json = redis.opsForValue().get(key);
            if (json == null || json.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, type));
        } catch (DataAccessException | JsonProcessingException | IllegalArgumentException error) {
            log.warn("Redis 缓存读取失败 key={}", key, error);
            return Optional.empty();
        }
    }

    <T> Optional<T> get(String key, Class<T> type) {
        try {
            String json = redis.opsForValue().get(key);
            if (json == null || json.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, type));
        } catch (DataAccessException | JsonProcessingException | IllegalArgumentException error) {
            log.warn("Redis 缓存读取失败 key={}", key, error);
            return Optional.empty();
        }
    }

    void put(String key, Object value, Duration ttl) {
        try {
            redis.opsForValue().set(key, objectMapper.writeValueAsString(value), ttl);
        } catch (DataAccessException | JsonProcessingException | IllegalArgumentException error) {
            log.warn("Redis 缓存写入失败 key={}", key, error);
        }
    }

    void delete(String key) {
        try {
            redis.delete(key);
        } catch (DataAccessException error) {
            log.warn("Redis 缓存删除失败 key={}", key, error);
        }
    }
}
