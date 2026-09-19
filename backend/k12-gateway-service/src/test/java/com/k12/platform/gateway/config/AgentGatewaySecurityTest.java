package com.k12.platform.gateway.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.config.EnableWebFlux;
import reactor.core.publisher.Mono;

import java.util.List;

/** 验证 Agent 运行类接口不会被配置管理的通配规则误拦截。 */
@SpringJUnitConfig(AgentGatewaySecurityTest.Config.class)
class AgentGatewaySecurityTest {

    @Configuration
    @EnableWebFlux
    @Import(SecurityConfig.class)
    static class Config {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean ProbeController probeController() { return new ProbeController(); }
        @Bean @Primary ReactiveJwtDecoder testDecoder() { return token -> Mono.just(jwt(token)); }
    }

    @RestController
    static class ProbeController {
        @RequestMapping("/api/v1/agents/**")
        String probe() { return "reached-controller"; }
    }

    @Autowired ApplicationContext context;
    private WebTestClient client;

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToApplicationContext(context).build();
    }

    private static Jwt jwt(String token) {
        List<String> authorities = switch (token) {
            case "invoker" -> List.of("agent:invoke");
            case "creator" -> List.of("agent:create");
            case "reader" -> List.of("agent:read");
            case "admin" -> List.of("ROLE_ADMIN");
            default -> List.of();
        };
        return Jwt.withTokenValue(token).header("alg", "none").subject("test-user")
                .claim("userId", "1").claim("authVersion", 1L).claim("authorities", authorities).build();
    }

    private void expect(String path, String token, int expected) {
        client.post().uri(path)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isEqualTo(expected);
    }

    @Test
    @DisplayName("调用权限可创建、取消和重试运行，但不能创建 Agent 配置")
    void invokePermissionMatchesOnlyRunCommands() {
        expect("/api/v1/agents/demo-chart/runs", "invoker", 200);
        expect("/api/v1/agents/code-executions", "invoker", 200);
        expect("/api/v1/agents/runs/run-1/cancel", "invoker", 200);
        expect("/api/v1/agents/runs/run-1/retry", "invoker", 200);
        expect("/api/v1/agents", "invoker", 403);
    }

    @Test
    @DisplayName("创建或读取权限不能代替调用权限")
    void managementPermissionsCannotInvokeRuns() {
        expect("/api/v1/agents/runs/run-1/cancel", "creator", 403);
        expect("/api/v1/agents/code-executions", "creator", 403);
        expect("/api/v1/agents/runs/run-1/retry", "reader", 403);
    }

    @Test
    @DisplayName("管理员可执行所有运行命令")
    void adminCanInvokeRuns() {
        expect("/api/v1/agents/demo-chart/runs", "admin", 200);
        expect("/api/v1/agents/code-executions", "admin", 200);
        expect("/api/v1/agents/runs/run-1/cancel", "admin", 200);
        expect("/api/v1/agents/runs/run-1/retry", "admin", 200);
    }
}
