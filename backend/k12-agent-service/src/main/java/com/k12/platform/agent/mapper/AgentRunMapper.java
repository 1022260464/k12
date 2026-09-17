package com.k12.platform.agent.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.agent.model.AgentRun;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.time.Instant;

@Mapper
public interface AgentRunMapper extends BaseMapper<AgentRun> {

    List<AgentRun> findVisiblePage(
            @Param("userId") Long userId,
            @Param("admin") boolean admin,
            @Param("offset") long offset,
            @Param("limit") int limit
    );

    AgentRun findVisibleByRunId(
            @Param("runId") String runId,
            @Param("userId") Long userId,
            @Param("admin") boolean admin
    );

    /** 当前用户同一智能体会话的最近成功轮次；Service 会反转为时间正序。 */
    List<AgentRun> findRecentSuccessfulSessionRuns(
            @Param("userId") Long userId,
            @Param("agentCode") String agentCode,
            @Param("sessionId") String sessionId,
            @Param("limit") int limit
    );

    AgentRun selectForUpdateByRunId(@Param("runId") String runId);

    List<String> findExpiredRunIds(
            @Param("pendingBefore") Instant pendingBefore,
            @Param("runningBefore") Instant runningBefore,
            @Param("limit") int limit
    );
}
