package com.k12.platform.agent.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.agent.model.AgentSessionSummary;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface AgentSessionSummaryMapper extends BaseMapper<AgentSessionSummary> {

    int insertEmptyIfAbsent(
            @Param("userId") Long userId,
            @Param("agentCode") String agentCode,
            @Param("sessionId") String sessionId
    );

    AgentSessionSummary findByScope(
            @Param("userId") Long userId,
            @Param("agentCode") String agentCode,
            @Param("sessionId") String sessionId
    );

    int advanceIfVersion(
            @Param("userId") Long userId,
            @Param("agentCode") String agentCode,
            @Param("sessionId") String sessionId,
            @Param("expectedVersion") Integer expectedVersion,
            @Param("summaryText") String summaryText,
            @Param("coveredRunDbId") Long coveredRunDbId,
            @Param("coveredRunId") String coveredRunId,
            @Param("summarizedTurnCount") Integer summarizedTurnCount
    );

    int markFailedIfVersion(
            @Param("userId") Long userId,
            @Param("agentCode") String agentCode,
            @Param("sessionId") String sessionId,
            @Param("expectedVersion") Integer expectedVersion,
            @Param("errorCode") String errorCode
    );
}
