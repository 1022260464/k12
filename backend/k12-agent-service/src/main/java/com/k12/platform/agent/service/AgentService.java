package com.k12.platform.agent.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.agent.dto.AgentRequest;
import com.k12.platform.agent.dto.AgentResponse;
import com.k12.platform.agent.mapper.AgentMapper;
import com.k12.platform.agent.model.TeachingAgent;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import com.k12.platform.common.security.K12Authorities;

import java.util.List;
import java.util.Optional;

@Service
public class AgentService {

    private final AgentMapper agentMapper;

    public AgentService(AgentMapper agentMapper) {
        this.agentMapper = agentMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public List<AgentResponse> listAgents() {
        return agentMapper.selectList(Wrappers.lambdaQuery(TeachingAgent.class)
                        .orderByDesc(TeachingAgent::getUpdatedTime))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public Optional<AgentResponse> getAgent(Long id) {
        return Optional.ofNullable(agentMapper.selectById(id)).map(this::toResponse);
    }

    /* 智能体配置会影响全平台行为，默认仅管理员可以维护。 */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_CREATE + "')")
    public AgentResponse createAgent(AgentRequest request) {
        TeachingAgent agent = new TeachingAgent();
        agent.setCode(request.code());
        agent.setName(request.name());
        agent.setType(request.type());
        agent.setDescription(request.description());
        agent.setStatus("ENABLED");
        agent.setDeleted(0);

        agentMapper.insert(agent);
        return toResponse(agentMapper.selectById(agent.getId()));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_UPDATE + "')")
    public Optional<AgentResponse> updateAgent(Long id, AgentRequest request) {
        TeachingAgent agent = agentMapper.selectById(id);
        if (agent == null) {
            return Optional.empty();
        }

        agent.setCode(request.code());
        agent.setName(request.name());
        agent.setType(request.type());
        agent.setDescription(request.description());
        agentMapper.updateById(agent);

        return Optional.of(toResponse(agentMapper.selectById(id)));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_DELETE + "')")
    public boolean deleteAgent(Long id) {
        return agentMapper.deleteById(id) > 0;
    }

    private AgentResponse toResponse(TeachingAgent agent) {
        return new AgentResponse(
                agent.getId(),
                agent.getCode(),
                agent.getName(),
                agent.getType(),
                agent.getDescription(),
                agent.getStatus(),
                agent.getUpdatedTime()
        );
    }
}
