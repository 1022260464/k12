package com.k12.platform.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.config.AgentRabbitProperties;
import com.k12.platform.agent.messaging.CodeExecutionTaskPublisher;
import com.k12.platform.common.api.ApiResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Bean;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** 使用真实Spring代理验证代码执行方法的权限注解。 */
@SpringJUnitConfig(CodeExecutionMethodSecurityTest.Config.class)
class CodeExecutionMethodSecurityTest {

    @Configuration
    @EnableMethodSecurity
    @Import({CodeExecutionService.class, CodeExecutionRecordMapper.class})
    static class Config {
        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        AgentRabbitProperties agentRabbitProperties() {
            return new AgentRabbitProperties();
        }
    }

    @MockBean
    private AgentRuntimeClient runtimeClient;
    @MockBean
    private AgentRunPersistenceService persistenceService;
    @MockBean
    private CodeExecutionTaskPublisher taskPublisher;
    @MockBean
    private CodeExecutionQuotaService quotaService;

    @Autowired
    private CodeExecutionService service;

    @AfterEach
    void clearIdentity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("只有读取权限的用户不能执行代码")
    void readOnlyUserCannotExecuteCode() {
        authenticate("agent:read");

        assertThatThrownBy(() -> service.execute("print(1)", 10, null))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(runtimeClient);
    }

    @Test
    @DisplayName("拥有调用权限的用户可以执行代码")
    void invokerCanExecuteCode() {
        authenticate("agent:invoke");
        RuntimeCodeExecutionResponse response = new RuntimeCodeExecutionResponse(
                "exec-1", "SUCCEEDED", "1\n", "", List.of(), 0, 20L, null
        );
        when(runtimeClient.executeCode(any())).thenReturn(ApiResponse.ok(response));

        assertThat(service.execute("print(1)", 10, null).execution().status()).isEqualTo("SUCCEEDED");
    }

    private void authenticate(String authority) {
        Jwt jwt = Jwt.withTokenValue("test")
                .header("alg", "none")
                .subject("student")
                .claim("userId", "42")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt,
                List.of(new SimpleGrantedAuthority(authority))
        ));
    }
}
