package com.k12.platform.assessment.service;

import com.k12.platform.assessment.mapper.AiPracticeAttemptMapper;
import com.k12.platform.assessment.model.AiPracticeAttempt;
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
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticeInsightServiceTest {
    @Mock private AiPracticeAttemptMapper mapper;
    private PracticeInsightService service;

    @BeforeEach
    void setup() {
        service = new PracticeInsightService(mapper);
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
    void returnsEmptyInsightsWithoutPractice() {
        when(mapper.findRecentByStudent(42L, 50)).thenReturn(List.of());

        assertThat(service.myInsights()).isEmpty();
        verify(mapper).findRecentByStudent(42L, 50);
    }

    @Test
    void aggregatesWeightedScoresAndUsesLatestWeakPoint() {
        when(mapper.findRecentByStudent(42L, 50)).thenReturn(List.of(
                attempt("冒泡排序课堂小测", 2, 10, "相邻比较", 3),
                attempt("冒泡排序", 15, 20, null, 2),
                attempt("算法入门", 9, 10, null, 1)));

        var insights = service.myInsights();

        assertThat(insights).hasSize(2);
        assertThat(insights.get(0).topic()).isEqualTo("冒泡排序");
        assertThat(insights.get(0).sampleCount()).isEqualTo(2);
        assertThat(insights.get(0).averageScorePercent()).isEqualTo(56);
        assertThat(insights.get(0).latestScorePercent()).isEqualTo(20);
        assertThat(insights.get(0).action()).isEqualTo("REVIEW");
        assertThat(insights.get(0).suggestion()).contains("相邻比较");
        assertThat(insights.get(1).action()).isEqualTo("APPLY");
    }

    @Test
    void capsSamplesPerTopicAndSkipsInvalidRows() {
        List<AiPracticeAttempt> attempts = new ArrayList<>();
        attempts.add(attempt("冒泡排序", 7, 10, null, 10));
        attempts.add(attempt("冒泡排序", 7, 10, null, 9));
        attempts.add(attempt("冒泡排序", 7, 10, null, 8));
        attempts.add(attempt("冒泡排序", 7, 10, null, 7));
        attempts.add(attempt("冒泡排序", 7, 10, null, 6));
        attempts.add(attempt("冒泡排序", 0, 10, null, 5));
        attempts.add(attempt("无效题目", 1, 0, null, 4));
        when(mapper.findRecentByStudent(42L, 50)).thenReturn(attempts);

        var insights = service.myInsights();

        assertThat(insights).hasSize(1);
        assertThat(insights.get(0).sampleCount()).isEqualTo(5);
        assertThat(insights.get(0).averageScorePercent()).isEqualTo(70);
        assertThat(insights.get(0).action()).isEqualTo("PRACTICE");
    }

    @Test
    void groupsNewPracticeByKnowledgeCodeInsteadOfDisplayTitle() {
        AiPracticeAttempt first = attempt("冒泡排序课堂小测", 8, 10, null, 2);
        first.setKnowledgeCode("sorting.bubble_sort");
        AiPracticeAttempt second = attempt("排序算法练习", 6, 10, null, 1);
        second.setKnowledgeCode("sorting.bubble_sort");
        when(mapper.findRecentByStudent(42L, 50)).thenReturn(List.of(first, second));

        var insights = service.myInsights();

        assertThat(insights).singleElement().satisfies(item -> {
            assertThat(item.topic()).isEqualTo("冒泡排序");
            assertThat(item.sampleCount()).isEqualTo(2);
            assertThat(item.averageScorePercent()).isEqualTo(70);
        });
    }

    @Test
    void highScoreWithHeavyScaffoldingKeepsNextPracticeShortAndGuided() {
        AiPracticeAttempt guided = attempt("图像分类课堂小测", 9, 10, null, 1);
        guided.setHintCount(3);
        guided.setDurationMs(240_000L);
        guided.setErrorTypesJson("[\"UNCERTAINTY_HANDLING\"]");
        when(mapper.findRecentByStudent(42L, 50)).thenReturn(List.of(guided));

        var insight = service.myInsights().get(0);

        assertThat(insight.latestScorePercent()).isEqualTo(90);
        assertThat(insight.latestHintCount()).isEqualTo(3);
        assertThat(insight.latestDurationMs()).isEqualTo(240_000L);
        assertThat(insight.recentErrorType()).isEqualTo("UNCERTAINTY_HANDLING");
        assertThat(insight.action()).isEqualTo("PRACTICE");
        assertThat(insight.suggestion()).contains("更短的分步练习", "先说明不确定");
    }

    private AiPracticeAttempt attempt(String topic, int score, int maxScore, String weakPoint, int seconds) {
        AiPracticeAttempt attempt = new AiPracticeAttempt();
        attempt.setTopic(topic);
        attempt.setScore(score);
        attempt.setMaxScore(maxScore);
        attempt.setWeakPoint(weakPoint);
        attempt.setCreatedTime(Instant.parse("2026-09-16T00:00:00Z").plusSeconds(seconds));
        return attempt;
    }
}
