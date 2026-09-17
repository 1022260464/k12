package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AssessmentLearningResultClient;
import com.k12.platform.agent.client.IamLearningProfileClient;
import com.k12.platform.agent.client.LearningHistoryClient;
import com.k12.platform.agent.client.dto.CourseLearningSummaryResponse;
import com.k12.platform.agent.client.dto.LearnerProfileResponse;
import com.k12.platform.agent.client.dto.LearningHistoryResponse;
import com.k12.platform.agent.client.dto.LearningResultPageResponse;
import com.k12.platform.agent.client.dto.LearningResultResponse;
import com.k12.platform.agent.client.dto.PracticeAttemptSummaryResponse;
import com.k12.platform.agent.client.dto.KnowledgeMasterySummaryResponse;
import com.k12.platform.common.api.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearnerContextEnricherTest {

    @Mock
    private IamLearningProfileClient profileClient;
    @Mock
    private LearningHistoryClient learningHistoryClient;
    @Mock
    private AssessmentLearningResultClient learningResultClient;

    @Test
    @DisplayName("服务端画像覆盖前端字段，并从低分作业生成安全的薄弱点")
    void enrichesTeachingContextFromTrustedServices() {
        Instant now = Instant.parse("2026-09-15T08:00:00Z");
        when(profileClient.getCurrentProfile()).thenReturn(ApiResponse.ok(
                new LearnerProfileResponse(
                        42L,
                        "JUNIOR_HIGH",
                        8,
                        "K12人工智能通识教材",
                        List.of("机器人", "编程", "机器人"),
                        now
                )
        ));
        when(learningResultClient.getCurrentLearningResults(1, 5)).thenReturn(ApiResponse.ok(
                new LearningResultPageResponse(
                        List.of(
                                new LearningResultResponse(
                                        101L, 10L, "GRADED", new BigDecimal("55"),
                                        "循环边界和相邻比较需要巩固", now, now
                                ),
                                new LearningResultResponse(
                                        102L, 10L, "GRADED", new BigDecimal("92"),
                                        "掌握良好", now, now
                                )
                        ),
                        1,
                        5,
                        2
                )
        ));
        when(learningHistoryClient.getCurrentLearningHistory(5)).thenReturn(ApiResponse.ok(
                new LearningHistoryResponse(List.of(
                        new CourseLearningSummaryResponse(
                                10L, "排序算法入门", "人工智能", "八年级",
                                4, 2, 65, now, now
                        )
                ))
        ));

        LearnerContextEnricher enricher = new LearnerContextEnricher(
                profileClient, learningHistoryClient, learningResultClient);
        Map<String, Object> context = enricher.enrich(
                "teaching-assistant",
                42L,
                Map.of(
                        "stage", "high_school",
                        "grade", "高中三年级",
                        "knownWeakPoints", List.of("前端自行填写"),
                        "chapter", "排序算法"
                )
        );

        assertThat(context.get("stage")).isEqualTo("middle_school");
        assertThat(context.get("grade")).isEqualTo("初中八年级");
        assertThat(context.get("textbook")).isEqualTo("K12人工智能通识教材");
        assertThat(context.get("interests")).isEqualTo(List.of("机器人", "编程"));
        assertThat(context.get("chapter")).isEqualTo("排序算法");
        assertThat(context.get("knownWeakPoints"))
                .isEqualTo(List.of("循环边界和相邻比较需要巩固"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> learningHistory =
                (List<Map<String, Object>>) context.get("recentLearningHistory");
        assertThat(learningHistory).singleElement().satisfies(item -> assertThat(item)
                .containsEntry("courseTitle", "排序算法入门")
                .containsEntry("progressPercent", 65));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> recentPerformance =
                (List<Map<String, Object>>) context.get("recentPerformance");
        assertThat(recentPerformance).hasSize(2);
        assertThat(recentPerformance.get(0))
                .containsEntry("homeworkId", 101L)
                .containsEntry("score", new BigDecimal("55"))
                .doesNotContainKeys("answerContent", "studentUserId", "gradedBy");

        @SuppressWarnings("unchecked")
        Map<String, Object> personalization = (Map<String, Object>) context.get("personalization");
        assertThat(personalization)
                .containsEntry("schemaVersion", "1.0")
                .containsEntry("trustedUserId", 42L)
                .containsEntry("profileStatus", "LOADED")
                .containsEntry("learningHistoryStatus", "LOADED")
                .containsEntry("performanceStatus", "LOADED");
    }

    @Test
    @DisplayName("下游服务不可用时保留请求上下文并标记降级")
    void degradesWithoutBreakingAgentRequest() {
        when(profileClient.getCurrentProfile()).thenThrow(new IllegalStateException("iam unavailable"));
        when(learningHistoryClient.getCurrentLearningHistory(5))
                .thenThrow(new IllegalStateException("learning unavailable"));
        when(learningResultClient.getCurrentLearningResults(1, 5))
                .thenThrow(new IllegalStateException("assessment unavailable"));

        LearnerContextEnricher enricher = new LearnerContextEnricher(
                profileClient, learningHistoryClient, learningResultClient);
        Map<String, Object> context = enricher.enrich(
                "teaching-assistant",
                42L,
                Map.of("stage", "upper_primary", "knownWeakPoints", List.of("循环"))
        );

        assertThat(context.get("stage")).isEqualTo("upper_primary");
        assertThat(context.get("knownWeakPoints")).isEqualTo(List.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> personalization = (Map<String, Object>) context.get("personalization");
        assertThat(personalization)
                .containsEntry("profileStatus", "UNAVAILABLE")
                .containsEntry("learningHistoryStatus", "UNAVAILABLE")
                .containsEntry("performanceStatus", "UNAVAILABLE");
    }

    @Test
    @DisplayName("低分形成性练习进入下一轮教学摘要，但答案和身份不进入模型")
    void enrichesPracticeWeakPoint() {
        when(learningResultClient.getRecentPracticeAttempts(5)).thenReturn(ApiResponse.ok(List.of(
                new PracticeAttemptSummaryResponse("排序小测", 10, 20, 1, 2, "相邻比较需要复习")
        )));
        LearnerContextEnricher enricher = new LearnerContextEnricher(
                profileClient, learningHistoryClient, learningResultClient);

        Map<String, Object> context = enricher.enrich("teaching-assistant", 42L, Map.of());

        assertThat(context.get("knownWeakPoints")).isEqualTo(List.of("相邻比较需要复习"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> practice = (List<Map<String, Object>>) context.get("recentPractice");
        assertThat(practice).singleElement().satisfies(item -> assertThat(item)
                .containsEntry("scorePercent", 50)
                .containsEntry("topic", "排序小测")
                .doesNotContainKeys("studentUserId", "answersJson", "correctOptionId"));
    }

    @Test
    @DisplayName("可信知识点掌握度进入教学上下文，低掌握度成为复习依据")
    void enrichesKnowledgeMastery() {
        when(learningResultClient.getCurrentKnowledgeMastery()).thenReturn(ApiResponse.ok(List.of(
                new KnowledgeMasterySummaryResponse("sorting.bubble_sort", "冒泡排序", 2, 45, 30, "REVIEW")
        )));
        LearnerContextEnricher enricher = new LearnerContextEnricher(
                profileClient, learningHistoryClient, learningResultClient);

        Map<String, Object> context = enricher.enrich("teaching-assistant", 42L, Map.of());

        assertThat(context.get("knownWeakPoints")).isEqualTo(List.of("冒泡排序"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> mastery = (List<Map<String, Object>>) context.get("knowledgeMastery");
        assertThat(mastery).singleElement().satisfies(item -> assertThat(item)
                .containsEntry("knowledgeCode", "sorting.bubble_sort")
                .containsEntry("masteryPercent", 45)
                .doesNotContainKeys("studentUserId", "answersJson", "correctOptionId"));
    }

    @Test
    @DisplayName("非教学智能体不调用画像和成绩服务")
    void skipsPersonalizationForOtherAgents() {
        LearnerContextEnricher enricher = new LearnerContextEnricher(
                profileClient, learningHistoryClient, learningResultClient);

        Map<String, Object> context = enricher.enrich("demo-chart", 42L, Map.of("week", 1));

        assertThat(context).containsExactly(Map.entry("week", 1));
        verifyNoInteractions(profileClient, learningHistoryClient, learningResultClient);
    }
}
