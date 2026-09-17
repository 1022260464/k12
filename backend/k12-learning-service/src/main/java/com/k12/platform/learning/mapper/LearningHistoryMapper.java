package com.k12.platform.learning.mapper;

import com.k12.platform.learning.model.CourseLearningSummary;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface LearningHistoryMapper {

    List<CourseLearningSummary> selectRecentByUserId(
            @Param("userId") Long userId,
            @Param("limit") int limit
    );
}
