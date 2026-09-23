package com.k12.platform.assessment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.client.AgentQuizRunClient;
import com.k12.platform.assessment.dto.AgentQuizRunResponse;
import com.k12.platform.assessment.dto.PracticeAttemptRequest;
import com.k12.platform.assessment.mapper.AiPracticeAttemptMapper;
import com.k12.platform.assessment.mapper.AiKnowledgeMasteryMapper;
import com.k12.platform.assessment.model.AiPracticeAttempt;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12Authorities;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiPracticeAttemptServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    @Mock private AgentQuizRunClient agentClient;
    @Mock private AiPracticeAttemptMapper mapper;
    @Mock private AiKnowledgeMasteryMapper masteryMapper;
    private AiPracticeAttemptService service;

    @BeforeEach
    void setup() {
        service = new AiPracticeAttemptService(agentClient, mapper, masteryMapper, objectMapper);
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
    void gradesFromOwnedRunAndPersistsAnswers() throws Exception {
        when(agentClient.getRun("run-1")).thenReturn(ApiResponse.ok(run(42L)));
        when(mapper.insert(any(AiPracticeAttempt.class))).thenAnswer(invocation -> {
            AiPracticeAttempt attempt = invocation.getArgument(0);
            attempt.setId(7L);
            return 1;
        });

        var result = service.submit(new PracticeAttemptRequest("run-1", List.of(
                new PracticeAttemptRequest.Answer("q1", "b"),
                new PracticeAttemptRequest.Answer("q2", "a")), 2, 95_000L));

        assertThat(result.score()).isEqualTo(10);
        assertThat(result.maxScore()).isEqualTo(20);
        assertThat(result.correctCount()).isEqualTo(1);
        assertThat(result.weakPoint()).isEqualTo("第一题");
        assertThat(result.hintCount()).isEqualTo(2);
        assertThat(result.durationMs()).isEqualTo(95_000L);
        assertThat(result.errorTypes()).containsExactly("CONCEPT_CONFUSION");
        org.mockito.ArgumentCaptor<AiPracticeAttempt> captor =
                org.mockito.ArgumentCaptor.forClass(AiPracticeAttempt.class);
        verify(mapper).insert(captor.capture());
        assertThat(captor.getValue().getStudentUserId()).isEqualTo(42L);
        assertThat(captor.getValue().getKnowledgeCode()).isEqualTo("sorting.bubble_sort");
        assertThat(captor.getValue().getAnswersJson()).contains("\"q1\":\"b\"");
        assertThat(captor.getValue().getHintCount()).isEqualTo(2);
        assertThat(captor.getValue().getDurationMs()).isEqualTo(95_000L);
        assertThat(captor.getValue().getErrorTypesJson()).isEqualTo("[\"CONCEPT_CONFUSION\"]");
        verify(masteryMapper).recordAttempt(42L, "sorting.bubble_sort", "排序小测",
                10, 20, 50, captor.getValue().getCreatedTime());
    }

    @Test
    void awardsCatDetectiveBadgeOnlyFromServerGradedImageClassificationAttempt() throws Exception {
        AgentQuizRunResponse original = run(42L);
        var payload = ((com.fasterxml.jackson.databind.node.ObjectNode) original.artifacts().get(0).payload()).deepCopy();
        payload.put("knowledgeCode", "machine_learning.image_classification");
        when(agentClient.getRun("run-1")).thenReturn(ApiResponse.ok(new AgentQuizRunResponse(
                "run-1", "teaching-assistant", 42L, "SUCCEEDED",
                List.of(new AgentQuizRunResponse.QuizArtifactResponse(
                        "artifact-1", "application/vnd.k12.quiz.v1+json", payload)))));
        when(mapper.insert(any(AiPracticeAttempt.class))).thenReturn(1);

        var result = service.submit(request("a", "a"));

        assertThat(result.badgeCode()).isEqualTo("CAT_PICTURE_DETECTIVE");
        assertThat(result.badgeName()).isEqualTo("小猫图片侦探");
        assertThat(result.newlyEarned()).isTrue();
    }

    @Test
    void acceptsOwnedQuizFromLowerPrimaryTutor() throws Exception {
        AgentQuizRunResponse original = run(42L);
        when(agentClient.getRun("run-1")).thenReturn(ApiResponse.ok(new AgentQuizRunResponse(
                "run-1", "lower-primary-tutor", 42L, "SUCCEEDED", original.artifacts())));
        when(mapper.insert(any(AiPracticeAttempt.class))).thenReturn(1);

        var result = service.submit(request("a", "a"));

        assertThat(result.score()).isEqualTo(20);
        verify(mapper).insert(any(AiPracticeAttempt.class));
    }

    @Test
    void rejectsAnotherUsersRunEvenIfAgentReturnsIt() throws Exception {
        when(agentClient.getRun("run-1")).thenReturn(ApiResponse.ok(run(99L)));

        assertThatThrownBy(() -> service.submit(request("a", "a")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(mapper, never()).insert(any(AiPracticeAttempt.class));
    }

    @Test
    void rejectsUnknownOptionAndDuplicateQuestions() throws Exception {
        when(agentClient.getRun("run-1")).thenReturn(ApiResponse.ok(run(42L)));

        assertThatThrownBy(() -> service.submit(request("invented", "a")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.submit(new PracticeAttemptRequest("run-1", List.of(
                new PracticeAttemptRequest.Answer("q1", "a"),
                new PracticeAttemptRequest.Answer("q1", "b")))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(mapper, never()).insert(any(AiPracticeAttempt.class));
    }

    @Test
    void legacyQuizWithoutKnowledgeCodeStillRecordsAttempt() throws Exception {
        AgentQuizRunResponse original = run(42L);
        var legacyPayload = ((com.fasterxml.jackson.databind.node.ObjectNode) original.artifacts().get(0).payload()).deepCopy();
        legacyPayload.remove("knowledgeCode");
        when(agentClient.getRun("run-1")).thenReturn(ApiResponse.ok(new AgentQuizRunResponse(
                "run-1", "teaching-assistant", 42L, "SUCCEEDED",
                List.of(new AgentQuizRunResponse.QuizArtifactResponse(
                        "artifact-1", "application/vnd.k12.quiz.v1+json", legacyPayload)))));
        when(mapper.insert(any(AiPracticeAttempt.class))).thenReturn(1);

        assertThat(service.submit(request("a", "a")).knowledgeCode()).isNull();
        verifyNoInteractions(masteryMapper);
    }

    @Test
    void findByRunReturnsNullWhenNotSubmittedYet() {
        when(mapper.findByRunAndStudent("run-missing", 42L)).thenReturn(null);

        assertThat(service.findByRun("run-missing")).isNull();
    }

    @Test
    void duplicateSubmissionIsIdempotentOnlyForSameAnswers() {
        AiPracticeAttempt existing = new AiPracticeAttempt();
        existing.setId(7L);
        existing.setRunId("run-1");
        existing.setStudentUserId(42L);
        existing.setTopic("排序小测");
        existing.setScore(20);
        existing.setMaxScore(20);
        existing.setCorrectCount(2);
        existing.setTotalQuestions(2);
        existing.setAnswersJson("{\"q1\":\"a\",\"q2\":\"a\"}");
        existing.setCreatedTime(Instant.now());
        when(mapper.findByRunAndStudent("run-1", 42L)).thenReturn(existing);

        assertThat(service.submit(request("a", "a")).id()).isEqualTo(7L);
        assertThatThrownBy(() -> service.submit(request("b", "a")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verifyNoInteractions(agentClient);
        verifyNoInteractions(masteryMapper);
    }

    @Test
    void duplicateSubmissionAcceptsMysqlJsonReserialization() {
        AiPracticeAttempt existing = new AiPracticeAttempt();
        existing.setId(8L);
        existing.setRunId("run-1");
        existing.setStudentUserId(42L);
        existing.setTopic("排序小测");
        existing.setScore(20);
        existing.setMaxScore(20);
        existing.setCorrectCount(2);
        existing.setTotalQuestions(2);
        existing.setAnswersJson("{\"q2\": \"a\", \"q1\": \"a\"}");
        existing.setCreatedTime(Instant.now());
        when(mapper.findByRunAndStudent("run-1", 42L)).thenReturn(existing);

        assertThat(service.submit(request("a", "a")).id()).isEqualTo(8L);
        verifyNoInteractions(agentClient);
        verifyNoInteractions(masteryMapper);
    }

    @Test
    void concurrentDuplicateReadsCommittedRowWithoutCountingTwice() throws Exception {
        AiPracticeAttempt existing = new AiPracticeAttempt();
        existing.setId(9L);
        existing.setRunId("run-1");
        existing.setStudentUserId(42L);
        existing.setTopic("排序小测");
        existing.setKnowledgeCode("sorting.bubble_sort");
        existing.setScore(20);
        existing.setMaxScore(20);
        existing.setCorrectCount(2);
        existing.setTotalQuestions(2);
        existing.setAnswersJson("{\"q2\": \"a\", \"q1\": \"a\"}");
        existing.setCreatedTime(Instant.now());
        when(agentClient.getRun("run-1")).thenReturn(ApiResponse.ok(run(42L)));
        when(mapper.insert(any(AiPracticeAttempt.class))).thenThrow(new DuplicateKeyException("same run"));
        when(mapper.findByRunAndStudentForUpdate("run-1", 42L)).thenReturn(existing);

        assertThat(service.submit(request("a", "a")).id()).isEqualTo(9L);
        verify(mapper).findByRunAndStudentForUpdate("run-1", 42L);
        verifyNoInteractions(masteryMapper);
    }

    private PracticeAttemptRequest request(String first, String second) {
        return new PracticeAttemptRequest("run-1", List.of(
                new PracticeAttemptRequest.Answer("q1", first),
                new PracticeAttemptRequest.Answer("q2", second)));
    }

    private AgentQuizRunResponse run(Long owner) throws Exception {
        var payload = objectMapper.readTree("""
                {"gameType":"multiple-choice-quiz","title":"排序小测",
                 "knowledgeCode":"sorting.bubble_sort","questions":[
                  {"id":"q1","prompt":"第一题","points":10,"correctOptionId":"a",
                   "errorType":"CONCEPT_CONFUSION",
                   "options":[{"id":"a"},{"id":"b"}]},
                  {"id":"q2","prompt":"第二题","points":10,"correctOptionId":"a",
                   "errorType":"PROCEDURE_ORDER",
                   "options":[{"id":"a"},{"id":"b"}]}
                ]}
                """);
        return new AgentQuizRunResponse("run-1", "teaching-assistant", owner, "SUCCEEDED",
                List.of(new AgentQuizRunResponse.QuizArtifactResponse(
                        "artifact-1", "application/vnd.k12.quiz.v1+json", payload)));
    }
}
