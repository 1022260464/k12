package com.k12.platform.assessment.service;

import com.k12.platform.assessment.mapper.AiKnowledgeMasteryMapper;
import com.k12.platform.assessment.model.AiKnowledgeMastery;
import com.k12.platform.common.security.K12Authorities;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeMasteryServiceTest {
    @Mock private AiKnowledgeMasteryMapper mapper;
    private KnowledgeMasteryService service;

    @BeforeEach
    void setup() {
        service = new KnowledgeMasteryService(mapper);
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none")
                .subject("student").claim("userId", "42").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt, List.of(new SimpleGrantedAuthority(K12Authorities.AGENT_READ))));
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void readsOnlyCurrentUserAndClassifiesWeightedScore() {
        AiKnowledgeMastery row = new AiKnowledgeMastery();
        row.setKnowledgeCode("sorting.bubble_sort");
        row.setTopic("冒泡排序课堂小测");
        row.setAttemptCount(3);
        row.setTotalScore(30L);
        row.setTotalMaxScore(60L);
        row.setLatestScorePercent(75);
        row.setLastPracticedTime(Instant.parse("2026-09-17T00:00:00Z"));
        when(mapper.findByStudent(42L, 20)).thenReturn(List.of(row));

        var result = service.myMastery();

        assertThat(result).singleElement().satisfies(item -> {
            assertThat(item.knowledgeCode()).isEqualTo("sorting.bubble_sort");
            assertThat(item.masteryPercent()).isEqualTo(50);
            assertThat(item.latestScorePercent()).isEqualTo(75);
            assertThat(item.action()).isEqualTo("REVIEW");
        });
        verify(mapper).findByStudent(42L, 20);
    }
}
