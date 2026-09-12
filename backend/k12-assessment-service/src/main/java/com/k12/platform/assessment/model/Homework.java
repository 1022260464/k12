package com.k12.platform.assessment.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@TableName("assessment_homework")
public class Homework {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long courseId;
    /* 逻辑关联 k12_auth.sys_user.id，不建立跨数据库外键。 */
    private Long teacherUserId;
    private String title;
    private String description;
    private String status;
    private Instant updatedTime;

    @TableLogic(value = "0", delval = "1")
    private Integer deleted;
}
