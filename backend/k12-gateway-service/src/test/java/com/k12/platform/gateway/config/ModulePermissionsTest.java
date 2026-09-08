package com.k12.platform.gateway.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.reactive.config.EnableWebFlux;
import org.springframework.web.reactive.function.server.*;
import reactor.core.publisher.Mono;
import java.util.List;

@SpringJUnitConfig(ModulePermissionsTest.Config.class)
class ModulePermissionsTest {
    @Autowired ApplicationContext context;
    WebTestClient client;
    @BeforeEach void setup() { client = WebTestClient.bindToApplicationContext(context).build(); }
    @Test void submitMatchesBeforeCreateRule() {
        client.post().uri("/api/v1/assessments/homeworks/1/submit")
                .header("Authorization","Bearer homework_submit").exchange().expectStatus().isOk();
        client.post().uri("/api/v1/assessments/homeworks/1/submit")
                .header("Authorization","Bearer homework_create").exchange().expectStatus().isForbidden();
    }
    @Test void gradeAndSubmissionListRequireGradeAuthority() {
        client.post().uri("/api/v1/assessments/homeworks/1/grade")
                .header("Authorization","Bearer homework_submit").exchange().expectStatus().isForbidden();
        client.get().uri("/api/v1/assessments/homeworks/1/submissions")
                .header("Authorization","Bearer homework_read").exchange().expectStatus().isForbidden();
        client.get().uri("/api/v1/assessments/homeworks/1/submissions")
                .header("Authorization","Bearer homework_grade").exchange().expectStatus().isOk();
    }
    @Test void profileAndPublishUseSpecificPermissions() {
        client.put().uri("/api/v1/iam/users/me/learning-profile")
                .header("Authorization","Bearer learning-profile_update").exchange().expectStatus().isOk();
        client.get().uri("/api/v1/iam/users/me/learning-profile")
                .header("Authorization","Bearer learning-profile_read").exchange().expectStatus().isOk();
        client.post().uri("/api/v1/assessments/homeworks/1/publish")
                .header("Authorization","Bearer homework_update").exchange().expectStatus().isOk();
    }
    @Test void anonymousRequestsRemainUnauthorized() {
        client.get().uri("/api/v1/iam/users/me/learning-profile").exchange().expectStatus().isUnauthorized();
    }
    @Configuration
    @EnableWebFlux
    @Import(SecurityConfig.class)
    static class Config {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean @Primary ReactiveJwtDecoder fixtureDecoder() {
            return token -> Mono.just(Jwt.withTokenValue(token).header("alg","HS256").subject("test")
                    .claim("userId","1").claim("authorities",List.of(token.replace("_", ":"))).build());
        }
        @Bean RouterFunction<ServerResponse> endpoints() {
            return RouterFunctions.route(RequestPredicates.all(), request -> ServerResponse.ok().build());
        }
    }
}
