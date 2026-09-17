package com.k12.platform.learning.service;

import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.config.LeaderboardProperties;
import com.k12.platform.learning.dto.LeaderboardEntryResponse;
import com.k12.platform.learning.dto.LeaderboardResponse;
import com.k12.platform.learning.mapper.LearningLeaderboardMapper;
import com.k12.platform.learning.model.LearningScoreSummary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
@PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
public class LearningLeaderboardService {
    private static final Logger log = LoggerFactory.getLogger(LearningLeaderboardService.class);

    private final LearningLeaderboardMapper mapper;
    private final LeaderboardCache cache;
    private final LeaderboardProperties properties;

    public LearningLeaderboardService(LearningLeaderboardMapper mapper,
                                      ObjectProvider<LeaderboardCache> cacheProvider,
                                      LeaderboardProperties properties) {
        this.mapper = mapper;
        this.cache = cacheProvider.getIfAvailable();
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public LeaderboardResponse leaderboard(int limit) {
        if (limit < 1 || limit > 100) {
            throw new IllegalArgumentException("排行榜数量必须在1到100之间");
        }
        List<LearningScoreSummary> scores = readCache(limit);
        if (scores == null) {
            List<LearningScoreSummary> rebuilt = mapper.selectTopScores(properties.getRebuildLimit());
            writeCache(rebuilt);
            scores = rebuilt.stream().limit(limit).toList();
        } else {
            // Redis对相同分数的成员按字符串排序，这里恢复与MySQL一致的userId升序规则。
            scores = scores.stream()
                    .sorted(Comparator.comparingLong(LearningScoreSummary::getLearningPoints)
                            .reversed()
                            .thenComparing(LearningScoreSummary::getUserId))
                    .toList();
        }

        Long currentUserId = K12SecurityContext.currentUserId().orElse(null);
        List<LearningScoreSummary> rankedScores = scores;
        List<LeaderboardEntryResponse> entries = java.util.stream.IntStream
                .range(0, rankedScores.size())
                .mapToObj(index -> {
                    LearningScoreSummary score = rankedScores.get(index);
                    return new LeaderboardEntryResponse(
                            index + 1,
                            score.getUserId(),
                            score.getLearningPoints(),
                            score.getUserId().equals(currentUserId)
                    );
                })
                .toList();
        return new LeaderboardResponse("chapter_progress_points", Instant.now(), entries);
    }

    private List<LearningScoreSummary> readCache(int limit) {
        if (cache == null) {
            return null;
        }
        try {
            return cache.read(limit).orElse(null);
        } catch (DataAccessException | IllegalArgumentException error) {
            log.warn("Redis排行榜读取失败，降级查询MySQL", error);
            return null;
        }
    }

    private void writeCache(List<LearningScoreSummary> scores) {
        if (cache == null) {
            return;
        }
        try {
            cache.replace(scores);
        } catch (DataAccessException | IllegalArgumentException error) {
            log.warn("Redis排行榜写入失败，本次继续返回MySQL结果", error);
        }
    }
}
