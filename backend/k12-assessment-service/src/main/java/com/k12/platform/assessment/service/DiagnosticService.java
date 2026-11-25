package com.k12.platform.assessment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.DiagnosticQuestionResponse;
import com.k12.platform.assessment.dto.DiagnosticResultResponse;
import com.k12.platform.assessment.dto.DiagnosticSubmitRequest;
import com.k12.platform.assessment.mapper.AiKnowledgeMasteryMapper;
import com.k12.platform.assessment.mapper.DiagnosticAttemptMapper;
import com.k12.platform.assessment.mapper.LearningEvidenceMapper;
import com.k12.platform.assessment.model.DiagnosticAttempt;
import com.k12.platform.assessment.model.LearningEvidence;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 首次学情诊断：题库与答案键都在服务端，一次答卷生成初始画像
 * （各类别得分 + 优势/薄弱 + 推荐起点），并按类别写入 DIAGNOSTIC 学习证据。
 * 诊断是形成性引导，不是正式测评，重复答卷以最新一次为准。
 */
@Service
public class DiagnosticService {
    private static final Set<String> STAGES = Set.of(
            "lower_primary", "upper_primary", "middle_school", "high_school");
    private static final int CONFIDENCE_DIAGNOSTIC = 60;

    private final DiagnosticAttemptMapper mapper;
    private final LearningEvidenceMapper evidenceMapper;
    private final AiKnowledgeMasteryMapper masteryMapper;
    private final ObjectMapper objectMapper;
    private Map<String, List<BankQuestion>> bank = Map.of();

