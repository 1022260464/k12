package com.k12.platform.agent.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.agent.model.AgentArtifact;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AgentArtifactMapper extends BaseMapper<AgentArtifact> {

    /** 批量读取会话轮次产物，避免恢复历史时逐轮查询。 */
    List<AgentArtifact> findByRunIds(@Param("runIds") List<String> runIds);
}
