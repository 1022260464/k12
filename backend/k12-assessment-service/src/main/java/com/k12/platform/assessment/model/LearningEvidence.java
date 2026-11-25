package com.k12.platform.assessment.model;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** 一次被平台确认的学习活动的证据流水；只允许服务层写入。 */
@Getter
@Setter
public class LearningEvidence {
    private Long id;
    private Long studentUserId;
    private String knowledgeCode;
    private String evidenceType;
    private String title;
    private Integer scorePercent;
    private Integer confidence;
    private String referenceId;
    private String detailJson;
    private Instant createdTime;
}
