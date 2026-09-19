package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AssessmentLearningResultClient;
import com.k12.platform.agent.client.IamLearningProfileClient;
import com.k12.platform.agent.client.KnowledgeGraphClient;
import com.k12.platform.agent.client.LearningHistoryClient;
import com.k12.platform.agent.client.dto.CourseLearningSummaryResponse;
import com.k12.platform.agent.client.dto.KnowledgeRecommendRequest;
import com.k12.platform.agent.client.dto.LearnerProfileResponse;
import com.k12.platform.agent.client.dto.LearningHistoryResponse;
import com.k12.platform.agent.client.dto.LearningResultPageResponse;
import com.k12.platform.agent.client.dto.LearningResultResponse;
import com.k12.platform.agent.client.dto.PracticeAttemptSummaryResponse;
import com.k12.platform.agent.client.dto.KnowledgeMasterySummaryResponse;
import com.k12.platform.common.api.ApiResponse;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * 为教学 Agent 组装服务端可信的个性化上下文。
 *
 * <p>前端 context 只用于补充当前章节、主题等交互信息。学段、教材、兴趣和近期表现优先从
 * IAM、Assessment 获取，防止前端冒用其他画像。下游不可用时采用降级策略，不阻断教学。</p>
 */
@Service
public class LearnerContextEnricher {

    private static final Logger log = LoggerFactory.getLogger(LearnerContextEnricher.class);
    private static final String TEACHING_ASSISTANT = "teaching-assistant";
    private static final int RECENT_RESULT_LIMIT = 5;
    private static final int MAX_FEEDBACK_LENGTH = 200;
    private static final BigDecimal WEAK_SCORE_THRESHOLD = new BigDecimal("60");

    private final IamLearningProfileClient profileClient;
    private final LearningHistoryClient learningHistoryClient;
    private final AssessmentLearningResultClient learningResultClient;
    private final KnowledgeGraphClient knowledgeGraphClient;

    public LearnerContextEnricher(
            IamLearningProfileClient profileClient,
            LearningHistoryClient learningHistoryClient,
            AssessmentLearningResultClient learningResultClient,
            KnowledgeGraphClient knowledgeGraphClient
    ) {
        this.profileClient = profileClient;
        this.learningHistoryClient = learningHistoryClient;
        this.learningResultClient = learningResultClient;
        this.knowledgeGraphClient = knowledgeGraphClient;
    }

    public Map<String, Object> enrich(String agentCode, Long userId, Map<String, Object> requestContext) {
        return enrich(agentCode, userId, requestContext, null);
    }

    /**
     * @param inputText 本轮学生提问；用于在 Runtime 定题前选定图谱 focus，避免落到「掌握度最弱」的无关知识点。
     */
    public Map<String, Object> enrich(
            String agentCode, Long userId, Map<String, Object> requestContext, String inputText
    ) {
        Map<String, Object> context = requestContext == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(requestContext);
        if (!TEACHING_ASSISTANT.equals(agentCode)) {
            return context;
        }

        Map<String, Object> personalization = new LinkedHashMap<>();
        personalization.put("schemaVersion", "1.1");
        personalization.put("trustedUserId", userId);
        personalization.put("profileStatus", enrichProfile(context, userId));
        personalization.put("learningHistoryStatus", enrichLearningHistory(context));
        personalization.put("performanceStatus", enrichPerformance(context));
        personalization.put("practiceStatus", enrichPractice(context));
        personalization.put("masteryStatus", enrichMastery(context));
        personalization.put("knowledgeGraphStatus", enrichKnowledgeGraph(context, inputText));
        context.put("personalization", personalization);
        return context;
    }

    private String enrichLearningHistory(Map<String, Object> context) {
        try {
            ApiResponse<LearningHistoryResponse> response =
                    learningHistoryClient.getCurrentLearningHistory(RECENT_RESULT_LIMIT);
            LearningHistoryResponse history = requireSuccess(response);
            if (history == null) {
                return "UNAVAILABLE";
            }
            List<CourseLearningSummaryResponse> items = history.items() == null
                    ? List.of()
                    : history.items().stream().filter(item -> item != null).limit(RECENT_RESULT_LIMIT).toList();
            context.put("recentLearningHistory", items.stream().map(this::toSafeLearningHistory).toList());
            return "LOADED";
        } catch (RuntimeException exception) {
            log.warn("读取课程学习历史失败，教学 Agent 将降级，error={}",
                    exception.getClass().getSimpleName());
            return "UNAVAILABLE";
        }
    }

