package com.k12.platform.gateway.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
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

@SpringJUnitConfig(CourseGatewaySecurityTest.Config.class)
class CourseGatewaySecurityTest {
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
        @RequestMapping("/api/v1/learning/courses/**")
        String probe() { return "ok"; }
    }

    @Autowired ApplicationContext context;
    private WebTestClient client;

    @BeforeEach
    void setUp() { client = WebTestClient.bindToApplicationContext(context).build(); }

    @Test
    void courseUpdateCanPublishButReadCannot() {
        expect("updater", 200);
        expect("reader", 403);
    }

    private void expect(String token, int status) {
        client.post().uri("/api/v1/learning/courses/7/publish")
                .header("Authorization", "Bearer " + token)
                .exchange().expectStatus().isEqualTo(status);
    }

    private static Jwt jwt(String token) {
        List<String> authorities = "updater".equals(token) ? List.of("course:update") : List.of("course:read");
        return Jwt.withTokenValue(token).header("alg", "none").subject("test-user")
                .claim("userId", "1").claim("authVersion", 1L).claim("authorities", authorities).build();
    }
}
