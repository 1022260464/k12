package com.k12.platform.agent.mapper;

import com.k12.platform.agent.model.TeachingAgent;

import java.util.List;
import java.util.Optional;

public interface AgentMapper {

    List<TeachingAgent> findAll();

    Optional<TeachingAgent> findById(Long id);

    TeachingAgent insert(TeachingAgent agent);

    TeachingAgent update(TeachingAgent agent);

    boolean deleteById(Long id);

    boolean existsById(Long id);
}