    private String enrichProfile(Map<String, Object> context, Long expectedUserId) {
        try {
            ApiResponse<LearnerProfileResponse> response = profileClient.getCurrentProfile();
            LearnerProfileResponse profile = requireSuccess(response);
            if (profile == null || !expectedUserId.equals(profile.userId())) {
                return "UNAVAILABLE";
            }

            String stage = toAgentStage(profile.schoolStage());
            if (stage != null) {
                context.put("stage", stage);
            }
            if (profile.grade() != null) {
                context.put("grade", toGradeLabel(profile.grade()));
            }
            if (StringUtils.hasText(profile.textbook())) {
                context.put("textbook", profile.textbook().trim());
            }
            context.put("interests", normalizeTextList(profile.interests(), 10, 50));

            Map<String, Object> trustedProfile = new LinkedHashMap<>();
            putIfNotNull(trustedProfile, "schoolStage", profile.schoolStage());
            putIfNotNull(trustedProfile, "grade", profile.grade());
            putIfNotNull(trustedProfile, "textbook", trimToNull(profile.textbook()));
            trustedProfile.put("interests", normalizeTextList(profile.interests(), 10, 50));
            putIfNotNull(trustedProfile, "updatedTime", profile.updatedTime());
            context.put("learnerProfile", trustedProfile);
            return "LOADED";
        } catch (FeignException.NotFound exception) {
            log.info("用户尚未创建学习画像，继续使用请求上下文，userId={}", expectedUserId);
            return "MISSING";
        } catch (RuntimeException exception) {
            log.warn("读取学习画像失败，教学 Agent 将降级，userId={}, error={}",
                    expectedUserId, exception.getClass().getSimpleName());
            return "UNAVAILABLE";
        }
    }

    private String enrichPerformance(Map<String, Object> context) {
        context.put("knownWeakPoints", new ArrayList<String>());
        try {
            ApiResponse<LearningResultPageResponse> response =
                    learningResultClient.getCurrentLearningResults(1, RECENT_RESULT_LIMIT);
            LearningResultPageResponse page = requireSuccess(response);
            if (page == null) {
                return "UNAVAILABLE";
            }

            List<LearningResultResponse> results = page.items() == null
                    ? List.of()
                    : page.items().stream().filter(item -> item != null).limit(RECENT_RESULT_LIMIT).toList();
            context.put("recentPerformance", results.stream().map(this::toSafePerformance).toList());
            context.put("knownWeakPoints", deriveWeakPoints(results));
            return "LOADED";
        } catch (RuntimeException exception) {
            log.warn("读取近期学习结果失败，教学 Agent 将降级，error={}",
                    exception.getClass().getSimpleName());
            return "UNAVAILABLE";
        }
    }

