package com.k12.platform.assessment.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.StudentLearningEvidenceResponse;
import com.k12.platform.assessment.mapper.AiPracticeAttemptMapper;
import com.k12.platform.assessment.model.AiPracticeAttempt;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class StudentLearningEvidenceService {
    private final AiPracticeAttemptMapper attemptMapper;
    private final KnowledgeMasteryService masteryService;
    private final ObjectMapper objectMapper;

    public StudentLearningEvidenceService(AiPracticeAttemptMapper attemptMapper,
                                          KnowledgeMasteryService masteryService,
                                          ObjectMapper objectMapper) {
        this.attemptMapper = attemptMapper;
        this.masteryService = masteryService;
        this.objectMapper = objectMapper;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('homework:grade')")
    public StudentLearningEvidenceResponse get(long studentUserId, int requestedLimit) {
        long viewer = K12SecurityContext.requireUserId();
        if (!K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN)
                && attemptMapper.canViewerAccessStudent(viewer, studentUserId) == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只能查看自己授课或作业覆盖学生的过程证据");
        }
        int limit = Math.min(Math.max(requestedLimit, 1), 50);
        List<StudentLearningEvidenceResponse.AttemptEvidence> attempts = attemptMapper
                .findRecentByStudent(studentUserId, limit).stream().map(this::toEvidence).toList();
        return new StudentLearningEvidenceResponse(studentUserId, masteryService.forStudent(studentUserId),
                attempts, "形成性练习证据用于教学调整，不替代正式作业或考试成绩。");
    }

    private StudentLearningEvidenceResponse.AttemptEvidence toEvidence(AiPracticeAttempt row) {
        return new StudentLearningEvidenceResponse.AttemptEvidence(row.getId(), row.getRunId(), row.getTopic(),
                row.getKnowledgeCode(), row.getScore(), row.getMaxScore(), row.getCorrectCount(),
                row.getTotalQuestions(), row.getWeakPoint(), valueOrZero(row.getHintCount()),
                valueOrZero(row.getDurationMs()), readErrors(row.getErrorTypesJson()), row.getCreatedTime());
    }

    private List<String> readErrors(String raw) {
        if (!StringUtils.hasText(raw)) return List.of();
        try {
            return objectMapper.readValue(raw, new TypeReference<>() { });
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private int valueOrZero(Integer value) { return value == null ? 0 : value; }
    private long valueOrZero(Long value) { return value == null ? 0L : value; }
}
