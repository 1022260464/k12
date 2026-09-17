package com.k12.platform.learning.mapper;

import com.k12.platform.learning.model.LearningScoreSummary;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface LearningLeaderboardMapper {
    List<LearningScoreSummary> selectTopScores(@Param("limit") int limit);
}
