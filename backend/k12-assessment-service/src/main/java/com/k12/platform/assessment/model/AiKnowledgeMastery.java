package com.k12.platform.assessment.model;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
public class AiKnowledgeMastery {
    private Long studentUserId;
    private String knowledgeCode;
    private String topic;
    private Integer attemptCount;
    private Long totalScore;
    private Long totalMaxScore;
    private Integer latestScorePercent;
    private Instant lastPracticedTime;
}
