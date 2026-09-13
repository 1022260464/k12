package com.k12.platform.agent.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.security.K12ServletSecurityAutoConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 使用真实公共 Servlet 安全链验证 Agent 运行接口的 URL 权限。 */
@SpringJUnitConfig(AgentServletSecurityTest.Config.class)
@WebAppConfiguration
class AgentServletSecurityTest {

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @Import(K12ServletSecurityAutoConfiguration.class)
    static class Config {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean ProbeController probeController() { return new ProbeController(); }
        @Bean JwtDecoder jwtDecoder() { return AgentServletSecurityTest::jwt; }
    }

    @RestController
    static class ProbeController {
        @RequestMapping("/api/v1/agents/**")
        String probe() { return "reached-controller"; }
    }

    @Autowired WebApplicationContext context;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean(FilterChainProxy.class)).build();
    }

    private static Jwt jwt(String token) {
        List<String> authorities = switch (token) {
            case "invoker" -> List.of("agent:invoke");
            case "creator" -> List.of("agent:create");
            case "admin" -> List.of("ROLE_ADMIN");
            default -> List.of();
        };
        return Jwt.withTokenValue(token).header("alg", "none").subject("test-user")
                .claim("userId", "1").claim("authVersion", 1L).claim("authorities", authorities).build();
    }

    private void expect(String path, String token, int expected) throws Exception {
        mvc.perform(post(path).header("Authorization", "Bearer " + token))
                .andExpect(status().is(expected));
    }

    @Test
    @DisplayName("调用权限可创建、取消和重试运行")
    void invokePermissionMatchesRunCommands() throws Exception {
        expect("/api/v1/agents/demo-chart/runs", "invoker", 200);
        expect("/api/v1/agents/runs/run-1/cancel", "invoker", 200);
        expect("/api/v1/agents/runs/run-1/retry", "invoker", 200);
    }

    @Test
    @DisplayName("创建权限不能越权取消运行")
    void createPermissionCannotCancelRun() throws Exception {
        expect("/api/v1/agents/runs/run-1/cancel", "creator", 403);
    }

    @Test
    @DisplayName("管理员可执行所有运行命令")
    void adminCanInvokeRuns() throws Exception {
        expect("/api/v1/agents/demo-chart/runs", "admin", 200);
        expect("/api/v1/agents/runs/run-1/cancel", "admin", 200);
        expect("/api/v1/agents/runs/run-1/retry", "admin", 200);
    }
}
