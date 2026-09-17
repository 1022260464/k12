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

/** 使用真实 Gateway WebFlux 安全链，防止具体学习动作被课程管理通配规则覆盖。 */
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
        String probe() { return "reached-controller"; }
    }

    @Autowired ApplicationContext context;
    private WebTestClient client;

    @BeforeEach
    void setUp() { client = WebTestClient.bindToApplicationContext(context).build(); }

    private static Jwt jwt(String token) {
        List<String> authorities = switch (token) {
                case "student" -> List.of("ROLE_STUDENT", "course:read");
                case "roleOnly" -> List.of("ROLE_STUDENT");
                case "readOnly" -> List.of("course:read");
                case "teacher" -> List.of("ROLE_TEACHER", "course:read", "course:update");
                case "editor" -> List.of("ROLE_TEACHER", "course:update");
                case "admin" -> List.of("ROLE_ADMIN");
                default -> List.of();
            };
        return Jwt.withTokenValue(token).header("alg", "none").subject("test-user")
                .claim("userId", "1").claim("authVersion", 1L).claim("authorities", authorities).build();
    }

    private void expect(String method, String path, String token, int expected) {
        var request = client.method(org.springframework.http.HttpMethod.valueOf(method))
                .uri("/api/v1/learning/courses" + path);
        if (token != null) request.header("Authorization", "Bearer " + token);
        request.exchange().expectStatus().isEqualTo(expected);
    }

    @Test
    @DisplayName("学生可报名退课和上报进度")
    void studentStudyAllowed() throws Exception {
        expect("PUT", "/1/enrollment", "student", 200);
        expect("DELETE", "/1/enrollment", "student", 200);
        expect("PUT", "/1/chapters/2/progress", "student", 200);
        expect("GET", "/1/progress", "student", 200);
    }

    @Test
    @DisplayName("学生不能获得课程管理权限")
    void studentCannotManageCourse() throws Exception {
        expect("PUT", "/1", "student", 403);
        expect("DELETE", "/1", "student", 403);
        expect("POST", "/1/chapters", "student", 403);
    }

    @Test
    @DisplayName("学习动作要求学生角色和读取权限同时具备")
    void studyRequiresBothAuthorities() throws Exception {
        expect("PUT", "/1/enrollment", "roleOnly", 403);
        expect("PUT", "/1/enrollment", "readOnly", 403);
        expect("PUT", "/1/enrollment", "teacher", 403);
    }

    @Test
    @DisplayName("章节新增和删除使用 course:update 而非课程创建删除权限")
    void chapterManagementUsesUpdate() throws Exception {
        expect("POST", "/1/chapters", "editor", 200);
        expect("DELETE", "/1/chapters/2", "editor", 200);
        expect("POST", "", "editor", 403);
        expect("DELETE", "/1", "editor", 403);
    }

    @Test
    @DisplayName("管理员可访问学习接口")
    void adminStudyAllowed() throws Exception {
        expect("PUT", "/1/enrollment", "admin", 200);
        expect("DELETE", "/1/enrollment", "admin", 200);
    }

    @Test
    @DisplayName("学习动作不能匿名调用")
    void anonymousRejected() throws Exception {
        expect("PUT", "/1/enrollment", null, 401);
    }
}
