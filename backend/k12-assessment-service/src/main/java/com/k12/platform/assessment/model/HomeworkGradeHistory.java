package com.k12.platform.assessment.model;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
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
    /** 退回重做时允许为 null，需显式写入 NULL，避免被 FieldStrategy 省略。 */
    @TableField(insertStrategy = FieldStrategy.ALWAYS, updateStrategy = FieldStrategy.ALWAYS)
    private BigDecimal score;
    private String feedback;
    private Long gradedBy;
    private Instant gradedTime;
}
