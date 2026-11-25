package com.k12.platform.assessment.model;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** 一次学情诊断的完整结果；题库与判分都在服务端，前端无法自报分数。 */
@Getter
@Setter
public class DiagnosticAttempt {
    private Long id;
    private Long studentUserId;
    private String stage;
    private Integer totalQuestions;
    private Integer correctCount;
    private Integer scorePercent;
    /** 每个知识类别的答对明细 JSON：[{categoryCode,categoryTitle,correct,total}] */
    private String categoryScoresJson;
    private String strengthsJson;
    private String weaknessesJson;
    private String recommendedCode;
    private String interestsJson;
    private Instant createdTime;
}
