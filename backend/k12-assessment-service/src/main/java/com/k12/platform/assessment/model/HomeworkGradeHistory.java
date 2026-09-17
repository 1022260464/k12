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
@TableName("assessment_homework_grade_history")
public class HomeworkGradeHistory {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long submissionId;
    private Integer version;
    private BigDecimal score;
    private String feedback;
    private Long gradedBy;
    private Instant gradedTime;
}
