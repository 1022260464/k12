package com.k12.platform.iam.model;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Getter
@Setter
@TableName("sys_learning_profile")
public class LearningProfile {
    @TableId(type = IdType.INPUT)
    private Long userId;
    private String schoolStage;
    private Integer grade;
    private String textbook;
    private String interests;
    private Instant updatedTime;
}
