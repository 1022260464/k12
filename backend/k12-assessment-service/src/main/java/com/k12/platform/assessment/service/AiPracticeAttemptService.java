package com.k12.platform.assessment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.client.AgentQuizRunClient;
import com.k12.platform.assessment.dto.AgentQuizRunResponse;
import com.k12.platform.assessment.dto.PracticeAttemptRequest;
import com.k12.platform.assessment.dto.PracticeAttemptResponse;
import com.k12.platform.assessment.mapper.AiPracticeAttemptMapper;
import com.k12.platform.assessment.mapper.AiKnowledgeMasteryMapper;
import com.k12.platform.assessment.model.AiPracticeAttempt;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import feign.FeignException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;

/** 小测答案由 Agent 已持久化的题目判分；学生提交的分数和答案键均不可信。 */
@Service
public class AiPracticeAttemptService {
    private static final String QUIZ_MIME = "application/vnd.k12.quiz.v1+json";
    private static final Set<String> QUIZ_AGENT_CODES = Set.of(
            "teaching-assistant",
            "lower-primary-tutor"
    );
    private static final Pattern KNOWLEDGE_CODE = Pattern.compile("[a-z][a-z0-9_.-]{2,63}");
    private static final Pattern ERROR_TYPE = Pattern.compile("[A-Z][A-Z0-9_]{2,63}");

    private final AgentQuizRunClient agentClient;
    private final AiPracticeAttemptMapper mapper;
    private final AiKnowledgeMasteryMapper masteryMapper;
    private final ObjectMapper objectMapper;

    public AiPracticeAttemptService(AgentQuizRunClient agentClient, AiPracticeAttemptMapper mapper,
                                    AiKnowledgeMasteryMapper masteryMapper,
                                    ObjectMapper objectMapper) {
        this.agentClient = agentClient;
        this.mapper = mapper;
        this.masteryMapper = masteryMapper;
        this.objectMapper = objectMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    @Transactional
    public PracticeAttemptResponse submit(PracticeAttemptRequest request) {
        Long userId = K12SecurityContext.requireUserId();
        String answersJson = canonicalAnswers(request.answers());
        AiPracticeAttempt existing = mapper.findByRunAndStudent(request.runId(), userId);
        if (existing != null) {
            return requireSameSubmission(existing, answersJson);
        }

        AgentQuizRunResponse run = loadRun(request.runId());
        if (!request.runId().equals(run.runId()) || !userId.equals(run.userId())
                || !QUIZ_AGENT_CODES.contains(run.agentCode()) || !"SUCCEEDED".equals(run.status())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到可提交的本人教学小测");
        }
        AgentQuizRunResponse.QuizArtifactResponse artifact = run.artifacts() == null ? null
                : run.artifacts().stream().filter(item -> QUIZ_MIME.equals(item.mimeType())).findFirst().orElse(null);
        if (artifact == null || artifact.payload() == null || artifact.artifactId() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "该教学运行没有可提交的小测");
        }
        AiPracticeAttempt attempt = grade(run, artifact, userId, answersJson,
                request.hintCount() == null ? 0 : request.hintCount(),
                request.durationMs() == null ? 0L : request.durationMs());
        try {
            mapper.insert(attempt);
        } catch (DuplicateKeyException exception) {
            // RR 隔离级别下普通快照读可能看不到并发请求刚提交的行，锁定读获取最新值。
            return requireSameSubmission(mapper.findByRunAndStudentForUpdate(request.runId(), userId), answersJson);
        }
        if (attempt.getKnowledgeCode() != null) {
            masteryMapper.recordAttempt(userId, attempt.getKnowledgeCode(), masteryTopic(attempt.getTopic()),
                    attempt.getScore(), attempt.getMaxScore(),
                    (int) ((long) attempt.getScore() * 100 / attempt.getMaxScore()), attempt.getCreatedTime());
        }
        return toResponse(attempt, true);
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public PracticeAttemptResponse findByRun(String runId) {
        AiPracticeAttempt attempt = mapper.findByRunAndStudent(runId, K12SecurityContext.requireUserId());
        // 未作答是常态查询结果，返回 null 而不是 404，避免学习台恢复历史时刷屏。
        return attempt == null ? null : toResponse(attempt, false);
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public List<PracticeAttemptResponse> findRecent(int limit) {
        if (limit < 1 || limit > 20) {
            throw new IllegalArgumentException("limit必须在1到20之间");
        }
        return mapper.findRecentByStudent(K12SecurityContext.requireUserId(), limit).stream()
                .map(attempt -> toResponse(attempt, false)).toList();
    }

    private AgentQuizRunResponse loadRun(String runId) {
        try {
            ApiResponse<AgentQuizRunResponse> response = agentClient.getRun(runId);
            if (response == null || response.code() != 200 || response.data() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "教学运行结果不可用");
            }
            return response.data();
        } catch (FeignException.NotFound | FeignException.Forbidden exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到可提交的本人教学小测");
        } catch (FeignException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "教学运行服务暂不可用");
        }
    }

