package com.k12.platform.agent.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;

@Mapper
public interface CodeExecutionQuotaMapper {

    void ensureDay(@Param("userId") Long userId, @Param("quotaDate") LocalDate quotaDate);

    int reserve(
            @Param("userId") Long userId,
            @Param("quotaDate") LocalDate quotaDate,
            @Param("dailyLimit") int dailyLimit
    );
}
