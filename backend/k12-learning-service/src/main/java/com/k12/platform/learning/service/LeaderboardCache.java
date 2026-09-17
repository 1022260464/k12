package com.k12.platform.learning.service;

import com.k12.platform.learning.model.LearningScoreSummary;

import java.util.List;
import java.util.Optional;

/** 排行榜缓存端口，Service不直接依赖Redis API。 */
public interface LeaderboardCache {
    Optional<List<LearningScoreSummary>> read(int limit);

    void replace(List<LearningScoreSummary> scores);
}
