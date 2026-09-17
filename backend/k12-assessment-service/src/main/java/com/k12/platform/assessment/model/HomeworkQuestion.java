package com.k12.platform.assessment.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@TableName("assessment_homework_question")
public class HomeworkQuestion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long homeworkId;
    private String questionType;
    private String stem;
    private BigDecimal score;
    private Integer sortOrder;
    /** JSON 数组；仅服务端和有权查看答案的响应使用。 */
    private String correctAnswersJson;
    private String referenceAnswer;
    private String analysis;
    private Instant createdTime;
    private Instant updatedTime;
    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
