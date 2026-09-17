package com.k12.platform.assessment.service;

import com.k12.platform.assessment.mapper.AiKnowledgeMasteryMapper;
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

@SpringJUnitConfig(KnowledgeMasteryMethodSecurityTest.Config.class)
class KnowledgeMasteryMethodSecurityTest {
    @Configuration
    @EnableMethodSecurity
    @Import(KnowledgeMasteryService.class)
    static class Config {
    }

    @MockBean AiKnowledgeMasteryMapper mapper;
    @Autowired KnowledgeMasteryService service;

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void homeworkReadCannotReadMastery() {
        authenticate("homework:read");

        assertThatThrownBy(() -> service.myMastery()).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(mapper);
    }

    @Test
    void agentReadCanOnlyQueryJwtUser() {
        authenticate("agent:read");
        when(mapper.findByStudent(42L, 20)).thenReturn(List.of());

        assertThat(service.myMastery()).isEmpty();
        verify(mapper).findByStudent(42L, 20);
    }

    private void authenticate(String authority) {
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none")
                .subject("student").claim("userId", "42").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority(authority))));
    }
}
