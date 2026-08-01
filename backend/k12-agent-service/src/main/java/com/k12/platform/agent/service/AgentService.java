package com.k12.platform.agent.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.agent.dto.AgentRequest;
import com.k12.platform.agent.dto.AgentResponse;
import com.k12.platform.agent.mapper.AgentMapper;
import com.k12.platform.agent.model.TeachingAgent;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AgentService {

    private final AgentMapper agentMapper;

    public AgentService(AgentMapper agentMapper) {
        this.agentMapper = agentMapper;
    }

    public List<AgentResponse> listAgents() {
        return agentMapper.selectList(Wrappers.lambdaQuery(TeachingAgent.class)
                        .orderByDesc(TeachingAgent::getUpdatedTime))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public Optional<AgentResponse> getAgent(Long id) {
        return Optional.ofNullable(agentMapper.selectById(id)).map(this::toResponse);
    }

    public AgentResponse createAgent(AgentRequest request) {
        TeachingAgent agent = new TeachingAgent();
        agent.setName(request.name());
        agent.setType(request.type());
        agent.setDescription(request.description());
        agent.setStatus("ENABLED");
        agent.setDeleted(0);

        agentMapper.insert(agent);
        return toResponse(agentMapper.selectById(agent.getId()));
    }

    public Optional<AgentResponse> updateAgent(Long id, AgentRequest request) {
        TeachingAgent agent = agentMapper.selectById(id);
        if (agent == null) {
            return Optional.empty();
        }

        agent.setName(request.name());
        agent.setType(request.type());
        agent.setDescription(request.description());
        agentMapper.updateById(agent);

        return Optional.of(toResponse(agentMapper.selectById(id)));
    }

    public boolean deleteAgent(Long id) {
        return agentMapper.deleteById(id) > 0;
    }

    private AgentResponse toResponse(TeachingAgent agent) {
        return new AgentResponse(
                agent.getId(),
                agent.getName(),
                agent.getType(),
                agent.getDescription(),
                agent.getStatus(),
                agent.getUpdatedTime()
        );
    }
}
