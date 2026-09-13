package com.k12.platform.agent.service;

import com.k12.platform.agent.dto.AgentRequest;
import com.k12.platform.agent.dto.AgentResponse;
import com.k12.platform.agent.mapper.AgentMapper;
import com.k12.platform.agent.model.TeachingAgent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentServiceTest {

    @Mock
    private AgentMapper agentMapper;

    @Test
    @DisplayName("创建智能体时清理文本并设置启用状态")
    void createAgentNormalizesFields() {
        AgentService service = new AgentService(agentMapper);
        when(agentMapper.insert(any(TeachingAgent.class))).thenAnswer(invocation -> {
            TeachingAgent agent = invocation.getArgument(0);
            agent.setId(1L);
            return 1;
        });
        when(agentMapper.selectById(1L)).thenAnswer(invocation -> {
            TeachingAgent agent = new TeachingAgent();
            agent.setId(1L);
            agent.setCode("study-plan");
            agent.setName("学习计划");
            agent.setType("TEACHING");
            agent.setStatus("ENABLED");
            return agent;
        });

        service.createAgent(new AgentRequest("study-plan", "  学习计划  ", " TEACHING ", "   "));

        ArgumentCaptor<TeachingAgent> captor = ArgumentCaptor.forClass(TeachingAgent.class);
        verify(agentMapper).insert(captor.capture());
        assertThat(captor.getValue().getName()).isEqualTo("学习计划");
        assertThat(captor.getValue().getType()).isEqualTo("TEACHING");
        assertThat(captor.getValue().getDescription()).isNull();
        assertThat(captor.getValue().getStatus()).isEqualTo("ENABLED");
    }

    @Test
    @DisplayName("更新不存在的智能体返回空结果")
    void updateMissingAgentReturnsEmpty() {
        AgentService service = new AgentService(agentMapper);
        when(agentMapper.selectById(99L)).thenReturn(null);

        Optional<AgentResponse> response = service.updateAgent(
                99L,
                new AgentRequest("study-plan", "学习计划", "TEACHING", null)
        );

        assertThat(response).isEmpty();
    }
}
