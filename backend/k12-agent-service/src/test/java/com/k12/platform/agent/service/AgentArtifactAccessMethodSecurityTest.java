package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
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

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

/** 使用真实 Spring 代理验证产物临时地址不能绕过功能权限。 */
@SpringJUnitConfig(AgentArtifactAccessMethodSecurityTest.Config.class)
class AgentArtifactAccessMethodSecurityTest {

    @Configuration
    @EnableMethodSecurity
    @Import(AgentArtifactAccessService.class)
    static class Config {
    }

    @MockBean AgentRunMapper runMapper;
    @MockBean AgentArtifactMapper artifactMapper;
    @MockBean AgentRuntimeClient runtimeClient;
    @Autowired AgentArtifactAccessService service;

    @AfterEach
    void clearIdentity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("没有 agent:read 权限时不能申请产物临时地址")
    void invokeOnlyUserCannotCreateDownloadUrl() {
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("student")
                .claim("userId", "42").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt, List.of(new SimpleGrantedAuthority("agent:invoke"))));

        assertThatThrownBy(() -> service.createDownloadUrl("run-1", "artifact-1"))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(runMapper, artifactMapper, runtimeClient);
    }
}
