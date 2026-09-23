package com.k12.platform.assessment.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Getter
@Setter
@TableName("assessment_ai_practice_attempt")
public class AiPracticeAttempt {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long studentUserId;
    private String runId;
    private String artifactId;
    private String topic;
    private String knowledgeCode;
    private Integer score;
    private Integer maxScore;
    private Integer correctCount;
    private Integer totalQuestions;
    private String weakPoint;
    private Integer hintCount;
    private Long durationMs;
    private String errorTypesJson;
    private String answersJson;
    private Instant createdTime;
}