    public DiagnosticService(DiagnosticAttemptMapper mapper, LearningEvidenceMapper evidenceMapper,
                             AiKnowledgeMasteryMapper masteryMapper, ObjectMapper objectMapper) {
        this.mapper = mapper;
        this.evidenceMapper = evidenceMapper;
        this.masteryMapper = masteryMapper;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadBank() {
        try {
            Map<String, Object> raw = objectMapper.readValue(
                    new ClassPathResource("diagnostic/diagnostic-bank.json").getInputStream(),
                    new TypeReference<>() {});
            Object stagesNode = raw.get("stages");
            if (!(stagesNode instanceof Map)) {
                throw new IllegalStateException("诊断题库缺少 stages 结构");
            }
            Map<String, Object> stages = objectMapper.convertValue(stagesNode,
                    new TypeReference<Map<String, Object>>() {});
            Map<String, List<BankQuestion>> parsed = new LinkedHashMap<>();
            stages.forEach((stage, questions) -> {
                if (!STAGES.contains(stage)) {
                    return;
                }
                List<BankQuestion> parsedQuestions = objectMapper.convertValue(questions,
                        new TypeReference<List<BankQuestion>>() {});
                for (BankQuestion question : parsedQuestions) {
                    if (question.id() == null || question.prompt() == null || question.options() == null
                            || question.options().size() < 2 || question.options().size() > 6
                            || question.options().stream().noneMatch(option -> option.id().equals(question.correctOptionId()))) {
                        throw new IllegalStateException("诊断题库存在无效题目：" + stage + "/" + question.id());
                    }
                }
                parsed.put(stage, List.copyOf(parsedQuestions));
            });
            if (parsed.size() != STAGES.size()) {
                throw new IllegalStateException("诊断题库学段不完整");
            }
            this.bank = Map.copyOf(parsed);
        } catch (Exception exception) {
            throw new IllegalStateException("无法加载诊断题库", exception);
        }
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public List<DiagnosticQuestionResponse> paper(String stage) {
        requireStage(stage);
        return bank.get(stage).stream()
                .map(question -> new DiagnosticQuestionResponse(question.id(), question.knowledgeCode(),
                        question.categoryCode(), question.categoryTitle(), question.prompt(),
                        question.options().stream()
                                .map(option -> new DiagnosticQuestionResponse.Option(option.id(), option.text()))
                                .toList()))
                .toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    @Transactional
    public DiagnosticResultResponse submit(DiagnosticSubmitRequest request) {
        requireStage(request.stage());
        Long userId = K12SecurityContext.requireUserId();
        List<BankQuestion> questions = bank.get(request.stage());
        Map<String, String> answers = new LinkedHashMap<>();
        for (DiagnosticSubmitRequest.Answer answer : request.answers()) {
            if (answers.putIfAbsent(answer.questionId(), answer.optionId()) != null) {
                throw new IllegalArgumentException("诊断答卷存在重复题目");
            }
        }
        if (answers.size() != questions.size()) {
            throw new IllegalArgumentException("请回答全部诊断题目");
        }
        for (BankQuestion question : questions) {
            String selected = answers.get(question.id());
            if (selected == null || question.options().stream().noneMatch(option -> option.id().equals(selected))) {
                throw new IllegalArgumentException("诊断答案与题目不匹配");
            }
        }

        // 按类别聚合（保持题目顺序），同一类别可有多题。
        Map<String, int[]> byCategory = new LinkedHashMap<>();
        Map<String, String> categoryTitles = new LinkedHashMap<>();
        Map<String, String> representativeCode = new LinkedHashMap<>();
        int correctCount = 0;
        for (BankQuestion question : questions) {
            int[] slot = byCategory.computeIfAbsent(question.categoryCode(), key -> new int[3]);
            slot[1]++;
            if (answers.get(question.id()).equals(question.correctOptionId())) {
                slot[0]++;
                correctCount++;
            }
            categoryTitles.putIfAbsent(question.categoryCode(), question.categoryTitle());
            representativeCode.putIfAbsent(question.categoryCode(), question.knowledgeCode());
        }
        int scorePercent = correctCount * 100 / questions.size();

        List<DiagnosticResultResponse.CategoryScore> categories = new ArrayList<>();
        List<String> strengths = new ArrayList<>();
        List<DiagnosticResultResponse.WeakCategory> weaknesses = new ArrayList<>();
        byCategory.forEach((code, slot) -> {
            int percent = slot[0] * 100 / slot[1];
            categories.add(new DiagnosticResultResponse.CategoryScore(code, categoryTitles.get(code),
                    slot[0], slot[1], percent));
            if (percent == 100) {
                strengths.add(categoryTitles.get(code));
            } else {
                weaknesses.add(new DiagnosticResultResponse.WeakCategory(categoryTitles.get(code), percent));
            }
        });
        // 推荐起点：最薄弱类别的代表性知识点；全对时退回第一个类别，保持推荐不缺席。
        String weakestCode = weaknesses.stream()
                .min((a, b) -> {
                    int byPercent = Integer.compare(a.percent(), b.percent());
                    if (byPercent != 0) {
                        return byPercent;
                    }
                    int indexA = indexOfTitle(weaknesses, a);
                    int indexB = indexOfTitle(weaknesses, b);
                    return Integer.compare(indexA, indexB);
                })
                .map(weak -> representativeCode.entrySet().stream()
                        .filter(entry -> categoryTitles.get(entry.getKey()).equals(weak.categoryTitle()))
                        .map(Map.Entry::getValue)
                        .findFirst().orElse(null))
                .filter(code -> code != null)
                .orElseGet(() -> representativeCode.values().iterator().next());

        DiagnosticAttempt attempt = new DiagnosticAttempt();
        attempt.setStudentUserId(userId);
        attempt.setStage(request.stage());
        attempt.setTotalQuestions(questions.size());
        attempt.setCorrectCount(correctCount);
        attempt.setScorePercent(scorePercent);
        attempt.setCategoryScoresJson(writeJson(categories));
        attempt.setStrengthsJson(writeJson(strengths));
        attempt.setWeaknessesJson(writeJson(weaknesses));
        attempt.setRecommendedCode(weakestCode);
        attempt.setInterestsJson(request.interests() == null ? null : writeJson(request.interests()));
        attempt.setCreatedTime(Instant.now());
        mapper.insert(attempt);

        // 每个类别一条 DIAGNOSTIC 证据，并累计掌握度行的证据数；唯一键保证重试不重复。
        Instant time = attempt.getCreatedTime();
        byCategory.forEach((code, slot) -> {
            LearningEvidence evidence = new LearningEvidence();
            evidence.setStudentUserId(userId);
            evidence.setKnowledgeCode(representativeCode.get(code));
            evidence.setEvidenceType("DIAGNOSTIC");
            evidence.setTitle("学情诊断 · " + categoryTitles.get(code));
            evidence.setScorePercent(slot[0] * 100 / slot[1]);
            evidence.setConfidence(CONFIDENCE_DIAGNOSTIC);
            evidence.setReferenceId("diag:" + attempt.getId() + ":" + code);
            evidence.setDetailJson("{\"correctCount\":" + slot[0] + ",\"totalQuestions\":" + slot[1] + "}");
            evidence.setCreatedTime(time);
            evidenceMapper.insert(evidence);
            masteryMapper.recordEvidence(userId, representativeCode.get(code),
                    categoryTitles.get(code), time);
        });
        return toResponse(attempt, request.interests());
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public DiagnosticResultResponse latest() {
        DiagnosticAttempt attempt = mapper.findLatestByStudent(K12SecurityContext.requireUserId());
        return attempt == null ? null : toResponse(attempt, readStringList(attempt.getInterestsJson()));
    }

    private int indexOfTitle(List<DiagnosticResultResponse.WeakCategory> weaknesses,
                             DiagnosticResultResponse.WeakCategory target) {
        for (int index = 0; index < weaknesses.size(); index++) {
            if (weaknesses.get(index).categoryTitle().equals(target.categoryTitle())) {
                return index;
            }
        }
        return Integer.MAX_VALUE;
    }

    private DiagnosticResultResponse toResponse(DiagnosticAttempt attempt, List<String> interests) {
        List<DiagnosticResultResponse.CategoryScore> categories =
                readValue(attempt.getCategoryScoresJson(), new TypeReference<List<DiagnosticResultResponse.CategoryScore>>() {});
        List<String> strengths =
                readValue(attempt.getStrengthsJson(), new TypeReference<List<String>>() {});
        List<DiagnosticResultResponse.WeakCategory> weaknesses =
                readValue(attempt.getWeaknessesJson(), new TypeReference<List<DiagnosticResultResponse.WeakCategory>>() {});
        return new DiagnosticResultResponse(attempt.getId(), attempt.getStage(),
                defaultInt(attempt.getScorePercent()), defaultInt(attempt.getCorrectCount()),
                defaultInt(attempt.getTotalQuestions()), categories, strengths, weaknesses,
                new DiagnosticResultResponse.Recommendation(attempt.getRecommendedCode(), null),
                interests == null ? List.of() : interests, attempt.getCreatedTime());
    }

    private void requireStage(String stage) {
        if (stage == null || !STAGES.contains(stage)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "诊断学段不正确");
        }
    }

    private List<String> readStringList(String json) {
        return json == null ? List.of() : readValue(json, new TypeReference<List<String>>() {});
    }

    private <T> T readValue(String json, TypeReference<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "诊断结果数据损坏");
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("无法序列化诊断结果", exception);
        }
    }

    private int defaultInt(Integer value) {
        return value == null ? 0 : value;
    }

    /** 题库条目（含答案键）；仅在本类内使用，绝不随答卷下发。 */
    private record BankQuestion(String id, String knowledgeCode, String categoryCode, String categoryTitle,
                                String prompt, List<BankOption> options, String correctOptionId) {
    }

    private record BankOption(String id, String text) {
    }
}
