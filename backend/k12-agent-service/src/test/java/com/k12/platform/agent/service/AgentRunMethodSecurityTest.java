package com.k12.platform.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.config.AgentRabbitProperties;
import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.messaging.AgentRunTaskPublisher;
import com.k12.platform.agent.model.AgentRun;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 使用真实 Spring 方法安全代理，避免直接 new Service 时绕过注解造成测试假通过。 */
@SpringJUnitConfig(AgentRunMethodSecurityTest.Config.class)
class AgentRunMethodSecurityTest {
    @Configuration
    @EnableMethodSecurity
    @Import(AgentRunService.class)
    static class Config {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
        @Bean AgentRabbitProperties rabbitProperties() { return new AgentRabbitProperties(); }
    }

    @MockBean AgentMapper agentMapper;
    @MockBean AgentRunMapper runMapper;
    @MockBean AgentArtifactMapper artifactMapper;
    @MockBean AgentRuntimeClient runtimeClient;
    @MockBean AgentRunPersistenceService persistenceService;
    @MockBean AgentRunTaskPublisher taskPublisher;
    @Autowired AgentRunService service;

    @AfterEach
    void clearIdentity() { SecurityContextHolder.clearContext(); }

    @Test
    @DisplayName("只有读取权限的用户不能取消或重试任务")
    void readOnlyUserCannotMutateRuns() {
        authenticate("agent:read");
        assertThatThrownBy(() -> service.cancelRun("run-1")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.retryRun("run-1")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(persistenceService, runMapper, taskPublisher);
    }

    @Test
    @DisplayName("调用权限通过后仍把 JWT 身份交给事务层校验归属")
    void authorizedCancellationUsesJwtIdentity() {
        authenticate("agent:invoke");
        AgentRun run = new AgentRun();
        run.setRunId("run-1");
        run.setStatus("CANCELLED");
        when(persistenceService.cancelAsyncRun("run-1", 42L, false)).thenReturn(run);
        assertThat(service.cancelRun("run-1").status()).isEqualTo("CANCELLED");
        verify(persistenceService).cancelAsyncRun("run-1", 42L, false);
    }

    private void authenticate(String authority) {
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("student")
                .claim("userId", "42").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority(authority))));
    }
}
