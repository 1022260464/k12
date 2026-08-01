package com.k12.platform.agent.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.k12.platform.agent.model.TeachingAgent;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AgentMapper extends BaseMapper<TeachingAgent> {
}
