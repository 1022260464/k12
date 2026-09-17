package com.k12.platform.assessment.service;

import com.k12.platform.assessment.mapper.AiPracticeAttemptMapper;
import org.junit.jupiter.api.AfterEach;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringJUnitConfig(PracticeInsightMethodSecurityTest.Config.class)
class PracticeInsightMethodSecurityTest {
    @Configuration
    @EnableMethodSecurity
    @Import(PracticeInsightService.class)
    static class Config {
    }

    @MockBean AiPracticeAttemptMapper mapper;
    @Autowired PracticeInsightService service;

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void homeworkReadAloneCannotReadPracticeInsights() {
        authenticate("homework:read");

        assertThatThrownBy(() -> service.myInsights()).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(mapper);
    }

    @Test
    void agentReadCanOnlyQueryCurrentJwtUser() {
        authenticate("agent:read");
        when(mapper.findRecentByStudent(42L, 50)).thenReturn(List.of());

        assertThat(service.myInsights()).isEmpty();
        verify(mapper).findRecentByStudent(42L, 50);
    }

    private void authenticate(String authority) {
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none")
                .subject("student").claim("userId", "42").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority(authority))));
    }
}
