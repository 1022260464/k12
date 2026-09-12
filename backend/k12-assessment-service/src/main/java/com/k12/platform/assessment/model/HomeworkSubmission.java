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
@TableName("assessment_homework_submission")
public class HomeworkSubmission {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long homeworkId;
    private Long studentUserId;
    private Long courseId;
    private String answerContent;
    private String status;
    private BigDecimal score;
    private String feedback;
    private Long gradedBy;
    /* 每次批改成功后加一；前端提交 expectedVersion 防止覆盖其他教师的结果。 */
    private Integer version;
    private Instant submittedTime;
    private Instant gradedTime;
    private Instant updatedTime;
}
