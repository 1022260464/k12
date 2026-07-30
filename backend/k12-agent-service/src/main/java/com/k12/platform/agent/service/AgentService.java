package com.k12.platform.agent.service;

import com.k12.platform.agent.dto.AgentRequest;
import com.k12.platform.agent.dto.AgentResponse;
import com.k12.platform.agent.mapper.AgentMapper;
import com.k12.platform.agent.model.TeachingAgent;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class AgentService {

    private final AgentMapper agentMapper;

    public AgentService(AgentMapper agentMapper) {
        this.agentMapper = agentMapper;
    }

    public List<AgentResponse> listAgents() {
        return agentMapper.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public Optional<AgentResponse> getAgent(Long id) {
        return agentMapper.findById(id).map(this::toResponse);
    }

    public AgentResponse createAgent(AgentRequest request) {
        TeachingAgent agent = new TeachingAgent(
                null,
                request.name(),
                request.type(),
                request.description(),
                "ENABLED",
                Instant.now()
        );
        return toResponse(agentMapper.insert(agent));
    }

    public Optional<AgentResponse> updateAgent(Long id, AgentRequest request) {
        if (!agentMapper.existsById(id)) {
            return Optional.empty();
        }

        TeachingAgent agent = new TeachingAgent(
                id,
                request.name(),
                request.type(),
                request.description(),
                "ENABLED",
                Instant.now()
        );
        return Optional.of(toResponse(agentMapper.update(agent)));
    }

    public boolean deleteAgent(Long id) {
        return agentMapper.deleteById(id);
    }

    private AgentResponse toResponse(TeachingAgent agent) {
        return new AgentResponse(
                agent.id(),
                agent.name(),
                agent.type(),
                agent.description(),
                agent.status(),
                agent.updatedTime()
        );
    }
}
