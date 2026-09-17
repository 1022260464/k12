package com.k12.platform.iam.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/* 用户个性化学习档案；userId 同时是主键并关联 sys_user.id。 */
@Getter
@Setter
@TableName("sys_learning_profile")
public class LearningProfile {

    @TableId(type = IdType.INPUT)
    private Long userId;
    private String schoolStage;
    private Integer grade;
    private String textbook;
    /* MySQL JSON 字段在 Java 中先保存为字符串，由 Service 统一序列化。 */
    private String interestsJson;
    private Instant updatedTime;
}
