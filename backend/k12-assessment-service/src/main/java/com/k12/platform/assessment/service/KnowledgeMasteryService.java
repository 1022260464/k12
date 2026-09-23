package com.k12.platform.assessment.service;

import com.k12.platform.assessment.dto.KnowledgeMasteryResponse;
import com.k12.platform.assessment.mapper.AiKnowledgeMasteryMapper;
import com.k12.platform.assessment.model.AiKnowledgeMastery;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class KnowledgeMasteryService {
    private static final int MAX_ITEMS = 20;

    private final AiKnowledgeMasteryMapper mapper;

    public KnowledgeMasteryService(AiKnowledgeMasteryMapper mapper) {
        this.mapper = mapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public List<KnowledgeMasteryResponse> myMastery() {
        return forStudent(K12SecurityContext.requireUserId());
    }

    public List<KnowledgeMasteryResponse> forStudent(Long studentUserId) {
        return mapper.findByStudent(studentUserId, MAX_ITEMS).stream()
                .filter(row -> row.getTotalMaxScore() != null && row.getTotalMaxScore() > 0)
                .map(this::toResponse)
                .toList();
    }

    private KnowledgeMasteryResponse toResponse(AiKnowledgeMastery row) {
        int percent = (int) Math.max(0, Math.min(100,
                row.getTotalScore() * 100 / row.getTotalMaxScore()));
        String action = percent < 60 ? "REVIEW" : percent < 80 ? "PRACTICE" : "APPLY";
        return new KnowledgeMasteryResponse(row.getKnowledgeCode(), row.getTopic(), row.getAttemptCount(),
                percent, row.getLatestScorePercent(), action, row.getLastPracticedTime());
    }
}
