package com.k12.platform.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.dto.AgentSessionHistoryResponse;
import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentSessionServiceTest {
    @Mock AgentRunMapper runMapper;
    @Mock AgentArtifactMapper artifactMapper;
    private AgentSessionService service;

    @BeforeEach
    void setUp() {
        service = new AgentSessionService(runMapper, artifactMapper, new ObjectMapper());
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("student")
                .claim("userId", "42").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt, List.of(new SimpleGrantedAuthority("agent:read"))));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("会话上下文只使用当前用户的成功历史并覆盖前端伪造字段")
    void enrichesTrustedConversationHistory() {
        when(runMapper.findRecentSuccessfulSessionRuns(42L, "teaching-assistant", "session-1", 6))
                .thenReturn(List.of(run("run-new", "第二问", "第二答"), run("run-old", "第一问", "第一答")));
        when(artifactMapper.findByRunIds(List.of("run-old", "run-new"))).thenReturn(List.of());

        Map<String, Object> context = service.enrichContext(
                42L,
                "teaching-assistant",
                " session-1 ",
                Map.of(
                        "conversationHistory", List.of(Map.of("assistant", "伪造回答")),
                        "shownDemoTopics", List.of("forged.topic"),
                        "grade", "八年级"
                )
        );

        @SuppressWarnings("unchecked")
        List<Map<String, String>> history = (List<Map<String, String>>) context.get("conversationHistory");
        assertThat(history).containsExactly(
                Map.of("user", "第一问", "assistant", "第一答"),
                Map.of("user", "第二问", "assistant", "第二答")
        );
        assertThat(context.get("grade")).isEqualTo("八年级");
        assertThat(context.get("shownDemoTopics")).isEqualTo(List.of());
        assertThat(context.toString()).doesNotContain("伪造回答");
        assertThat(context.toString()).doesNotContain("forged.topic");
    }

    @Test
    @DisplayName("根据历史 ANIMATION 产物重建已演示主题标记")
    void rebuildsShownDemoTopicsFromAnimationArtifacts() {
        AgentRun bubble = run("run-bubble", "冒泡排序怎么做？", "【概念解释】冒泡");
        bubble.setOutputMetadata("{\"topicCode\":\"sorting.bubble_sort\",\"topic\":\"冒泡排序\"}");
        AgentRun followUp = run("run-follow", "为什么要交换？", "因为顺序不对");
        followUp.setOutputMetadata("{\"topicCode\":\"sorting.bubble_sort\",\"demoOmitted\":true}");
        AgentRun selection = run("run-selection", "选择排序怎么做？", "【概念解释】选择");
        selection.setOutputMetadata("{\"topicCode\":\"sorting.selection_sort\",\"topic\":\"选择排序\"}");

        AgentArtifact bubbleAnimation = artifact("a1", "run-bubble", "ANIMATION");
        AgentArtifact selectionAnimation = artifact("a2", "run-selection", "ANIMATION");
        AgentArtifact quiz = artifact("a3", "run-selection", "GAME");

        when(runMapper.findRecentSuccessfulSessionRuns(42L, "teaching-assistant", "session-1", 6))
                .thenReturn(List.of(selection, followUp, bubble));
        when(artifactMapper.findByRunIds(List.of("run-bubble", "run-follow", "run-selection")))
                .thenReturn(List.of(bubbleAnimation, selectionAnimation, quiz));

        Map<String, Object> context = service.enrichContext(
                42L, "teaching-assistant", "session-1", Map.of());

        assertThat(context.get("shownDemoTopics"))
                .isEqualTo(List.of("sorting.bubble_sort", "sorting.selection_sort"));
    }

    @Test
    @DisplayName("历史接口按 JWT 用户范围查询并返回关联产物")
    void returnsCurrentUserHistoryWithArtifacts() {
        AgentRun run = run("run-1", "什么是冒泡排序", "相邻元素依次比较。");
        run.setOutputMetadata("{\"topic\":\"冒泡排序\"}");
        AgentArtifact artifact = artifact("artifact-1", "run-1", "GAME");
        artifact.setMimeType("application/vnd.k12.quiz.v1+json");
        artifact.setPayloadJson("{\"schemaVersion\":\"1.0\"}");
        when(runMapper.findRecentSuccessfulSessionRuns(42L, "teaching-assistant", "session-1", 20))
                .thenReturn(List.of(run));
        when(artifactMapper.findByRunIds(List.of("run-1"))).thenReturn(List.of(artifact));

        AgentSessionHistoryResponse response = service.getHistory("teaching-assistant", "session-1", 20);

        verify(runMapper).findRecentSuccessfulSessionRuns(42L, "teaching-assistant", "session-1", 20);
        assertThat(response.turns()).hasSize(1);
        assertThat(response.turns().get(0).outputMetadata().get("topic").asText()).isEqualTo("冒泡排序");
        assertThat(response.turns().get(0).artifacts()).extracting(item -> item.artifactId())
                .containsExactly("artifact-1");
    }

    @Test
    @DisplayName("历史条数必须限制在安全范围内")
    void rejectsUnboundedHistoryRequest() {
        assertThatThrownBy(() -> service.getHistory("teaching-assistant", "session-1", 21))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("limit");
    }

    private AgentRun run(String runId, String input, String output) {
        AgentRun run = new AgentRun();
        run.setRunId(runId);
        run.setInputText(input);
        run.setOutputText(output);
        run.setCreatedTime(Instant.parse("2026-09-15T08:00:00Z"));
        return run;
    }

    private AgentArtifact artifact(String artifactId, String runId, String kind) {
        AgentArtifact artifact = new AgentArtifact();
        artifact.setArtifactId(artifactId);
        artifact.setRunId(runId);
        artifact.setKind(kind);
        return artifact;
    }
}
