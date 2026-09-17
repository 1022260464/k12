package com.k12.platform.assessment.service;

import com.k12.platform.assessment.dto.PracticeInsightResponse;
import com.k12.platform.assessment.mapper.AiPracticeAttemptMapper;
import com.k12.platform.assessment.model.AiPracticeAttempt;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PracticeInsightService {
    private static final int SCAN_LIMIT = 50;
    private static final int TOPIC_LIMIT = 5;
    private static final int SAMPLE_LIMIT = 5;
    private static final String QUIZ_TITLE_SUFFIX = "课堂小测";

    private final AiPracticeAttemptMapper mapper;

    public PracticeInsightService(AiPracticeAttemptMapper mapper) {
        this.mapper = mapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public List<PracticeInsightResponse> myInsights() {
        Long userId = K12SecurityContext.requireUserId();
        Map<String, TopicSample> topics = new LinkedHashMap<>();
        for (AiPracticeAttempt attempt : mapper.findRecentByStudent(userId, SCAN_LIMIT)) {
            if (attempt == null || !StringUtils.hasText(attempt.getTopic())
                    || attempt.getScore() == null || attempt.getMaxScore() == null
                    || attempt.getScore() < 0 || attempt.getMaxScore() <= 0) {
                continue;
            }
            String topic = normalizeTopic(attempt.getTopic());
            if (topic.isBlank()) {
                continue;
            }
            String key = StringUtils.hasText(attempt.getKnowledgeCode())
                    ? attempt.getKnowledgeCode() : "legacy:" + topic;
            if (!topics.containsKey(key) && topics.size() >= TOPIC_LIMIT) {
                continue;
            }
            TopicSample sample = topics.computeIfAbsent(key, ignored -> new TopicSample(topic));
            if (sample.count >= SAMPLE_LIMIT) {
                continue;
            }
            int score = Math.min(attempt.getScore(), attempt.getMaxScore());
            if (sample.count == 0) {
                sample.latestPercent = percent(score, attempt.getMaxScore());
                sample.latestTime = attempt.getCreatedTime();
                sample.weakPoint = attempt.getWeakPoint();
            }
            sample.count++;
            sample.totalScore += score;
            sample.totalMaxScore += attempt.getMaxScore();
        }
        return topics.values().stream().map(sample -> toResponse(sample.topic, sample)).toList();
    }

    private PracticeInsightResponse toResponse(String topic, TopicSample sample) {
        int averagePercent = percent(sample.totalScore, sample.totalMaxScore);
        String action;
        String suggestion;
        if (sample.latestPercent < 60 || averagePercent < 60) {
            action = "REVIEW";
            suggestion = StringUtils.hasText(sample.weakPoint)
                    ? "回看讲解，重点复习「" + sample.weakPoint + "」，再做一轮练习。"
                    : "回看讲解与动画，再做一轮练习。";
        } else if (sample.latestPercent < 80 || averagePercent < 80) {
            action = "PRACTICE";
            suggestion = "再做一轮练习，并试着用自己的话解释这个知识点。";
        } else {
            action = "APPLY";
            suggestion = "尝试解释完整步骤，或完成相关编程练习。";
        }
        return new PracticeInsightResponse(topic, sample.count, averagePercent, sample.latestPercent,
                action, suggestion, sample.latestTime);
    }

    private int percent(long score, long maxScore) {
        return (int) Math.min(100, score * 100 / maxScore);
    }

    private String normalizeTopic(String value) {
        String topic = value.trim();
        if (topic.endsWith(QUIZ_TITLE_SUFFIX)) {
            topic = topic.substring(0, topic.length() - QUIZ_TITLE_SUFFIX.length()).trim();
        }
        return topic;
    }

    private static class TopicSample {
        private final String topic;
        private int count;
        private long totalScore;
        private long totalMaxScore;
        private int latestPercent;
        private Instant latestTime;
        private String weakPoint;

        private TopicSample(String topic) {
            this.topic = topic;
        }
    }
}