    private String enrichPractice(Map<String, Object> context) {
        context.put("recentPractice", List.of());
        try {
            ApiResponse<List<PracticeAttemptSummaryResponse>> response =
                    learningResultClient.getRecentPracticeAttempts(RECENT_RESULT_LIMIT);
            List<PracticeAttemptSummaryResponse> attempts = requireSuccess(response);
            if (attempts == null) {
                return "UNAVAILABLE";
            }
            List<PracticeAttemptSummaryResponse> recent = attempts.stream()
                    .filter(item -> item != null && item.maxScore() != null && item.maxScore() > 0
                            && item.score() != null)
                    .limit(RECENT_RESULT_LIMIT).toList();
            context.put("recentPractice", recent.stream().map(this::toSafePractice).toList());
            LinkedHashSet<String> weakPoints = new LinkedHashSet<>();
            Object current = context.get("knownWeakPoints");
            if (current instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof String text && StringUtils.hasText(text)) {
                        weakPoints.add(text);
                    }
                }
            }
            for (PracticeAttemptSummaryResponse attempt : recent) {
                if ((long) attempt.score() * 100 < (long) attempt.maxScore() * 60
                        && StringUtils.hasText(attempt.weakPoint())) {
                    weakPoints.add(truncate(attempt.weakPoint(), MAX_FEEDBACK_LENGTH));
                }
                if (weakPoints.size() >= RECENT_RESULT_LIMIT) {
                    break;
                }
            }
            context.put("knownWeakPoints", weakPoints.stream().limit(RECENT_RESULT_LIMIT).toList());
            return "LOADED";
        } catch (RuntimeException exception) {
            log.warn("读取形成性练习失败，教学 Agent 将降级，error={}", exception.getClass().getSimpleName());
            return "UNAVAILABLE";
        }
    }

    private String enrichMastery(Map<String, Object> context) {
        context.put("knowledgeMastery", List.of());
        try {
            ApiResponse<List<KnowledgeMasterySummaryResponse>> response =
                    learningResultClient.getCurrentKnowledgeMastery();
            List<KnowledgeMasterySummaryResponse> rows = requireSuccess(response);
            if (rows == null) {
                return "UNAVAILABLE";
            }
            List<KnowledgeMasterySummaryResponse> safe = rows.stream()
                    .filter(item -> item != null && StringUtils.hasText(item.knowledgeCode())
                            && item.masteryPercent() != null && item.masteryPercent() >= 0
                            && item.masteryPercent() <= 100)
                    .limit(RECENT_RESULT_LIMIT).toList();
            context.put("knowledgeMastery", safe.stream().map(item -> {
                Map<String, Object> value = new LinkedHashMap<String, Object>();
                value.put("knowledgeCode", truncate(item.knowledgeCode(), 64));
                putIfNotNull(value, "topic", truncate(item.topic(), 128));
                value.put("masteryPercent", item.masteryPercent());
                return value;
            }).toList());
            LinkedHashSet<String> weakPoints = new LinkedHashSet<>();
            Object existing = context.get("knownWeakPoints");
            if (existing instanceof List<?> list) {
                for (Object value : list) {
                    if (value instanceof String text && StringUtils.hasText(text)) {
                        weakPoints.add(text);
                    }
                }
            }
            for (KnowledgeMasterySummaryResponse item : safe) {
                if (item.masteryPercent() < 60 && StringUtils.hasText(item.topic())) {
                    weakPoints.add(truncate(item.topic(), MAX_FEEDBACK_LENGTH));
                }
            }
            context.put("knownWeakPoints", weakPoints.stream().limit(RECENT_RESULT_LIMIT).toList());
            return "LOADED";
        } catch (RuntimeException exception) {
            log.warn("读取知识点掌握度失败，教学 Agent 将降级，error={}", exception.getClass().getSimpleName());
            return "UNAVAILABLE";
        }
    }

    private String enrichKnowledgeGraph(Map<String, Object> context, String inputText) {
        context.put("knowledgeGraph", Map.of("enabled", false, "ready", false));
        String focusCode = resolveFocusCode(context, inputText);
        if (!StringUtils.hasText(focusCode)) {
            return "SKIPPED";
        }
        // 写入推断焦点，供 Runtime 与前端观测；不以掌握度最弱点冒充本轮主题。
        context.put("focusCode", focusCode);
        try {
            List<KnowledgeRecommendRequest.MasteryHint> mastery = new ArrayList<>();
            Object raw = context.get("knowledgeMastery");
            if (raw instanceof List<?> list) {
                for (Object item : list) {
                    if (!(item instanceof Map<?, ?> map)) continue;
                    Object code = map.get("knowledgeCode");
                    Object percent = map.get("masteryPercent");
                    if (code instanceof String text && StringUtils.hasText(text) && percent instanceof Number number) {
                        mastery.add(new KnowledgeRecommendRequest.MasteryHint(text, number.intValue()));
                    }
                }
            }
            ApiResponse<Map<String, Object>> response = knowledgeGraphClient.teachingContext(
                    new KnowledgeRecommendRequest(focusCode, mastery));
            Map<String, Object> graph = requireSuccess(response);
            if (graph == null) {
                return "UNAVAILABLE";
            }
            context.put("knowledgeGraph", graph);
            // 先修缺口只放在 knowledgeGraph 导航区，不再混入 knownWeakPoints，
            // 避免「本轮重点关注」被其它主题的练习/掌握度文案刷屏。
            return Boolean.TRUE.equals(graph.get("ready")) ? "LOADED" : "UNAVAILABLE";
        } catch (RuntimeException exception) {
            log.warn("读取知识图谱失败，教学 Agent 将降级，error={}", exception.getClass().getSimpleName());
            return "UNAVAILABLE";
        }
    }

    static String resolveFocusCode(Map<String, Object> context, String inputText) {
        for (String key : List.of("topicCode", "knowledgeCode", "focusCode")) {
            Object value = context.get(key);
            if (value instanceof String text && StringUtils.hasText(text)) {
                return text.trim();
            }
        }
        String matched = TopicFocusMatcher.match(inputText);
        if (StringUtils.hasText(matched)) {
            return matched;
        }
        // 不再回退到「掌握度最低」：那会把排序薄弱点带到「什么是数据」等提问上。
        return null;
    }

    private Map<String, Object> toSafePractice(PracticeAttemptSummaryResponse attempt) {
        Map<String, Object> item = new LinkedHashMap<>();
        putIfNotNull(item, "topic", truncate(attempt.topic(), 128));
        item.put("scorePercent", (int) Math.max(0, Math.min(100,
                (long) attempt.score() * 100 / attempt.maxScore())));
        putIfNotNull(item, "weakPoint", truncate(attempt.weakPoint(), MAX_FEEDBACK_LENGTH));
        return item;
    }

    private Map<String, Object> toSafePerformance(LearningResultResponse result) {
        Map<String, Object> item = new LinkedHashMap<>();
        putIfNotNull(item, "homeworkId", result.homeworkId());
        putIfNotNull(item, "courseId", result.courseId());
        putIfNotNull(item, "status", trimToNull(result.status()));
        putIfNotNull(item, "score", result.score());
        putIfNotNull(item, "feedback", truncate(result.feedback(), MAX_FEEDBACK_LENGTH));
        putIfNotNull(item, "submittedTime", result.submittedTime());
        putIfNotNull(item, "gradedTime", result.gradedTime());
        return item;
    }

    private Map<String, Object> toSafeLearningHistory(CourseLearningSummaryResponse source) {
        Map<String, Object> item = new LinkedHashMap<>();
        putIfNotNull(item, "courseId", source.courseId());
        putIfNotNull(item, "courseTitle", truncate(source.courseTitle(), 128));
        putIfNotNull(item, "subject", truncate(source.subject(), 64));
        putIfNotNull(item, "gradeLevel", truncate(source.gradeLevel(), 32));
        item.put("totalChapters", Math.max(0, source.totalChapters()));
        item.put("completedChapters", Math.max(0, source.completedChapters()));
        item.put("progressPercent", Math.max(0, Math.min(source.progressPercent(), 100)));
        putIfNotNull(item, "enrolledTime", source.enrolledTime());
        putIfNotNull(item, "lastLearningTime", source.lastLearningTime());
        return item;
    }

    private List<String> deriveWeakPoints(List<LearningResultResponse> results) {
        LinkedHashSet<String> weakPoints = new LinkedHashSet<>();
        for (LearningResultResponse result : results) {
            if (result.score() == null || result.score().compareTo(WEAK_SCORE_THRESHOLD) >= 0) {
                continue;
            }
            String feedback = truncate(result.feedback(), MAX_FEEDBACK_LENGTH);
            if (feedback != null) {
                weakPoints.add(feedback);
            } else if (result.courseId() != null) {
                weakPoints.add("课程 " + result.courseId() + " 的近期作业需要巩固");
            } else if (result.homeworkId() != null) {
                weakPoints.add("作业 " + result.homeworkId() + " 需要巩固");
            }
            if (weakPoints.size() >= RECENT_RESULT_LIMIT) {
                break;
            }
        }
        return new ArrayList<>(weakPoints);
    }

    private <T> T requireSuccess(ApiResponse<T> response) {
        return response != null && response.code() == 200 ? response.data() : null;
    }

    private String toAgentStage(String schoolStage) {
        if (schoolStage == null) {
            return null;
        }
        return switch (schoolStage.trim().toUpperCase()) {
            case "PRIMARY_LOWER" -> "lower_primary";
            case "PRIMARY_UPPER" -> "upper_primary";
            case "JUNIOR_HIGH" -> "middle_school";
            case "SENIOR_HIGH" -> "high_school";
            default -> null;
        };
    }

    private String toGradeLabel(int grade) {
        String[] labels = {
                "小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级",
                "初中七年级", "初中八年级", "初中九年级", "高中一年级", "高中二年级", "高中三年级"
        };
        return grade >= 1 && grade <= labels.length ? labels[grade - 1] : String.valueOf(grade);
    }

    private List<String> normalizeTextList(List<String> values, int maxItems, int maxLength) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .map(value -> value.substring(0, Math.min(value.length(), maxLength)))
                .distinct()
                .limit(maxItems)
                .toList();
    }

    private String truncate(String value, int maxLength) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.substring(0, Math.min(normalized.length(), maxLength));
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private void putIfNotNull(Map<String, Object> target, String key, Object value) {
        if (value != null) {
            target.put(key, value);
        }
    }
}
