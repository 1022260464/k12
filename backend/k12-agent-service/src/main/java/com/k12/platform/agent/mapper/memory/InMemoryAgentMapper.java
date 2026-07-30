package com.k12.platform.agent.mapper.memory;

import com.k12.platform.agent.mapper.AgentMapper;
import com.k12.platform.agent.model.TeachingAgent;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class InMemoryAgentMapper implements AgentMapper {

    private final AtomicLong idGenerator = new AtomicLong(2);
    private final Map<Long, TeachingAgent> agents = new ConcurrentHashMap<>();

    public InMemoryAgentMapper() {
        agents.put(1L, new TeachingAgent(
                1L,
                "Story Agent",
                "CONTENT_GENERATION",
                "Generate story-based explanations for younger students",
                "ENABLED",
                Instant.now()
        ));
    }

    @Override
    public List<TeachingAgent> findAll() {
        return new ArrayList<>(agents.values());
    }

    @Override
    public Optional<TeachingAgent> findById(Long id) {
        return Optional.ofNullable(agents.get(id));
    }

    @Override
    public TeachingAgent insert(TeachingAgent agent) {
        Long id = idGenerator.getAndIncrement();
        TeachingAgent saved = new TeachingAgent(
                id,
                agent.name(),
                agent.type(),
                agent.description(),
                agent.status(),
                agent.updatedTime()
        );
        agents.put(id, saved);
        return saved;
    }

    @Override
    public TeachingAgent update(TeachingAgent agent) {
        agents.put(agent.id(), agent);
        return agent;
    }

    @Override
    public boolean deleteById(Long id) {
        return agents.remove(id) != null;
    }

    @Override
    public boolean existsById(Long id) {
        return agents.containsKey(id);
    }
}
