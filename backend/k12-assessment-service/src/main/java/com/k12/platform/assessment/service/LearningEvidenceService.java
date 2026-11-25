package com.k12.platform.assessment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.assessment.dto.InternalEvidenceRequest;
import com.k12.platform.assessment.dto.LearningEvidenceResponse;
import com.k12.platform.assessment.mapper.AiKnowledgeMasteryMapper;
import com.k12.platform.assessment.mapper.LearningEvidenceMapper;
import com.k12.platform.assessment.model.LearningEvidence;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;

/**
 * 学习证据的唯一写入入口：练习判分、教学运行、诊断都在服务层落库，
 * 前端与模型永远不直接写证据。跨服务调用走共享密钥，不用学生身份。
 */
@Service
public class LearningEvidenceService {
    private static final byte[] EMPTY_TOKEN = new byte[0];

    private final LearningEvidenceMapper mapper;
    private final AiKnowledgeMasteryMapper masteryMapper;
    private final ObjectMapper objectMapper;
    private final byte[] internalToken;

    public LearningEvidenceService(LearningEvidenceMapper mapper,
                                   AiKnowledgeMasteryMapper masteryMapper,
                                   ObjectMapper objectMapper,
                                   @Value("${k12.internal.evidence-token:}") String internalToken) {
        this.mapper = mapper;
        this.masteryMapper = masteryMapper;
        this.objectMapper = objectMapper;
        this.internalToken = internalToken == null ? EMPTY_TOKEN : internalToken.getBytes(StandardCharsets.UTF_8);
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public List<LearningEvidenceResponse> mine(int limit) {
        if (limit < 1 || limit > 50) {
            throw new IllegalArgumentException("limit必须在1到50之间");
        }
        return mapper.findByStudent(K12SecurityContext.requireUserId(), limit).stream()
                .map(this::toResponse)
                .toList();
    }

    /** 教学/诊断服务的内部写回入口；密钥未配置或不对时一律拒绝。 */
    @Transactional
    public void recordInternal(InternalEvidenceRequest request, String presentedToken) {
        if (internalToken.length == 0) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "证据写回通道未启用");
        }
        if (presentedToken == null
                || !MessageDigest.isEqual(internalToken, presentedToken.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "证据写回密钥无效");
        }
        LearningEvidence evidence = new LearningEvidence();
        evidence.setStudentUserId(request.studentUserId());
        evidence.setKnowledgeCode(request.knowledgeCode());
        evidence.setEvidenceType(request.evidenceType());
        evidence.setTitle(request.title().trim());
        evidence.setScorePercent(request.scorePercent());
        evidence.setConfidence(request.confidence() == null ? 50 : request.confidence());
        evidence.setReferenceId(request.referenceId().trim());
        evidence.setDetailJson(sanitizeDetail(request.detailJson()));
        evidence.setCreatedTime(request.occurredTime() == null ? Instant.now() : request.occurredTime());
        mapper.insert(evidence);
        masteryMapper.recordEvidence(request.studentUserId(), request.knowledgeCode(),
                evidence.getTitle(), evidence.getCreatedTime());
    }

    private LearningEvidenceResponse toResponse(LearningEvidence evidence) {
        return new LearningEvidenceResponse(evidence.getId(), evidence.getKnowledgeCode(),
                evidence.getEvidenceType(), evidence.getTitle(), evidence.getScorePercent(),
                evidence.getConfidence(), evidence.getReferenceId(), evidence.getDetailJson(),
                evidence.getCreatedTime());
    }

    private String sanitizeDetail(String detailJson) {
        if (detailJson == null || detailJson.isBlank()) {
            return null;
        }
        try {
            objectMapper.readTree(detailJson);
        } catch (Exception exception) {
            throw new IllegalArgumentException("证据详情必须为合法 JSON");
        }
        return detailJson;
    }
}
