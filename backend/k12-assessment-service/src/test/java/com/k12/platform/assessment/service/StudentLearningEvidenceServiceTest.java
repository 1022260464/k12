package com.k12.platform.assessment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.mapper.AiPracticeAttemptMapper;
import com.k12.platform.assessment.model.AiPracticeAttempt;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StudentLearningEvidenceServiceTest {
    private AiPracticeAttemptMapper attemptMapper;
    private KnowledgeMasteryService masteryService;
    private StudentLearningEvidenceService service;

    @BeforeEach
    void setUp() {
        attemptMapper = mock(AiPracticeAttemptMapper.class);
        masteryService = mock(KnowledgeMasteryService.class);
        service = new StudentLearningEvidenceService(attemptMapper, masteryService,
                new ObjectMapper().findAndRegisterModules());
    }

    @AfterEach
    void cleanup() { SecurityContextHolder.clearContext(); }

    @Test
    void teacherCannotReadStudentOutsideTeachingScope() {
        authenticate(20L, "homework:grade");
        when(attemptMapper.canViewerAccessStudent(20L, 42L)).thenReturn(0);

        assertThatThrownBy(() -> service.get(42L, 20))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("只能查看");
        verify(attemptMapper, never()).findRecentByStudent(42L, 20);
    }

    @Test
    void teacherReceivesBoundedProcessEvidence() {
        authenticate(20L, "homework:grade");
        when(attemptMapper.canViewerAccessStudent(20L, 42L)).thenReturn(1);
        AiPracticeAttempt row = attempt();
        when(attemptMapper.findRecentByStudent(42L, 50)).thenReturn(List.of(row));
        when(masteryService.forStudent(42L)).thenReturn(List.of());

        var result = service.get(42L, 80);

        assertThat(result.studentUserId()).isEqualTo(42L);
        assertThat(result.recentAttempts()).singleElement().satisfies(item -> {
            assertThat(item.hintCount()).isEqualTo(2);
            assertThat(item.durationMs()).isEqualTo(45000L);
            assertThat(item.errorTypes()).containsExactly("LABEL_MISMATCH");
        });
        verify(attemptMapper).findRecentByStudent(42L, 50);
    }

    @Test
    void adminBypassesTeacherStudentRelation() {
        authenticate(1L, "ROLE_ADMIN");
        when(attemptMapper.findRecentByStudent(42L, 1)).thenReturn(List.of());
        when(masteryService.forStudent(42L)).thenReturn(List.of());

        assertThat(service.get(42L, 0).recentAttempts()).isEmpty();
        verify(attemptMapper, never()).canViewerAccessStudent(1L, 42L);
    }

    private AiPracticeAttempt attempt() {
        AiPracticeAttempt row = new AiPracticeAttempt();
        row.setId(7L);
        row.setRunId("run-7");
        row.setTopic("图像分类");
        row.setKnowledgeCode("machine_learning.image_classification");
        row.setScore(20);
        row.setMaxScore(30);
        row.setCorrectCount(2);
        row.setTotalQuestions(3);
        row.setWeakPoint("不确定性判断");
        row.setHintCount(2);
        row.setDurationMs(45000L);
        row.setErrorTypesJson("[\"LABEL_MISMATCH\"]");
        row.setCreatedTime(Instant.parse("2026-09-23T00:00:00Z"));
        return row;
    }

    private void authenticate(long userId, String authority) {
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none")
                .subject("viewer").claim("userId", Long.toString(userId)).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority(authority))));
    }
}
