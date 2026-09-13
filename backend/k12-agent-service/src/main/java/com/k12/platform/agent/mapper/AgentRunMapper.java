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

    AgentRun selectForUpdateByRunId(@Param("runId") String runId);

    List<String> findExpiredRunIds(
            @Param("pendingBefore") Instant pendingBefore,
            @Param("runningBefore") Instant runningBefore,
            @Param("limit") int limit
    );
}