    private AiPracticeAttempt grade(AgentQuizRunResponse run,
                                    AgentQuizRunResponse.QuizArtifactResponse artifact,
                                    Long userId, String answersJson, int hintCount, long durationMs) {
        JsonNode payload = artifact.payload();
        JsonNode questions = payload.path("questions");
        if (!"multiple-choice-quiz".equals(payload.path("gameType").asText())
                || !questions.isArray() || questions.isEmpty() || questions.size() > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "小测题目格式无效");
        }
        Map<String, String> answers = readAnswers(answersJson);
        if (answers.size() != questions.size()) {
            throw new IllegalArgumentException("请回答全部小测题目");
        }
        int score = 0;
        int maxScore = 0;
        int correctCount = 0;
        String weakPoint = null;
        Set<String> errorTypes = new LinkedHashSet<>();
        Map<String, Boolean> seen = new HashMap<>();
        for (JsonNode question : questions) {
            String id = question.path("id").asText("");
            String correct = question.path("correctOptionId").asText("");
            int points = question.path("points").asInt(0);
            JsonNode options = question.path("options");
            if (id.isBlank() || correct.isBlank() || points < 1 || points > 100
                    || !options.isArray() || options.isEmpty() || seen.putIfAbsent(id, true) != null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "小测题目格式无效");
            }
            String selected = answers.get(id);
            if (selected == null) {
                throw new IllegalArgumentException("小测答案与题目不匹配");
            }
            boolean selectedExists = false;
            boolean correctExists = false;
            for (JsonNode option : options) {
                selectedExists |= selected.equals(option.path("id").asText());
                correctExists |= correct.equals(option.path("id").asText());
            }
            if (!correctExists) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "小测题目格式无效");
            }
            if (!selectedExists) {
                throw new IllegalArgumentException("选项不属于当前题目");
            }
            maxScore += points;
            if (selected.equals(correct)) {
                score += points;
                correctCount++;
            } else {
                String errorType = question.path("errorType").asText("INCORRECT_SELECTION");
                if (!ERROR_TYPE.matcher(errorType).matches()) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "小测错误类型无效");
                }
                errorTypes.add(errorType);
                if (weakPoint == null) {
                    weakPoint = truncate(question.path("prompt").asText("该知识点需要巩固"), 255);
                }
            }
        }
        AiPracticeAttempt attempt = new AiPracticeAttempt();
        attempt.setStudentUserId(userId);
        attempt.setRunId(run.runId());
        attempt.setArtifactId(artifact.artifactId());
        attempt.setTopic(truncate(payload.path("title").asText("课堂小测"), 128));
        String knowledgeCode = payload.path("knowledgeCode").asText("");
        if (!knowledgeCode.isBlank() && !KNOWLEDGE_CODE.matcher(knowledgeCode).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "小测知识点编码无效");
        }
        attempt.setKnowledgeCode(knowledgeCode.isBlank() ? null : knowledgeCode);
        attempt.setScore(score);
        attempt.setMaxScore(maxScore);
        attempt.setCorrectCount(correctCount);
        attempt.setTotalQuestions(questions.size());
        attempt.setWeakPoint(weakPoint);
        attempt.setHintCount(hintCount);
        attempt.setDurationMs(durationMs);
        attempt.setErrorTypesJson(writeErrorTypes(errorTypes));
        attempt.setAnswersJson(answersJson);
        attempt.setCreatedTime(Instant.now());
        return attempt;
    }

    private String canonicalAnswers(List<PracticeAttemptRequest.Answer> answers) {
        Map<String, String> values = new TreeMap<>();
        for (PracticeAttemptRequest.Answer answer : answers) {
            if (answer == null || answer.questionId() == null || answer.optionId() == null
                    || answer.questionId().isBlank() || answer.optionId().isBlank()
                    || values.putIfAbsent(answer.questionId(), answer.optionId()) != null) {
                throw new IllegalArgumentException("小测答案存在空值或重复题目");
            }
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("小测答案格式无效", exception);
        }
    }

    private Map<String, String> readAnswers(String value) {
        try {
            return objectMapper.readValue(value, new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("小测答案格式无效", exception);
        }
    }

    private PracticeAttemptResponse requireSameSubmission(AiPracticeAttempt existing, String answersJson) {
        if (existing == null || !readAnswers(answersJson).equals(readAnswers(existing.getAnswersJson()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该次小测已提交，请开始新的教学轮次");
        }
        return toResponse(existing, false);
    }

    private PracticeAttemptResponse toResponse(AiPracticeAttempt attempt, boolean newlyEarned) {
        Badge badge = badgeFor(attempt);
        return new PracticeAttemptResponse(attempt.getId(), attempt.getRunId(), attempt.getTopic(),
                attempt.getKnowledgeCode(),
                attempt.getScore(), attempt.getMaxScore(), attempt.getCorrectCount(),
                attempt.getTotalQuestions(), attempt.getWeakPoint(), defaultInt(attempt.getHintCount()),
                defaultLong(attempt.getDurationMs()), readErrorTypes(attempt.getErrorTypesJson()),
                attempt.getCreatedTime(),
                badge == null ? null : badge.code(), badge == null ? null : badge.name(),
                badge != null && newlyEarned);
    }

    private String writeErrorTypes(Set<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("无法保存练习错误类型", exception);
        }
    }

    private List<String> readErrorTypes(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            List<String> values = objectMapper.readValue(value,
                    new com.fasterxml.jackson.core.type.TypeReference<>() {});
            List<String> safe = new ArrayList<>();
            for (String item : values) {
                if (item != null && ERROR_TYPE.matcher(item).matches() && safe.size() < 10) {
                    safe.add(item);
                }
            }
            return List.copyOf(safe);
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private int defaultInt(Integer value) {
        return value == null ? 0 : value;
    }

    private long defaultLong(Long value) {
        return value == null ? 0L : value;
    }

    /**
     * 徽章资格从已持久化、服务端判分的练习记录推导，不接受前端传入的徽章或分数。
     * 这样旧数据库无需新增奖励表，重复读取同一练习也能稳定恢复已获得的徽章。
     */
    private Badge badgeFor(AiPracticeAttempt attempt) {
        if ("machine_learning.image_classification".equals(attempt.getKnowledgeCode())) {
            return new Badge("CAT_PICTURE_DETECTIVE", "小猫图片侦探");
        }
        return null;
    }

    private record Badge(String code, String name) {
    }

    private String truncate(String value, int limit) {
        return value.length() <= limit ? value : value.substring(0, limit);
    }

    private String masteryTopic(String title) {
        String suffix = "课堂小测";
        String normalized = title.trim();
        return normalized.endsWith(suffix) && normalized.length() > suffix.length()
                ? normalized.substring(0, normalized.length() - suffix.length()).trim() : normalized;
    }
}
