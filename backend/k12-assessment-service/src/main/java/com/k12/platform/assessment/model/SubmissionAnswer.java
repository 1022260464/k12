package com.k12.platform.assessment.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@TableName("assessment_submission_answer")
public class SubmissionAnswer {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long submissionId;
    private Long questionId;
    private String answerJson;
    private String answerText;
    private BigDecimal autoScore;
    private BigDecimal manualScore;
    private BigDecimal finalScore;
    private String gradingStatus;
    private String feedback;
    private Instant updatedTime;
}
